import type {
  DashboardSummary,
  LoginResponse,
  Patient,
  ReadbackText,
  Visit,
  VisitBrief,
  Worker,
} from "./types";

const BASE = import.meta.env.VITE_API_BASE ?? "";
const TOKEN_KEY = "asha-setu.token";
const WORKER_KEY = "asha-setu.worker";

export class ApiError extends Error {
  status: number;

  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

export class NetworkError extends Error {
  constructor() {
    super("You appear to be offline.");
  }
}

export function getToken(): string | null {
  try {
    return localStorage.getItem(TOKEN_KEY);
  } catch {
    return null;
  }
}

export function getStoredWorker(): Worker | null {
  try {
    const raw = localStorage.getItem(WORKER_KEY);
    return raw ? (JSON.parse(raw) as Worker) : null;
  } catch {
    return null;
  }
}

export function saveSession(token: string, worker: Worker): void {
  localStorage.setItem(TOKEN_KEY, token);
  localStorage.setItem(WORKER_KEY, JSON.stringify(worker));
}

export function clearSession(): void {
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(WORKER_KEY);
}

async function request<T>(
  path: string,
  init: RequestInit = {},
  auth = true,
): Promise<T> {
  const headers = new Headers(init.headers);
  if (auth) {
    const token = getToken();
    if (token) headers.set("Authorization", `Bearer ${token}`);
  }
  if (init.body && !(init.body instanceof FormData)) {
    headers.set("Content-Type", "application/json");
  }

  let response: Response;
  try {
    response = await fetch(`${BASE}${path}`, { ...init, headers });
  } catch {
    throw new NetworkError();
  }

  if (!response.ok) {
    let detail = response.statusText;
    try {
      const body = (await response.json()) as {
        detail?: string | Array<{ msg?: string }>;
      };
      if (typeof body.detail === "string") {
        detail = body.detail;
      } else if (Array.isArray(body.detail)) {
        detail = body.detail.map((item) => item.msg).filter(Boolean).join(", ");
      }
    } catch {
      // Keep the status text.
    }
    if (response.status === 401 && auth) {
      clearSession();
      window.dispatchEvent(new Event("asha:unauthorized"));
    }
    throw new ApiError(response.status, detail);
  }

  if (response.status === 204) return undefined as T;
  const contentType = response.headers.get("content-type") ?? "";
  if (contentType.includes("application/json")) {
    return (await response.json()) as T;
  }
  return (await response.text()) as T;
}

export function login(phone: string, pin: string): Promise<LoginResponse> {
  return request<LoginResponse>(
    "/api/auth/login",
    { method: "POST", body: JSON.stringify({ phone, pin }) },
    false,
  );
}

export function me(): Promise<Worker> {
  return request<Worker>("/api/auth/me");
}

export function getPatients(query?: string): Promise<Patient[]> {
  const search = query ? `?q=${encodeURIComponent(query)}` : "";
  return request<Patient[]>(`/api/patients${search}`);
}

export function getVisits(params: {
  status?: string;
  risk?: string;
  limit?: number;
} = {}): Promise<Visit[]> {
  const search = new URLSearchParams();
  if (params.status) search.set("status", params.status);
  if (params.risk) search.set("risk", params.risk);
  search.set("limit", String(params.limit ?? 50));
  return request<Visit[]>(`/api/visits?${search.toString()}`);
}

export function getVisit(id: string): Promise<Visit> {
  return request<Visit>(`/api/visits/${id}`);
}

function extensionFor(blob: Blob): string {
  if (blob.type.includes("mp4")) return "m4a";
  if (blob.type.includes("ogg")) return "ogg";
  if (blob.type.includes("wav")) return "wav";
  return "webm";
}

export function createDraft(
  blob: Blob,
  options: {
    language: string;
    visitType: string;
    patientId?: number | null;
    clientUuid: string;
  },
): Promise<Visit> {
  const form = new FormData();
  form.append("audio", blob, `visit.${extensionFor(blob)}`);
  form.append("language", options.language);
  form.append("visit_type", options.visitType);
  form.append("client_uuid", options.clientUuid);
  if (options.patientId != null) {
    form.append("patient_id", String(options.patientId));
  }
  return request<Visit>("/api/visits/draft", { method: "POST", body: form });
}

export function confirmVisit(
  id: string,
  body: {
    structured: Visit["structured"];
    patient_id: number | null;
    visit_type: string;
    language: string;
  },
): Promise<Visit> {
  return request<Visit>(`/api/visits/${id}/confirm`, {
    method: "POST",
    body: JSON.stringify(body),
  });
}

export function getReadbackText(id: string, language?: string): Promise<ReadbackText> {
  const search = language ? `?language=${encodeURIComponent(language)}` : "";
  return request<ReadbackText>(`/api/visits/${id}/readback-text${search}`);
}

async function fetchBlob(
  path: string,
  method: string,
  error: string,
  json?: unknown,
): Promise<Blob> {
  const token = getToken();
  const headers: Record<string, string> = token ? { Authorization: `Bearer ${token}` } : {};
  if (json !== undefined) headers["Content-Type"] = "application/json";
  let response: Response;
  try {
    response = await fetch(`${BASE}${path}`, {
      method,
      headers,
      body: json === undefined ? undefined : JSON.stringify(json),
    });
  } catch {
    throw new NetworkError();
  }
  if (!response.ok) throw new ApiError(response.status, error);
  return response.blob();
}

export function getReadbackAudio(id: string, language?: string): Promise<Blob> {
  const search = language ? `?language=${encodeURIComponent(language)}` : "";
  return fetchBlob(
    `/api/visits/${id}/readback${search}`,
    "POST",
    "Could not generate the read-back audio.",
  );
}

export function getAlertAudio(id: string): Promise<Blob> {
  return fetchBlob(`/api/dashboard/alert/${id}`, "POST", "Could not play the alert.");
}

// Call mode
export function getCallGreeting(language: string): Promise<{ text: string }> {
  return request(`/api/call/greeting?language=${encodeURIComponent(language)}`);
}

export function getCallQuestion(
  id: string,
  language: string,
  asked: string[],
): Promise<{ field: string | null; text: string }> {
  const search = new URLSearchParams({ language, asked: asked.join(",") });
  return request(`/api/call/${id}/question?${search.toString()}`);
}

export function speak(text: string, language: string): Promise<Blob> {
  return fetchBlob("/api/call/speak", "POST", "Could not speak.", { text, language });
}

export function answerCall(
  id: string,
  blob: Blob,
  field: string,
  questionAsked: string,
): Promise<{ heard: string; field: string; visit: Visit }> {
  const form = new FormData();
  form.append("audio", blob, `answer.${extensionFor(blob)}`);
  form.append("field", field);
  form.append("question_asked", questionAsked);
  return request(`/api/call/${id}/answer`, { method: "POST", body: form });
}

export function getSummary(): Promise<DashboardSummary> {
  return request<DashboardSummary>("/api/dashboard/summary");
}

export function exportCsv(): Promise<Blob> {
  return fetchBlob("/api/dashboard/export.csv", "GET", "Could not export the CSV.");
}

export type { VisitBrief };
