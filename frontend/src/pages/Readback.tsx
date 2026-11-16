import { useCallback, useEffect, useRef, useState } from "react";
import {
  AlertTriangle,
  ArrowLeft,
  CalendarDays,
  CheckCircle2,
  CloudOff,
  Pause,
  Pencil,
  Play,
  RefreshCw,
  Volume2,
} from "lucide-react";
import { Link, Navigate, useLocation, useParams } from "react-router-dom";
import { getReadbackAudio, getReadbackText, getVisit } from "../api";
import { getCachedAudio, cacheAudio } from "../db";
import { useOnline } from "../hooks";
import type { Visit } from "../types";
import {
  bpText,
  composeReadback,
  followUpLabel,
  gestationText,
  languageOption,
} from "../utils";
import { PageHeader } from "../components/PageHeader";
import { PageLoader, Spinner } from "../components/Spinner";
import { RiskBadge } from "../components/RiskBadge";
import { Steps } from "../components/Steps";

function clock(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds < 0) return "0:00";
  const minutes = Math.floor(seconds / 60);
  const rest = Math.floor(seconds % 60)
    .toString()
    .padStart(2, "0");
  return `${minutes}:${rest}`;
}

export function Readback() {
  const { id } = useParams<{ id: string }>();
  const location = useLocation();
  const online = useOnline();
  const initialVisit = (location.state as { visit?: Visit } | null)?.visit;
  const [visit, setVisit] = useState<Visit | null>(initialVisit ?? null);
  const [loading, setLoading] = useState(!initialVisit);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [text, setText] = useState("");
  const [steps, setSteps] = useState<string[]>([]);
  const [textError, setTextError] = useState<string | null>(null);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [audioError, setAudioError] = useState<string | null>(null);
  const [audioLoading, setAudioLoading] = useState(false);
  const [playing, setPlaying] = useState(false);
  const [current, setCurrent] = useState(0);
  const [duration, setDuration] = useState(0);
  const audioRef = useRef<HTMLAudioElement>(null);

  useEffect(() => {
    if (!id || visit) return;
    let cancelled = false;
    setLoading(true);
    getVisit(id)
      .then((loaded) => {
        if (!cancelled) {
          setVisit(loaded);
          setLoadError(null);
        }
      })
      .catch((caught) => {
        if (!cancelled) {
          setLoadError(
            caught instanceof Error ? caught.message : "Could not load this visit.",
          );
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [id, visit]);

  useEffect(() => {
    if (!id || !visit) return;
    let cancelled = false;
    const cacheKey = `readback-text.${id}.${visit.language}`;
    getReadbackText(id, visit.language)
      .then((response) => {
        if (cancelled) return;
        setText(response.text);
        setSteps(response.steps ?? []);
        setTextError(null);
        try {
          localStorage.setItem(cacheKey, response.text);
          localStorage.setItem(`${cacheKey}.steps`, JSON.stringify(response.steps ?? []));
        } catch {
          // Offline text cache is best-effort.
        }
      })
      .catch(() => {
        if (cancelled) return;
        let cached: string | null = null;
        try {
          cached = localStorage.getItem(cacheKey);
          setSteps(JSON.parse(localStorage.getItem(`${cacheKey}.steps`) ?? "[]"));
        } catch {
          cached = null;
        }
        setText(cached ?? composeReadback(visit));
        setTextError(
          cached
            ? null
            : "Showing a short local summary. The full read-back wording needs a connection.",
        );
      });
    return () => {
      cancelled = true;
    };
  }, [id, visit]);

  const loadAudio = useCallback(async () => {
    if (!id || !visit) return;
    const cacheKey = `readback-audio.${id}.${visit.language}`;
    setAudioLoading(true);
    setAudioError(null);
    try {
      if (navigator.onLine) {
        const blob = await getReadbackAudio(id, visit.language);
        await cacheAudio(cacheKey, blob);
        setAudioUrl(URL.createObjectURL(blob));
      } else {
        const blob = await getCachedAudio(cacheKey);
        if (blob) {
          setAudioUrl(URL.createObjectURL(blob));
        } else {
          setAudioError(
            "The read-back audio is not saved on this phone yet. It will be available when you are online.",
          );
        }
      }
    } catch (caught) {
      if (navigator.onLine) {
        setAudioError(
          caught instanceof Error
            ? caught.message
            : "Could not generate the read-back audio.",
        );
      } else {
        setAudioError(
          "You are offline and this read-back audio is not cached yet.",
        );
      }
    } finally {
      setAudioLoading(false);
    }
  }, [id, visit]);

  useEffect(() => {
    void loadAudio();
  }, [loadAudio]);

  useEffect(() => {
    return () => {
      if (audioUrl) URL.revokeObjectURL(audioUrl);
    };
  }, [audioUrl]);

  useEffect(() => {
    if (!audioUrl) return;
    const audio = audioRef.current;
    if (!audio) return;
    audio.play().catch(() => {
      // Autoplay may be blocked; the play button is always available.
    });
  }, [audioUrl]);

  if (loading) return <PageLoader label="Preparing the read-back" />;
  if (loadError || !visit || !id) {
    return (
      <div className="mx-auto max-w-xl">
        <div className="rounded-[24px] border border-rose-200 bg-rose-50 p-6 text-center">
          <AlertTriangle className="mx-auto size-7 text-rose-700" />
          <h1 className="mt-3 font-display text-2xl font-semibold text-ink">
            This report could not be opened
          </h1>
          <p className="mt-1 text-sm text-rose-800/80">
            {loadError ?? "The visit was not found."}
          </p>
          <Link
            to="/visits"
            className="mt-4 inline-flex rounded-full bg-pine px-5 py-2.5 text-sm font-bold text-cream"
          >
            Back to visits
          </Link>
        </div>
      </div>
    );
  }
  if (visit.status !== "confirmed") {
    return <Navigate to={`/review/${visit.id}`} replace />;
  }

  const structured = visit.structured;
  const togglePlay = () => {
    const audio = audioRef.current;
    if (!audio) return;
    if (audio.paused) {
      audio.play().catch(() => setAudioError("Tap play again to start the audio."));
    } else {
      audio.pause();
    }
  };
  const progress =
    duration > 0 ? Math.min(100, Math.max(0, (current / duration) * 100)) : 0;

  return (
    <div className="mx-auto max-w-3xl">
      <Link
        to="/visits"
        className="mb-4 inline-flex items-center gap-1.5 text-xs font-bold text-moss transition hover:text-pine"
      >
        <ArrowLeft className="size-3.5" />
        Back to visits
      </Link>
      <PageHeader
        eyebrow="Step 3 of 3 · Read back"
        title="Report saved"
        subtitle="Listen once before you close the visit. What you hear is what your supervisor will see."
      />
      <Steps current={3} />

      <div className="rounded-[28px] bg-pine p-5 text-cream shadow-[0_28px_70px_-40px_rgba(15,76,70,0.9)] md:p-6">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-cream/50">
              Confirmed report
            </p>
            <h2 className="mt-1 font-display text-2xl font-semibold">
              {structured.patient_name ?? visit.patient_name ?? "Unnamed patient"}
            </h2>
            <p className="mt-1 text-xs text-cream/60">
              {languageOption(visit.language).native} ·{" "}
              {structured.village ?? "Village not recorded"} ·{" "}
              {followUpLabel(visit.follow_up_date)}
            </p>
          </div>
          <RiskBadge level={visit.risk_level} />
        </div>

        <div className="mt-5 flex items-center gap-3 rounded-2xl bg-cream/5 p-3 ring-1 ring-cream/10">
          <button
            type="button"
            onClick={togglePlay}
            disabled={!audioUrl || audioLoading}
            className="grid size-14 shrink-0 place-items-center rounded-full bg-cream text-pine shadow-lg transition active:scale-[0.98] disabled:opacity-50"
            aria-label={playing ? "Pause read-back" : "Play read-back"}
          >
            {audioLoading ? (
              <Spinner className="size-5" />
            ) : playing ? (
              <Pause className="size-5 fill-current" />
            ) : (
              <Play className="size-5 fill-current" />
            )}
          </button>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-[0.14em] text-cream/50">
              <Volume2 className="size-3.5 text-saffron" />
              Gnani Timbre read-back
            </div>
            <p className="mt-0.5 truncate text-sm font-bold text-cream/90">
              {audioLoading
                ? "Generating audio…"
                : audioError
                  ? "Audio needs a connection"
                  : playing
                    ? "Reading aloud…"
                    : "Hear your report"}
            </p>
            <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-cream/25">
              <div
                className="h-full rounded-full bg-saffron transition-[width] duration-300"
                style={{ width: `${progress}%` }}
              />
            </div>
            <div className="mt-1 flex justify-between text-[9px] font-semibold text-cream/60">
              <span>{clock(current)}</span>
              <span>{clock(duration)}</span>
            </div>
          </div>
        </div>

        {audioError && (
          <div className="mt-3 flex flex-wrap items-center gap-2 rounded-xl bg-cream/10 px-3 py-2 text-[11px] font-semibold text-cream/75">
            <CloudOff className="size-3.5 shrink-0 text-saffron" />
            <span className="flex-1">{audioError}</span>
            {online && (
              <button
                type="button"
                onClick={() => void loadAudio()}
                className="inline-flex items-center gap-1 rounded-full bg-cream px-3 py-1 text-[10px] font-bold text-pine"
              >
                <RefreshCw className="size-3" />
                Retry
              </button>
            )}
          </div>
        )}

        <audio
          ref={audioRef}
          src={audioUrl ?? undefined}
          onPlay={() => setPlaying(true)}
          onPause={() => setPlaying(false)}
          onEnded={() => {
            setPlaying(false);
            setCurrent(0);
          }}
          onTimeUpdate={(event) =>
            setCurrent(event.currentTarget.currentTime)
          }
          onLoadedMetadata={(event) =>
            setDuration(event.currentTarget.duration)
          }
          className="hidden"
        />
      </div>

      <div className="mt-4 rounded-[24px] border border-stone-200/80 bg-cream p-5">
        <div className="flex items-center gap-2">
          <CheckCircle2 className="size-4 text-emerald-600" />
          <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-moss">
            Read-back text
          </p>
        </div>
        <blockquote className="mt-3 font-display text-2xl leading-snug font-medium text-ink">
          “{text || "Preparing the read-back wording…"}”
        </blockquote>
        {textError && (
          <p className="mt-2 text-[11px] font-semibold text-amber-700">
            {textError}
          </p>
        )}
        <div className="mt-4 flex flex-wrap gap-1.5 text-[10px] font-bold text-moss">
          <span className="rounded-full bg-stone-100 px-2.5 py-1">
            {bpText(structured.vitals)}
          </span>
          {["anc", "postnatal"].includes(visit.visit_type) && (
            <span className="rounded-full bg-stone-100 px-2.5 py-1">
              {gestationText(structured.pregnancy)}
            </span>
          )}
          <span className="inline-flex items-center gap-1 rounded-full bg-stone-100 px-2.5 py-1">
            <CalendarDays className="size-3" />
            {followUpLabel(visit.follow_up_date)}
          </span>
        </div>
      </div>

      {steps.length > 0 && (
        <div className="mt-4 rounded-[24px] border border-red-200 bg-red-50 p-4 shadow-[0_18px_40px_-28px_rgba(185,28,28,0.7)]">
          <p className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-[0.16em] text-red-700">
            <span className="relative flex size-2">
              <span className="absolute inline-flex size-full animate-ping rounded-full bg-red-500 opacity-75" />
              <span className="relative inline-flex size-2 rounded-full bg-red-600" />
            </span>
            Do this now
          </p>
          <ol className="mt-2 space-y-2">
            {steps.map((step, index) => (
              <li key={step} className="flex items-start gap-3 text-sm font-bold text-red-950">
                <span className="grid size-6 shrink-0 place-items-center rounded-full bg-red-600 text-xs text-white">
                  {index + 1}
                </span>
                <span className="pt-0.5">{step}</span>
              </li>
            ))}
          </ol>
        </div>
      )}

      {visit.risk_reasons.length > 0 && (
        <div className="mt-4 rounded-[24px] border border-amber-200 bg-amber-50 p-4">
          <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-amber-800">
            Flagged for your supervisor
          </p>
          <ul className="mt-1.5 space-y-1 text-xs font-semibold text-amber-900">
            {visit.risk_reasons.map((reason) => (
              <li key={reason} className="flex items-start gap-1.5">
                <span className="mt-1.5 size-1 shrink-0 rounded-full bg-amber-700" />
                {reason}
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="mt-5 flex flex-wrap items-center gap-2">
        <Link
          to="/"
          className="inline-flex h-12 items-center justify-center gap-2 rounded-full bg-pine px-5 text-sm font-bold text-cream shadow-[0_12px_26px_-14px_rgba(15,76,70,0.9)]"
        >
          <CheckCircle2 className="size-4" />
          Done
        </Link>
        <Link
          to={`/review/${visit.id}`}
            className="inline-flex h-12 items-center justify-center gap-2 rounded-full border border-stone-200 bg-cream px-5 text-sm font-bold text-ink"
        >
          <Pencil className="size-4" />
          Edit report
        </Link>
        {audioUrl && (
          <button
            type="button"
            onClick={togglePlay}
          className="inline-flex h-12 items-center justify-center gap-2 rounded-full border border-stone-200 bg-cream px-5 text-sm font-bold text-ink"
          >
            <Play className="size-4" />
            Play again
          </button>
        )}
      </div>

      <p className="mt-4 text-[10px] leading-relaxed text-moss/70">
        The report is now visible to the supervisor. The audio read-back is cached
        on this device for offline use.
      </p>
    </div>
  );
}
