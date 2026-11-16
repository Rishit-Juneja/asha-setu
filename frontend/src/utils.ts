import { DANGER_SIGNS, LANGUAGES, VISIT_TYPES } from "./constants";
import type { LanguageOption } from "./constants";
import type {
  Patient,
  Pregnancy,
  RiskLevel,
  VisitExtract,
  Vitals,
  Worker,
} from "./types";

export function cn(...classes: Array<string | false | null | undefined>): string {
  return classes.filter(Boolean).join(" ");
}

export function initials(name: string): string {
  return name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("");
}

export function parseServerDate(value: string): Date {
  if (/[zZ]|[+-]\d{2}:?\d{2}$/.test(value)) return new Date(value);
  return new Date(`${value}Z`);
}

export function parseDateOnly(value: string): Date {
  const [year, month, day] = value.split("-").map(Number);
  return new Date(year, month - 1, day);
}

export function formatDate(value: string | Date, withTime = false): string {
  const date = typeof value === "string" ? parseServerDate(value) : value;
  return date.toLocaleDateString("en-IN", {
    day: "numeric",
    month: "short",
    year: date.getFullYear() === new Date().getFullYear() ? undefined : "numeric",
    ...(withTime ? { hour: "numeric", minute: "2-digit" } : {}),
  });
}

export function formatDay(value: string): string {
  const date = typeof value === "string" ? parseServerDate(value) : value;
  return date.toLocaleDateString("en-IN", {
    weekday: "long",
    day: "numeric",
    month: "long",
  });
}

export function relativeDay(value: string): string {
  const date = parseServerDate(value);
  const start = new Date();
  start.setHours(0, 0, 0, 0);
  const day = new Date(date);
  day.setHours(0, 0, 0, 0);
  const diff = Math.round((day.getTime() - start.getTime()) / 86_400_000);
  if (diff === 0) return "Today";
  if (diff === -1) return "Yesterday";
  if (diff === 1) return "Tomorrow";
  if (diff < 0) return `${Math.abs(diff)} days ago`;
  return `In ${diff} days`;
}

export function followUpLabel(value: string | null | undefined): string {
  if (!value) return "No follow-up set";
  const date = parseDateOnly(value);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const diff = Math.round((date.getTime() - today.getTime()) / 86_400_000);
  if (diff < 0) return `Overdue · ${formatDate(date)}`;
  if (diff === 0) return "Follow-up today";
  if (diff === 1) return "Follow-up tomorrow";
  return `Follow-up · ${formatDate(date)}`;
}

export function timeAgo(value: string): string {
  const date = parseServerDate(value);
  const seconds = Math.max(1, Math.round((Date.now() - date.getTime()) / 1000));
  if (seconds < 60) return "just now";
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return `${minutes} min ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours} hr ago`;
  const days = Math.round(hours / 24);
  if (days < 7) return `${days} day${days === 1 ? "" : "s"} ago`;
  return formatDate(value);
}

export function languageOption(code: string): LanguageOption {
  return (
    LANGUAGES.find((language) => language.code === code) ?? {
      code,
      label: code || "Unknown",
      native: code,
    }
  );
}

export function visitTypeLabel(code: string): string {
  return VISIT_TYPES.find((type) => type.code === code)?.label ?? code;
}

export function bpText(vitals: Vitals): string {
  if (vitals.bp_systolic == null || vitals.bp_diastolic == null) return "BP not recorded";
  return `BP ${vitals.bp_systolic}/${vitals.bp_diastolic}`;
}

export function gestationText(pregnancy: Pregnancy): string {
  if (pregnancy.months != null) return `${pregnancy.months} months`;
  if (pregnancy.weeks != null) return `${pregnancy.weeks} weeks`;
  return "Gestation not recorded";
}

export function isSupervisor(worker: Worker | null): boolean {
  return worker?.role === "supervisor" || worker?.role === "admin";
}

export function numOrNull(value: string): number | null {
  const trimmed = value.trim();
  if (trimmed === "") return null;
  const parsed = Number(trimmed);
  return Number.isFinite(parsed) ? parsed : null;
}

export function computeMissing(extract: VisitExtract, visitType: string): string[] {
  const missing: string[] = [];
  if (!extract.patient_name?.trim()) missing.push("patient_name");
  if (extract.age == null) missing.push("age");
  const vitals = extract.vitals;
  const hasVitals = [
    vitals.bp_systolic,
    vitals.bp_diastolic,
    vitals.weight_kg,
    vitals.hemoglobin,
    vitals.temperature_c,
  ].some((value) => value !== null && value !== undefined);
  if (!hasVitals && extract.symptoms.length === 0) missing.push("vitals");
  if (
    ["anc", "postnatal"].includes(visitType) &&
    extract.pregnancy.months == null &&
    extract.pregnancy.weeks == null
  ) {
    missing.push("pregnancy_weeks");
  }
  if (!extract.follow_up_date) missing.push("follow_up_date");
  return missing;
}

