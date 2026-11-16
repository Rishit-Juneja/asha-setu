import { useEffect, useState } from "react";
import {
  AlertTriangle,
  ArrowLeft,
  Baby,
  CheckCircle2,
  CloudOff,
  HeartPulse,
  Mic,
  RotateCcw,
  Square,
  Stethoscope,
  Syringe,
  UserRound,
  WifiOff,
} from "lucide-react";
import { Link, Navigate, useNavigate } from "react-router-dom";
import { createDraft, getPatients, NetworkError } from "../api";
import { useAuth } from "../auth";
import { enqueueVisit } from "../db";
import { useOnline, useRecorder } from "../hooks";
import { LANGUAGES, VISIT_TYPES } from "../constants";
import type { Patient } from "../types";
import { cn, isSupervisor, languageOption } from "../utils";
import { useToast } from "../toast";
import { PageHeader } from "../components/PageHeader";
import { Steps } from "../components/Steps";
import { Spinner } from "../components/Spinner";

const TYPE_ICONS: Record<string, typeof Mic> = {
  anc: Baby,
  postnatal: HeartPulse,
  immunization: Syringe,
  newborn: Baby,
  general: Stethoscope,
};

const SAMPLES: Record<string, string> = {
  "kn-IN":
    "ಸುನೀತಾ ಅವರ ರಕ್ತದೊತ್ತಡ 140/90, ಏಳು ತಿಂಗಳ ಗರ್ಭ, ಐರನ್ ಮಾತ್ರೆ ಕೊಟ್ಟಿದ್ದೇನೆ, ಸೋಮವಾರ ಮರುಭೇಟಿ.",
  "hi-IN,en-IN":
    "Sunita ji ka BP 140 by 90 hai, saat mahine ki pregnancy hai, IFA tablets diye, Monday follow-up.",
  "hi-IN":
    "सुनीता जी का बीपी 140/90 है, सात महीने की गर्भावस्था है, आईएफए गोली दी, सोमवार फॉलो-अप।",
};

function timerText(seconds: number): string {
  const minutes = Math.floor(seconds / 60)
    .toString()
    .padStart(2, "0");
  const rest = (seconds % 60).toString().padStart(2, "0");
  return `${minutes}:${rest}`;
}

function extensionFor(blob: Blob): string {
  if (blob.type.includes("mp4")) return "m4a";
  if (blob.type.includes("ogg")) return "ogg";
  return "webm";
}

