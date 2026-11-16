import { useCallback, useEffect, useRef, useState } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { db } from "./db";

export function useOnline(): boolean {
  const [online, setOnline] = useState(() => navigator.onLine);
  useEffect(() => {
    const handleOnline = () => setOnline(true);
    const handleOffline = () => setOnline(false);
    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);
    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, []);
  return online;
}

export function useQueueCount(): number {
  return useLiveQuery(() => db.queue.count(), [], 0) ?? 0;
}

export function useQueueItems() {
  return useLiveQuery(() => db.queue.orderBy("created_at").toArray(), [], []);
}

export function useSyncKey(): number {
  const [key, setKey] = useState(0);
  useEffect(() => {
    const handleSynced = () => setKey((current) => current + 1);
    window.addEventListener("asha:synced", handleSynced);
    return () => window.removeEventListener("asha:synced", handleSynced);
  }, []);
  return key;
}

type RecorderState =
  | "idle"
  | "requesting"
  | "recording"
  | "processing"
  | "error";

interface RecorderOptions {
  maxSeconds?: number;
  onComplete: (blob: Blob) => void;
}

export function useRecorder({ maxSeconds = 120, onComplete }: RecorderOptions) {
  const [state, setState] = useState<RecorderState>("idle");
  const [seconds, setSeconds] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<number | null>(null);
  const callbackRef = useRef(onComplete);
  const aliveRef = useRef(true);

  useEffect(() => {
    callbackRef.current = onComplete;
  }, [onComplete]);

  const cleanup = useCallback(() => {
    if (timerRef.current != null) {
      window.clearInterval(timerRef.current);
      timerRef.current = null;
    }
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
    recorderRef.current = null;
  }, []);

  useEffect(
    () => () => {
      aliveRef.current = false;
      const recorder = recorderRef.current;
      if (recorder && recorder.state !== "inactive") {
        try {
          recorder.stop();
        } catch {
          // Ignore teardown errors.
        }
      }
      cleanup();
    },
    [cleanup],
  );

  const stop = useCallback(() => {
    const recorder = recorderRef.current;
    if (recorder && recorder.state === "recording") {
      setState("processing");
      recorder.stop();
    }
  }, []);

  useEffect(() => {
    if (state === "recording" && seconds >= maxSeconds) {
      stop();
    }
  }, [seconds, state, maxSeconds, stop]);

  const start = useCallback(async () => {
    if (
      state === "requesting" ||
      state === "recording" ||
      state === "processing"
    ) {
      return;
    }
    setError(null);
    setSeconds(0);
    if (!navigator.mediaDevices?.getUserMedia) {
      setError("This browser cannot record audio. Try Chrome on Android.");
      setState("error");
      return;
    }
    setState("requesting");
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
      });
      const mimeType = [
        "audio/webm;codecs=opus",
        "audio/webm",
        "audio/mp4",
        "audio/ogg;codecs=opus",
      ].find((type) => MediaRecorder.isTypeSupported(type));
      if (!mimeType) {
        stream.getTracks().forEach((track) => track.stop());
        throw new Error("This browser cannot record a supported audio format.");
      }

      streamRef.current = stream;
      chunksRef.current = [];
      const recorder = new MediaRecorder(stream, { mimeType });
      recorderRef.current = recorder;

      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) chunksRef.current.push(event.data);
      };
      recorder.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: mimeType });
        cleanup();
        if (!aliveRef.current) return;
        setState("idle");
        if (blob.size > 0) {
          callbackRef.current(blob);
        } else {
          setError("No audio was captured. Please try again.");
          setState("error");
        }
      };
      recorder.onerror = () => {
        cleanup();
        setError("Recording failed. Please try again.");
        setState("error");
      };

      recorder.start(250);
      setState("recording");
      timerRef.current = window.setInterval(() => {
        setSeconds((current) => Math.min(current + 1, maxSeconds));
      }, 1000);
    } catch (caught) {
      cleanup();
      let message = "Could not start recording. Please try again.";
      if (caught instanceof DOMException) {
        if (
          caught.name === "NotAllowedError" ||
          caught.name === "SecurityError"
        ) {
          message =
            "Microphone permission is blocked. Allow it in your browser settings and try again.";
        } else if (caught.name === "NotFoundError") {
          message = "No microphone was found on this device.";
        }
      } else if (caught instanceof Error) {
        message = caught.message;
      }
      setError(message);
      setState("error");
    }
  }, [cleanup, maxSeconds, state]);

  const reset = useCallback(() => {
    setError(null);
    setSeconds(0);
    setState("idle");
  }, []);

  return { state, seconds, error, start, stop, reset };
}