export function previewRisk(extract: VisitExtract): {
  level: RiskLevel;
  reasons: string[];
} {
  let level: RiskLevel = "green";
  const reasons: string[] = [];
  const rank: Record<RiskLevel, number> = { green: 0, amber: 1, red: 2 };
  const bump = (candidate: RiskLevel) => {
    if (rank[candidate] > rank[level]) level = candidate;
  };

  const vitals = extract.vitals;
  if (vitals.bp_systolic != null && vitals.bp_diastolic != null) {
    if (vitals.bp_systolic >= 160 || vitals.bp_diastolic >= 110) {
      bump("red");
      reasons.push(
        `BP ${vitals.bp_systolic}/${vitals.bp_diastolic} is severely high`,
      );
    } else if (vitals.bp_systolic >= 140 || vitals.bp_diastolic >= 90) {
      bump("amber");
      reasons.push(`BP ${vitals.bp_systolic}/${vitals.bp_diastolic} is high`);
    }
  }
  if (vitals.hemoglobin != null) {
    if (vitals.hemoglobin < 7) {
      bump("red");
      reasons.push(`Hb ${vitals.hemoglobin} is severely low`);
    } else if (vitals.hemoglobin < 9) {
      bump("amber");
      reasons.push(`Hb ${vitals.hemoglobin} is low`);
    }
  }
  if (vitals.temperature_c != null) {
    if (vitals.temperature_c >= 39) {
      bump("red");
      reasons.push(`Temperature ${vitals.temperature_c}C is very high`);
    } else if (vitals.temperature_c >= 38) {
      bump("amber");
      reasons.push(`Temperature ${vitals.temperature_c}C is high`);
    }
  }

  const signs = [
    ...extract.pregnancy.danger_signs,
    ...extract.symptoms,
  ].map((sign) => sign.toLowerCase());
  for (const danger of DANGER_SIGNS) {
    if (signs.some((sign) => sign.includes(danger))) {
      bump("red");
      reasons.push(`Danger sign reported: ${danger}`);
    }
  }

  const hasVitals = [
    vitals.bp_systolic,
    vitals.bp_diastolic,
    vitals.weight_kg,
    vitals.hemoglobin,
    vitals.temperature_c,
  ].some((value) => value != null);
  if (!hasVitals && extract.symptoms.length === 0 && level === "green") {
    bump("amber");
    reasons.push("No vitals or symptoms recorded");
  }

  return { level, reasons };
}

export function composeReadback(visit: {
  structured: VisitExtract;
  risk_reasons: string[];
  follow_up_date: string | null;
}): string {
  const structured = visit.structured;
  const parts = ["Report recorded."];
  if (structured.patient_name) parts.push(`${structured.patient_name}.`);
  if (
    structured.vitals.bp_systolic != null &&
    structured.vitals.bp_diastolic != null
  ) {
    parts.push(
      `BP ${structured.vitals.bp_systolic}/${structured.vitals.bp_diastolic}.`,
    );
  }
  if (structured.pregnancy.months != null) {
    parts.push(`${structured.pregnancy.months} months pregnancy.`);
  } else if (structured.pregnancy.weeks != null) {
    parts.push(`${structured.pregnancy.weeks} weeks pregnancy.`);
  }
  if (structured.follow_up_date) {
    parts.push(`Follow-up ${formatDate(parseDateOnly(structured.follow_up_date))}.`);
  }
  if (visit.risk_reasons.length > 0) {
    parts.push(`${visit.risk_reasons.slice(0, 2).join("; ")}.`);
  }
  return parts.join(" ");
}

export function patientLabel(patient: Patient): string {
  const bits = [patient.village, patient.age ? `${patient.age} yrs` : null].filter(Boolean);
  return bits.length ? `${patient.name} · ${bits.join(" · ")}` : patient.name;
}

export function greetingFor(language: string): string {
  if (language.startsWith("kn")) return "ನಮಸ್ಕಾರ";
  if (language === "hi-IN,en-IN") return "Namaste";
  if (language.startsWith("hi")) return "नमस्ते";
  if (language.startsWith("ta")) return "வணக்கம்";
  if (language.startsWith("te")) return "నమస్కారం";
  return "Hello";
}

export function heroLineFor(language: string): string {
  if (language.startsWith("kn")) return "ಕನ್ನಡದಲ್ಲಿ ಮಾತನಾಡಿ. ವರದಿ ನಾವು ಬರೆಯುತ್ತೇವೆ.";
  if (language === "hi-IN,en-IN") return "Aap boliye. Report hum likhenge.";
  if (language.startsWith("hi")) return "अपनी बात कहिए. रिपोर्ट हम लिखेंगे.";
  return "Speak naturally. We write the report.";
}

export function todayKey(): string {
  return new Date().toISOString().slice(0, 10);
}
