export interface LanguageOption {
  code: string;
  label: string;
  native: string;
}

export const LANGUAGES: LanguageOption[] = [
  { code: "kn-IN", label: "Kannada", native: "ಕನ್ನಡ" },
  { code: "hi-IN,en-IN", label: "Hinglish", native: "Hinglish" },
  { code: "hi-IN", label: "Hindi", native: "हिंदी" },
  { code: "ta-IN", label: "Tamil", native: "தமிழ்" },
  { code: "te-IN", label: "Telugu", native: "తెలుగు" },
  { code: "mr-IN", label: "Marathi", native: "मराठी" },
  { code: "bn-IN", label: "Bengali", native: "বাংলা" },
  { code: "en-IN", label: "English", native: "English" },
];

export const VISIT_TYPES = [
  { code: "anc", label: "Antenatal", short: "ANC" },
  { code: "postnatal", label: "Postnatal", short: "PNC" },
  { code: "immunization", label: "Immunization", short: "Immun." },
  { code: "newborn", label: "Newborn care", short: "Newborn" },
  { code: "general", label: "General check-up", short: "General" },
];

export const DANGER_SIGNS = [
  "bleeding",
  "convulsion",
  "severe headache",
  "blurred vision",
  "no fetal movement",
  "breathlessness",
  "severe abdominal pain",
];

export const COMMON_SYMPTOMS = [
  "fever",
  "swelling",
  "headache",
  "dizziness",
  "breathlessness",
  "bleeding",
  "convulsion",
  "cough",
  "abdominal pain",
  "weakness",
];

export const RISK_COPY = {
  red: { label: "Urgent", sentence: "Needs attention today" },
  amber: { label: "Watch", sentence: "Keep an eye on this" },
  green: { label: "Stable", sentence: "No danger signs recorded" },
} as const;

export const DEMO_ACCOUNTS = [
  {
    name: "Lakshmi",
    role: "ASHA worker",
    phone: "9000000001",
    pin: "1234",
    language: "Kannada",
    note: "Seeded ANC and postnatal visits",
  },
  {
    name: "Priya",
    role: "ASHA worker",
    phone: "9000000003",
    pin: "1234",
    language: "Hinglish",
    note: "A red Hb case and a fever visit",
  },
  {
    name: "Dr. Rao",
    role: "Supervisor",
    phone: "9000000002",
    pin: "1234",
    language: "English",
    note: "Risk dashboard and CSV export",
  },
];
