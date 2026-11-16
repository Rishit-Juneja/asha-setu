import { useCallback, useEffect, useRef, useState } from "react";
import { ArrowRight, Hand, Loader2, Mic, Phone, PhoneOff, Volume2 } from "lucide-react";
import { Link } from "react-router-dom";
import { answerCall, createDraft, getCallGreeting, getCallQuestion, speak } from "../api";
import { useAuth } from "../auth";
import { RiskBadge } from "../components/RiskBadge";
import { LANGUAGES } from "../constants";
import type { Visit } from "../types";

type Phase = "idle" | "speaking" | "listening" | "thinking" | "done" | "error";
interface Line {
  who: "setu" | "you";
  text: string;
}

const CALL_LANGUAGES = LANGUAGES.filter((l) =>
  ["hi-IN", "hi-IN,en-IN", "kn-IN", "en-IN"].includes(l.code),
);

const PHASE_COPY: Record<Phase, string> = {
  idle: "",
  speaking: "ASHA Setu is speaking",
  listening: "Listening — speak now",
  thinking: "Understanding…",
  done: "Call complete",
  error: "Call dropped",
};

// Turn-taking: a turn ends after this much quiet once she has started speaking.
// ponytail: fixed RMS threshold, calibrate per device if field noise trips it
const SPEECH_RMS = 0.025;
const SILENCE_MS = 1500;
const NO_SPEECH_MS = 9000;
const MAX_TURN_MS = 25000;

function useCallAudio() {
  const stream = useRef<MediaStream | null>(null);
  const ctx = useRef<AudioContext | null>(null);
  const analyser = useRef<AnalyserNode | null>(null);
  const player = useRef<HTMLAudioElement | null>(null);
  const stopTurn = useRef<(() => void) | null>(null);
  const [level, setLevel] = useState(0);

  const open = useCallback(async () => {
    stream.current = await navigator.mediaDevices.getUserMedia({
      audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true },
    });
    ctx.current = new AudioContext();
    analyser.current = ctx.current.createAnalyser();
    analyser.current.fftSize = 1024;
    ctx.current.createMediaStreamSource(stream.current).connect(analyser.current);
  }, []);

  const close = useCallback(() => {
    stopTurn.current?.();
    player.current?.pause();
    stream.current?.getTracks().forEach((t) => t.stop());
    void ctx.current?.close().catch(() => undefined);
    stream.current = null;
    ctx.current = null;
  }, []);

  const play = useCallback(async (blob: Blob) => {
    const url = URL.createObjectURL(blob);
    const audio = new Audio(url);
    player.current = audio;
    await new Promise<void>((resolve) => {
      audio.onended = () => resolve();
      audio.onerror = () => resolve();
      audio.play().catch(() => resolve());
    });
    URL.revokeObjectURL(url);
  }, []);

  /** Records one turn; resolves with null when she said nothing. */
  const listen = useCallback(
    () =>
      new Promise<Blob | null>((resolve) => {
        const s = stream.current;
        const a = analyser.current;
        if (!s || !a) return resolve(null);
        const mimeType =
          ["audio/webm;codecs=opus", "audio/webm", "audio/mp4", "audio/ogg;codecs=opus"].find(
            (t) => MediaRecorder.isTypeSupported(t),
          ) ?? "";
        const recorder = new MediaRecorder(s, mimeType ? { mimeType } : undefined);
        const chunks: Blob[] = [];
        const buf = new Float32Array(a.fftSize);
        const started = performance.now();
        let spoke = false;
        let lastVoice = started;
        let timer = 0;

        const finish = () => {
          window.clearInterval(timer);
          stopTurn.current = null;
          setLevel(0);
          if (recorder.state !== "inactive") recorder.stop();
        };
        stopTurn.current = finish;
        recorder.ondataavailable = (e) => e.data.size && chunks.push(e.data);
        recorder.onstop = () =>
          resolve(spoke && chunks.length ? new Blob(chunks, { type: mimeType || "audio/webm" }) : null);

        const tick = () => {
          a.getFloatTimeDomainData(buf);
          let sum = 0;
          for (const v of buf) sum += v * v;
          const rms = Math.sqrt(sum / buf.length);
          setLevel(Math.min(1, rms * 12));
          const now = performance.now();
          if (rms > SPEECH_RMS) {
            spoke = true;
            lastVoice = now;
          }
          if (
            (spoke && now - lastVoice > SILENCE_MS) ||
            (!spoke && now - started > NO_SPEECH_MS) ||
            now - started > MAX_TURN_MS
          ) {
            finish();
          }
        };
        recorder.start(250);
        // Steady 50ms sampling: rAF gets throttled off-screen and fakes long silences
        timer = window.setInterval(tick, 50);
      }),
    [],
  );

  return { open, close, play, listen, level, endTurn: () => stopTurn.current?.() };
}