export function Record() {
  const { worker } = useAuth();
  const navigate = useNavigate();
  const online = useOnline();
  const { notify } = useToast();
  const [language, setLanguage] = useState(worker?.language ?? "kn-IN");
  const [visitType, setVisitType] = useState("anc");
  const [patientId, setPatientId] = useState<number | null>(null);
  const [patients, setPatients] = useState<Patient[]>([]);
  const [uploading, setUploading] = useState(false);
  const [uploadStage, setUploadStage] = useState(0);
  const [offlineSaved, setOfflineSaved] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [pendingBlob, setPendingBlob] = useState<Blob | null>(null);

  useEffect(() => {
    if (!navigator.onLine) return;
    getPatients()
      .then(setPatients)
      .catch(() => {
        // The patient list is optional; a new patient is created on confirm.
      });
  }, []);

  const upload = async (blob: Blob) => {
    setUploadError(null);
    setOfflineSaved(false);
    setUploading(true);
    setUploadStage(0);
    const clientUuid =
      typeof crypto.randomUUID === "function"
        ? crypto.randomUUID()
        : `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;
    const queueItem = {
      id: clientUuid,
      blob,
      filename: `visit.${extensionFor(blob)}`,
      language,
      visit_type: visitType,
      patient_id: patientId,
    };
    let stageTimer: number | undefined;

    if (!navigator.onLine) {
      await enqueueVisit(queueItem);
      setUploading(false);
      setOfflineSaved(true);
      notify("Saved on this phone. It will sync when you are online.", "success");
      return;
    }

    try {
      stageTimer = window.setInterval(() => {
        setUploadStage((current) => Math.min(current + 1, 2));
      }, 1300);
      const draft = await createDraft(blob, {
        language,
        visitType,
        patientId,
        clientUuid,
      });
      navigate(`/review/${draft.id}`, { replace: true });
    } catch (caught) {
      if (caught instanceof NetworkError) {
        await enqueueVisit(queueItem);
        setOfflineSaved(true);
        notify(
          "Connection lost. The recording is safe on this phone.",
          "info",
        );
      } else {
        setUploadError(
          caught instanceof Error
            ? caught.message
            : "Could not process this recording. Please try again.",
        );
      }
    } finally {
      if (stageTimer) window.clearInterval(stageTimer);
      setUploading(false);
    }
  };

  const recorder = useRecorder({
    maxSeconds: 120,
    onComplete: (blob) => {
      setPendingBlob(blob);
      void upload(blob);
    },
  });

  if (!worker) return null;
  if (isSupervisor(worker)) return <Navigate to="/dashboard" replace />;

  const recording = recorder.state === "recording";
  const requesting = recorder.state === "requesting";
  const processing = recorder.state === "processing";
  const sample = SAMPLES[language] ?? "Name, BP, pregnancy, medicines, follow-up.";

  return (
    <div className="mx-auto max-w-3xl">
      <Link
        to="/"
        className="mb-4 inline-flex items-center gap-1.5 text-xs font-bold text-moss transition hover:text-pine"
      >
        <ArrowLeft className="size-3.5" />
        Back to today
      </Link>
      <PageHeader
        eyebrow="New home visit"
        title="Speak the visit"
        subtitle="One voice note is enough. ASHA Setu will transcribe it with Gnani Prisma and shape a report you can check."
      />
      <Steps current={1} />

      <div className="space-y-4">
        <section className="rounded-[24px] border border-stone-200/80 bg-cream p-4 md:p-5">
          <div className="mb-2.5 flex items-center justify-between gap-3">
            <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-moss">
              Language
            </p>
            <span className="text-[10px] font-semibold text-moss/60">
              {languageOption(language).label}
            </span>
          </div>
          <div className="flex flex-wrap gap-2">
            {LANGUAGES.map((option) => {
              const active = option.code === language;
              return (
                <button
                  key={option.code}
                  type="button"
                  disabled={recording || uploading}
                  onClick={() => setLanguage(option.code)}
                  className={cn(
                    "shrink-0 rounded-2xl border px-3.5 py-2.5 text-left transition",
                    active
                      ? "border-pine bg-pine text-cream shadow-sm"
                      : "border-stone-200 bg-paper text-ink hover:border-pine/30",
                  )}
                >
                  <span className="block text-sm font-bold">{option.native}</span>
                  <span
                    className={cn(
                      "mt-0.5 block text-[10px] font-semibold",
                      active ? "text-cream/60" : "text-moss",
                    )}
                  >
                    {option.label}
                  </span>
                </button>
              );
            })}
          </div>
        </section>

        <section className="rounded-[24px] border border-stone-200/80 bg-cream p-4 md:p-5">
          <p className="mb-2.5 text-[11px] font-bold uppercase tracking-[0.14em] text-moss">
            Visit type
          </p>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
            {VISIT_TYPES.map((type) => {
              const Icon = TYPE_ICONS[type.code] ?? Stethoscope;
              const active = type.code === visitType;
              return (
                <button
                  key={type.code}
                  type="button"
                  disabled={recording || uploading}
                  onClick={() => setVisitType(type.code)}
                  className={cn(
                    "flex items-center gap-2 rounded-2xl border px-3 py-2.5 text-left text-xs font-bold transition",
                    active
                      ? "border-pine bg-pine-soft text-pine"
                      : "border-stone-200 bg-paper text-ink/70 hover:border-pine/30",
                  )}
                >
                  <Icon className="size-4 shrink-0" />
                  <span className="truncate">{type.label}</span>
                </button>
              );
            })}
          </div>
        </section>

        <section className="rounded-[24px] border border-stone-200/80 bg-cream p-4 md:p-5">
          <div className="mb-2.5 flex items-center justify-between gap-3">
            <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-moss">
              Link a patient <span className="font-semibold text-moss/50">(optional)</span>
            </p>
            <UserRound className="size-4 text-moss/50" />
          </div>
          <select
            value={patientId ?? ""}
            onChange={(event) =>
              setPatientId(event.target.value ? Number(event.target.value) : null)
            }
            disabled={recording || uploading}
            className="w-full rounded-xl border border-stone-200 bg-cream px-3.5 py-2.5 text-sm text-ink outline-none transition focus:border-pine focus:ring-2 focus:ring-pine/15"
          >
            <option value="">Not linked — create from the spoken name</option>
            {patients.map((patient) => (
              <option key={patient.id} value={patient.id}>
                {patient.name}
                {patient.village ? ` · ${patient.village}` : ""}
                {patient.age ? ` · ${patient.age} yrs` : ""}
              </option>
            ))}
          </select>
          <p className="mt-1.5 text-[11px] text-moss">
            Linking fills age and village from the patient's record.
          </p>
        </section>

        {offlineSaved ? (
          <section className="rounded-[28px] border border-pine/15 bg-pine-soft/50 p-7 text-center">
            <span className="mx-auto grid size-14 place-items-center rounded-full bg-pine text-cream">
              <CloudOff className="size-6" />
            </span>
            <h2 className="mt-4 font-display text-2xl font-semibold text-ink">
              Saved on this phone
            </h2>
            <p className="mx-auto mt-1.5 max-w-sm text-sm leading-relaxed text-moss">
              The recording is queued safely. When you are back online, ASHA Setu
              will transcribe it and put the draft in All visits.
            </p>
            <div className="mt-5 flex flex-wrap justify-center gap-2">
              <button
                type="button"
                onClick={() => navigate("/")}
                className="rounded-full bg-pine px-5 py-2.5 text-sm font-bold text-cream"
              >
                Back to today
              </button>
              <button
                type="button"
                onClick={() => {
                  setOfflineSaved(false);
                  setPendingBlob(null);
                  recorder.reset();
                }}
                className="rounded-full border border-stone-200 bg-cream px-5 py-2.5 text-sm font-bold text-ink"
              >
                Record another
              </button>
            </div>
          </section>
        ) : uploading ? (
          <section className="rounded-[28px] border border-stone-200/80 bg-cream p-7 text-center">
            <span className="mx-auto grid size-14 place-items-center rounded-full bg-pine-soft text-pine">
              <Spinner className="size-6" />
            </span>
            <h2 className="mt-4 font-display text-2xl font-semibold text-ink">
              Listening back
            </h2>
            <p className="mt-1.5 text-sm text-moss">
              Gnani Prisma is turning your voice note into a report.
            </p>
            <ol className="mx-auto mt-5 max-w-sm space-y-2 text-left">
              {[
                "Uploading the audio",
                "Transcribing with Gnani Prisma",
                "Structuring the visit",
              ].map((label, index) => {
                const done = uploadStage > index;
                const active = uploadStage === index;
                return (
                  <li
                    key={label}
                    className={cn(
                      "flex items-center gap-2.5 rounded-xl px-3 py-2 text-xs font-semibold",
                      done && "text-pine",
                      active && "bg-pine-soft text-pine",
                      !done && !active && "text-moss/50",
                    )}
                  >
                    {done ? (
                      <CheckCircle2 className="size-4 shrink-0" />
                    ) : active ? (
                      <Spinner className="size-4 shrink-0" />
                    ) : (
                      <span className="grid size-4 place-items-center rounded-full border border-current text-[8px]">
                        {index + 1}
                      </span>
                    )}
                    {label}
                  </li>
                );
              })}
            </ol>
            <p className="mt-4 text-[10px] font-semibold uppercase tracking-wider text-moss/50">
              Usually a few seconds
            </p>
          </section>
        ) : uploadError ? (
          <section className="rounded-[28px] border border-rose-200 bg-rose-50/70 p-7 text-center">
            <span className="mx-auto grid size-14 place-items-center rounded-full bg-rose-100 text-rose-700">
              <AlertTriangle className="size-6" />
            </span>
            <h2 className="mt-4 font-display text-2xl font-semibold text-ink">
              That recording did not go through
            </h2>
            <p className="mx-auto mt-1.5 max-w-sm text-sm leading-relaxed text-rose-800/80">
              {uploadError}
            </p>
            <div className="mt-5 flex flex-wrap justify-center gap-2">
              {pendingBlob && (
                <button
                  type="button"
                  onClick={() => void upload(pendingBlob)}
                  className="inline-flex items-center gap-2 rounded-full bg-pine px-5 py-2.5 text-sm font-bold text-cream"
                >
                  <RotateCcw className="size-4" />
                  Try again
                </button>
              )}
              <button
                type="button"
                onClick={() => {
                  setUploadError(null);
                  setPendingBlob(null);
                  recorder.reset();
                }}
                className="rounded-full border border-stone-200 bg-cream px-5 py-2.5 text-sm font-bold text-ink"
              >
                Record again
              </button>
            </div>
          </section>
        ) : (
          <section className="relative overflow-hidden rounded-[30px] border border-stone-200/80 bg-cream px-5 py-8 text-center shadow-[0_24px_60px_-45px_rgba(20,37,31,0.6)]">
            <div
              className="pointer-events-none absolute inset-x-0 top-0 h-40 bg-[radial-gradient(circle_at_50%_0%,rgba(15,76,70,0.08),transparent_70%)]"
              aria-hidden
            />
            <p className="relative text-[10px] font-bold uppercase tracking-[0.2em] text-moss">
              {recording ? "Recording now" : "Ready when you are"}
            </p>
            <div className="relative mt-5 flex justify-center">
              {recording && (
                <>
                  <span className="absolute size-44 animate-ping rounded-full bg-rose-200/60" />
                  <span className="absolute size-40 rounded-full bg-rose-100" />
                </>
              )}
              <button
                type="button"
                onClick={recording ? recorder.stop : recorder.start}
                disabled={requesting || processing}
                className={cn(
                  "relative grid size-36 place-items-center rounded-full text-cream shadow-[0_24px_50px_-20px_rgba(15,76,70,0.7)] transition active:scale-[0.98]",
                  recording ? "bg-rose-600" : "bg-pine hover:bg-pine/95",
                  (requesting || processing) && "opacity-70",
                )}
                aria-label={recording ? "Stop recording" : "Start recording"}
              >
                {requesting || processing ? (
                  <Spinner className="size-9" />
                ) : recording ? (
                  <Square className="size-10 fill-current" />
                ) : (
                  <Mic className="size-11" strokeWidth={1.7} />
                )}
              </button>
            </div>
            <h2 className="relative mt-5 font-display text-2xl font-semibold text-ink">
              {recording
                ? "Listening…"
                : requesting
                  ? "Opening the microphone"
                  : processing
                    ? "Finishing the recording"
                    : "Tap to speak"}
            </h2>
            <p className="relative mt-1 text-sm text-moss">
              {recording
                ? "Speak naturally, then tap the square to stop."
                : "Up to 2 minutes · your voice never leaves this device until you send it."}
            </p>

            {recording && (
              <div className="relative mt-5">
                <div className="flex h-10 items-center justify-center gap-1">
                  {Array.from({ length: 24 }).map((_, index) => (
                    <span
                      key={index}
                      className="wave-bar w-1 rounded-full bg-pine/70"
                      style={{
                        animationDelay: `${index * 55}ms`,
                        height: `${8 + ((index * 7) % 20)}px`,
                      }}
                    />
                  ))}
                </div>
                <p className="mt-2 font-mono text-xl font-bold text-ink">
                  {timerText(recorder.seconds)}
                </p>
                <p className="text-[10px] font-semibold uppercase tracking-wider text-moss/60">
                  Limit 2:00
                </p>
              </div>
            )}

            {recorder.error && (
              <div className="relative mt-4 rounded-xl bg-rose-50 px-3.5 py-2.5 text-xs font-semibold text-rose-700 ring-1 ring-rose-200">
                {recorder.error}
              </div>
            )}

            {!online && (
              <p className="relative mt-4 inline-flex items-center gap-1.5 rounded-full bg-stone-100 px-3 py-1.5 text-[10px] font-bold text-moss">
                <WifiOff className="size-3" />
                Offline: the recording will be saved on this phone
              </p>
            )}
          </section>
        )}

        <section className="rounded-[24px] bg-pine/5 p-4 ring-1 ring-pine/10 md:p-5">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-pine">
              What to say
            </p>
            <span className="rounded-full bg-cream px-2.5 py-1 text-[10px] font-bold text-moss">
              {languageOption(language).native}
            </span>
          </div>
          <p className="mt-2 font-display text-lg leading-snug text-ink">
            “{sample}”
          </p>
          <div className="mt-3 grid gap-1.5 text-[11px] text-moss sm:grid-cols-2">
            {[
              "Patient name and village",
              "BP, Hb, weight or temperature",
              "Pregnancy months or weeks",
              "Danger signs and medicines",
              "Who you referred, and where",
              "When to follow up",
            ].map((tip) => (
              <p key={tip} className="flex items-center gap-1.5">
                <CheckCircle2 className="size-3.5 shrink-0 text-pine/60" />
                {tip}
              </p>
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}
