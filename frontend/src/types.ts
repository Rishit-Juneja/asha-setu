export type RiskLevel = "green" | "amber" | "red";

export interface Worker {
  id: number;
  name: string;
  role: string;
  language: string;
}

export interface Patient {
  id: number;
  name: string;
  age: number | null;
  sex: string | null;
  village: string | null;
  phone: string | null;
  conditions: string[];
  created_at: string;
}

export interface Vitals {
  bp_systolic: number | null;
  bp_diastolic: number | null;
  weight_kg: number | null;
  hemoglobin: number | null;
  temperature_c: number | null;
}

export interface Pregnancy {
  months: number | null;
  weeks: number | null;
  danger_signs: string[];
}

export interface VisitExtract {
  patient_name: string | null;
  age: number | null;
  sex: string | null;
  village: string | null;
  vitals: Vitals;
  pregnancy: Pregnancy;
  symptoms: string[];
  actions_taken: string[];
  referrals: string[];
  follow_up_date: string | null;
  notes: string | null;
  readback_text: string | null;
  missing_fields: string[];
}

export interface Visit {
  id: string;
  transcript: string;
  detected_language: string | null;
  structured: VisitExtract;
  missing_fields: string[];
  risk_level: RiskLevel;
  risk_reasons: string[];
  follow_up_date: string | null;
  status: "draft" | "confirmed";
  created_at: string;
  patient_id: number | null;
  patient_name: string | null;
  worker_name: string | null;
  visit_type: string;
  language: string;
  confirmed_at: string | null;
  stt_model: string | null;
  llm_model: string | null;
  latency_ms: number | null;
}

export interface VisitBrief {
  id: string;
  patient_name: string | null;
  village: string | null;
  visit_type: string;
  risk_level: RiskLevel;
  risk_reasons: string[];
  follow_up_date: string | null;
  created_at: string;
  status: string;
  language: string;
}

export interface DashboardSummary {
  totals: {
    visits: number;
    visits_today: number;
    patients: number;
    workers: number;
    red_last_7d: number;
    amber_last_7d: number;
    overdue_followups: number;
  };
  followups: VisitBrief[];
  recent: VisitBrief[];
}

export interface LoginResponse {
  access_token: string;
  token_type: string;
  worker: Worker;
}

export interface ReadbackText {
  text: string;
  language: string;
  steps?: string[];
}