function formatTimer(seconds: number) {
  return `${String(Math.floor(seconds / 60)).padStart(2, "0")}:${String(seconds % 60).padStart(2, "0")}`;
}

export function Call() {
  const { worker } = useAuth();
  const [language, setLanguage] = useState(
    CALL_LANGUAGES.some((l) => l.code === worker?.language) ? worker!.language : "hi-IN",
  );
  const [phase, setPhase] = useState<Phase>("idle");
  const [lines, setLines] = useState<Line[]>([]);
  const [visit, setVisit] = useState<Visit | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [elapsed, setElapsed] = useState(0);
  const live = useRef(false);
  const audio = useCallAudio();
  const scroller = useRef<HTMLDivElement>(null);

  const say = (who: Line["who"], text: string) => setLines((prev) => [...prev, { who, text }]);

  useEffect(() => {
    scroller.current?.scrollTo({ top: scroller.current.scrollHeight, behavior: "smooth" });
  }, [lines, phase]);

  useEffect(() => {
    if (phase === "idle" || phase === "done" || phase === "error") return;
    const t = window.setInterval(() => setElapsed((s) => s + 1), 1000);
    return () => window.clearInterval(t);
  }, [phase]);

  useEffect(() => () => {
    live.current = false;
    audio.close();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const speakLine = async (text: string) => {
    say("setu", text);
    setPhase("speaking");
    try {
      await audio.play(await speak(text, language));
    } catch {
      // Text is on screen even if the voice fails.
    }
  };

  const hear = async (): Promise<Blob | null> => {
    if (!live.current) return null;
    setPhase("listening");
    const blob = await audio.listen();
    if (live.current) setPhase("thinking");
    return blob;
  };

  const start = async () => {
    setError(null);
    setLines([]);
    setVisit(null);
    setElapsed(0);
    try {
      await audio.open();
    } catch {
      setError("Microphone permission is needed for the call.");
      setPhase("error");
      return;
    }
    live.current = true;
    try {
      await speakLine((await getCallGreeting(language)).text);
      let first: Blob | null = null;
      for (let tries = 0; tries < 2 && live.current && !first; tries++) first = await hear();
      if (!live.current) return;
      if (!first) throw new Error("No speech heard. Please call again and describe the visit.");

      let current = await createDraft(first, {
        language,
        visitType: "anc",
        clientUuid: crypto.randomUUID?.() ?? `${Date.now()}-${Math.random()}`,
      });
      say("you", current.transcript);
      setVisit(current);

      const asked: string[] = [];
      while (live.current) {
        const q = await getCallQuestion(current.id, language, asked);
        await speakLine(q.text);
        if (!q.field) break;
        asked.push(q.field);
        const reply = await hear();
        if (!live.current) return;
        if (!reply) continue; // silence = skip this field
        const out = await answerCall(current.id, reply, q.field, q.text);
        if (out.heard) say("you", out.heard);
        current = out.visit;
        setVisit(current);
      }
      setPhase("done");
    } catch (caught) {
      if (!live.current) return;
      setError(caught instanceof Error ? caught.message : "The call failed.");
      setPhase("error");
    } finally {
      live.current = false;
      audio.close();
    }
  };

  const hangUp = () => {
    live.current = false;
    audio.close();
    setPhase(visit ? "done" : "idle");
  };

  const inCall = phase === "speaking" || phase === "listening" || phase === "thinking";
  const ring = phase === "listening" ? 1 + audio.level * 0.6 : phase === "speaking" ? 1.08 : 1;

  return (
    <div className="mx-auto max-w-2xl">
      <div className="relative overflow-hidden rounded-[32px] bg-gradient-to-b from-[#0b3b36] via-pine to-[#0a2e2a] text-cream shadow-[0_30px_80px_-40px_rgba(15,76,70,0.95)]">
        <div className="pointer-events-none absolute -top-24 left-1/2 size-80 -translate-x-1/2 rounded-full bg-saffron/15 blur-3xl" />

        <div className="relative flex items-center justify-between px-6 pt-5 text-[10px] font-bold uppercase tracking-[0.18em] text-cream/60">
          <span>Voice call · Gnani Prisma + Timbre + Evon</span>
          <span className="tabular-nums">{inCall || phase === "done" ? formatTimer(elapsed) : ""}</span>
        </div>

        <div className="relative flex flex-col items-center px-6 pb-6 pt-8">
          <div className="relative grid size-40 place-items-center">
            {inCall && (
              <span
                className="absolute inset-0 rounded-full bg-saffron/20 transition-transform duration-100"
                style={{ transform: `scale(${ring})` }}
              />
            )}
            {phase === "speaking" && (
              <span className="absolute inset-0 animate-ping rounded-full bg-saffron/15" />
            )}
            <span className="relative grid size-28 place-items-center rounded-full bg-cream text-pine shadow-[0_18px_40px_-18px_rgba(0,0,0,0.7)]">
              {phase === "thinking" ? (
                <Loader2 className="size-10 animate-spin" />
              ) : phase === "listening" ? (
                <Mic className="size-10" />
              ) : (
                <Volume2 className="size-10" />
              )}
            </span>
          </div>
          <h1 className="mt-5 font-display text-3xl font-semibold">ASHA Setu</h1>
          <p className="mt-1 h-5 text-sm font-semibold text-cream/75" aria-live="polite">
            {phase === "idle" ? "Call to report a visit — hands free" : PHASE_COPY[phase]}
          </p>

          {phase === "idle" && (
            <div className="mt-5 flex flex-wrap justify-center gap-2">
              {CALL_LANGUAGES.map((l) => (
                <button
                  key={l.code}
                  type="button"
                  onClick={() => setLanguage(l.code)}
                  aria-pressed={language === l.code}
                  className={`rounded-full px-4 py-2 text-sm font-bold transition ${
                    language === l.code
                      ? "bg-saffron text-ink"
                      : "border border-cream/25 text-cream/85 hover:bg-cream/10"
                  }`}
                >
                  {l.native}
                </button>
              ))}
            </div>
          )}
        </div>

        {lines.length > 0 && (
          <div
            ref={scroller}
            className="relative mx-4 max-h-[42vh] space-y-2 overflow-y-auto rounded-[24px] bg-black/15 p-4"
          >
            {lines.map((line, i) => (
              <div key={i} className={`flex ${line.who === "you" ? "justify-end" : "justify-start"}`}>
                <p
                  className={`max-w-[85%] rounded-2xl px-3.5 py-2 text-sm leading-relaxed ${
                    line.who === "you"
                      ? "rounded-br-md bg-cream text-ink"
                      : "rounded-bl-md bg-white/10 text-cream"
                  }`}
                >
                  {line.text}
                </p>
              </div>
            ))}
          </div>
        )}

        {visit && (
          <div className="relative mx-4 mt-3 flex items-center justify-between gap-3 rounded-[20px] bg-cream/95 px-4 py-3 text-ink">
            <div className="min-w-0">
              <p className="truncate font-display text-lg font-semibold">
                {visit.structured.patient_name ?? "Unnamed patient"}
              </p>
              <p className="truncate text-xs font-semibold text-moss">
                {[
                  visit.structured.age != null && `${visit.structured.age} yrs`,
                  visit.structured.vitals.bp_systolic &&
                    `BP ${visit.structured.vitals.bp_systolic}/${visit.structured.vitals.bp_diastolic}`,
                  visit.structured.pregnancy.months && `${visit.structured.pregnancy.months} months`,
                  visit.structured.follow_up_date && `Follow-up ${visit.structured.follow_up_date}`,
                ]
                  .filter(Boolean)
                  .join(" · ") || "Listening for details…"}
              </p>
            </div>
            <RiskBadge level={visit.risk_level} />
          </div>
        )}

        {error && (
          <p className="relative mx-4 mt-3 rounded-2xl bg-red-500/20 px-4 py-2.5 text-sm font-semibold text-red-50">
            {error}
          </p>
        )}

        <div className="relative flex items-center justify-center gap-4 px-6 pb-7 pt-6">
          {inCall ? (
            <>
              {phase === "listening" && (
                <button
                  type="button"
                  onClick={audio.endTurn}
                  className="inline-flex h-14 items-center gap-2 rounded-full border border-cream/30 px-5 text-sm font-bold"
                >
                  <Hand className="size-4" />
                  Done speaking
                </button>
              )}
              <button
                type="button"
                onClick={hangUp}
                aria-label="End call"
                className="grid size-16 place-items-center rounded-full bg-red-600 text-white shadow-[0_14px_30px_-12px_rgba(220,38,38,0.9)] transition hover:bg-red-700"
              >
                <PhoneOff className="size-6" />
              </button>
            </>
          ) : phase === "done" && visit ? (
            <Link
              to={`/review/${visit.id}`}
              className="inline-flex h-14 items-center gap-2 rounded-full bg-saffron px-6 text-base font-bold text-ink"
            >
              Review &amp; confirm
              <ArrowRight className="size-5" />
            </Link>
          ) : (
            <button
              type="button"
              onClick={() => void start()}
              aria-label="Start call"
              className="grid size-16 place-items-center rounded-full bg-emerald-500 text-white shadow-[0_14px_30px_-12px_rgba(16,185,129,0.9)] transition hover:bg-emerald-600"
            >
              <Phone className="size-6" />
            </button>
          )}
        </div>
      </div>
      <p className="mt-3 text-center text-xs text-moss">
        Speak naturally. When you pause, ASHA Setu asks for anything missing. Nothing is saved until you confirm.
      </p>
    </div>
  );
}
