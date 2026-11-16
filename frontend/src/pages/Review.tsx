import { useEffect, useState, type ReactNode } from "react";
import {
  Activity,
  AlertTriangle,
  ArrowLeft,
  Baby,
  CalendarDays,
  CheckCircle2,
  ChevronDown,
  ClipboardList,
  FileText,
  HeartPulse,
  Link2,
  ShieldCheck,
  Sparkles,
  Stethoscope,
  UserRound,
} from "lucide-react";
import { Link, Navigate, useNavigate, useParams } from "react-router-dom";
import { getPatients, getVisit, confirmVisit } from "../api";
import { useAuth } from "../auth";
import {
  COMMON_SYMPTOMS,
  DANGER_SIGNS,
  RISK_COPY,
} from "../constants";
import type { LucideIcon } from "lucide-react";
import type {
  Patient,
  Pregnancy,
  Visit,
  VisitExtract,
  Vitals,
} from "../types";
import {
  cn,
  computeMissing,
  followUpLabel,
  gestationText,
  isSupervisor,
  languageOption,
  numOrNull,
  previewRisk,
  visitTypeLabel,
} from "../utils";
import { useToast } from "../toast";
import { Field, inputClass } from "../components/Field";
import { PageHeader } from "../components/PageHeader";
import { PageLoader, Spinner } from "../components/Spinner";
import { RiskBadge } from "../components/RiskBadge";
import { Steps } from "../components/Steps";
import { TagEditor } from "../components/TagEditor";

function normalizeExtract(value: VisitExtract): VisitExtract {
  return {
    patient_name: value.patient_name ?? null,
    age: value.age ?? null,
    sex: value.sex ?? null,
    village: value.village ?? null,
    vitals: {
      bp_systolic: value.vitals?.bp_systolic ?? null,
      bp_diastolic: value.vitals?.bp_diastolic ?? null,
      weight_kg: value.vitals?.weight_kg ?? null,
      hemoglobin: value.vitals?.hemoglobin ?? null,
      temperature_c: value.vitals?.temperature_c ?? null,
    },
    pregnancy: {
      months: value.pregnancy?.months ?? null,
      weeks: value.pregnancy?.weeks ?? null,
      danger_signs: value.pregnancy?.danger_signs ?? [],
    },
    symptoms: value.symptoms ?? [],
    actions_taken: value.actions_taken ?? [],
    referrals: value.referrals ?? [],
    follow_up_date: value.follow_up_date ?? null,
    notes: value.notes ?? null,
    readback_text: value.readback_text ?? null,
    missing_fields: value.missing_fields ?? [],
  };
}

function FormSection({
  icon: Icon,
  title,
  subtitle,
  badge,
  children,
}: {
  icon: LucideIcon;
  title: string;
  subtitle?: string;
  badge?: string;
  children: ReactNode;
}) {
  return (
    <section className="rounded-[24px] border border-stone-200/80 bg-cream p-4 md:p-5">
      <header className="mb-4 flex items-start gap-2.5">
        <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-pine-soft text-pine">
          <Icon className="size-4" />
        </span>
        <div className="min-w-0 flex-1">
          <h2 className="font-display text-lg leading-tight font-semibold text-ink">
            {title}
          </h2>
          {subtitle && <p className="mt-0.5 text-[11px] text-moss">{subtitle}</p>}
        </div>
        {badge && (
          <span className="rounded-full bg-amber-100 px-2.5 py-1 text-[9px] font-bold uppercase tracking-wider text-amber-800">
            {badge}
          </span>
        )}
      </header>
      {children}
    </section>
  );
}

function TagField({
  label,
  values,
  onChange,
  suggestions,
  missing,
  placeholder,
}: {
  label: string;
  values: string[];
  onChange: (values: string[]) => void;
  suggestions?: string[];
  missing?: boolean;
  placeholder?: string;
}) {
  return (
    <div>
      <div className="mb-1.5 flex items-center justify-between gap-2">
        <span className="text-[12px] font-bold text-ink/75">{label}</span>
        {missing && (
          <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider text-amber-800">
            Needed
          </span>
        )}
      </div>
      <TagEditor
        values={values}
        onChange={onChange}
        suggestions={suggestions}
        placeholder={placeholder}
      />
    </div>
  );
}

export function Review() {
  const { id } = useParams<{ id: string }>();
  const { worker } = useAuth();
  const navigate = useNavigate();
  const { notify } = useToast();
  const [visit, setVisit] = useState<Visit | null>(null);
  const [form, setForm] = useState<VisitExtract | null>(null);
  const [patientId, setPatientId] = useState<number | null>(null);
  const [patients, setPatients] = useState<Patient[]>([]);
  const [visitType, setVisitType] = useState("anc");
  const [language, setLanguage] = useState("kn-IN");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);

  useEffect(() => {
    if (!id) return;
    let cancelled = false;
    setLoading(true);
    Promise.all([getVisit(id), getPatients().catch(() => [] as Patient[])])
      .then(([loadedVisit, loadedPatients]) => {
        if (cancelled) return;
        const normalized = normalizeExtract(loadedVisit.structured);
        setVisit(loadedVisit);
        setForm(normalized);
        setPatients(loadedPatients);
        setVisitType(loadedVisit.visit_type);
        setLanguage(loadedVisit.language);
        const match = loadedPatients.find(
          (patient) =>
            patient.name.toLowerCase() ===
            (normalized.patient_name ?? "").toLowerCase(),
        );
        setPatientId(loadedVisit.patient_id ?? match?.id ?? null);
        setLoadError(null);
      })
      .catch((caught) => {
        if (cancelled) return;
        setLoadError(
          caught instanceof Error ? caught.message : "Could not load this draft.",
        );
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [id]);

  if (!worker) return null;
  if (isSupervisor(worker)) return <Navigate to="/dashboard" replace />;
  if (loading) return <PageLoader label="Opening the draft" />;
  if (loadError || !visit || !form || !id) {
    return (
      <div className="mx-auto max-w-xl">
        <div className="rounded-[24px] border border-rose-200 bg-rose-50 p-6 text-center">
          <AlertTriangle className="mx-auto size-7 text-rose-700" />
          <h1 className="mt-3 font-display text-2xl font-semibold text-ink">
            This draft could not be opened
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

  const missing = new Set(computeMissing(form, visitType));
  const missingLabels: Record<string, string> = {
    patient_name: "patient name",
    age: "age",
    vitals: "vitals or symptoms",
    pregnancy_weeks: "gestation",
    follow_up_date: "follow-up date",
  };
  const missingText = [...missing]
    .map((field) => missingLabels[field] ?? field.replaceAll("_", " "))
    .join(" · ");
  const preview = previewRisk(form);
  const anc = ["anc", "postnatal"].includes(visitType);
  const isConfirmed = visit.status === "confirmed";
  const riskStyles = {
    red: "bg-rose-50 ring-rose-200",
    amber: "bg-amber-50 ring-amber-200",
    green: "bg-emerald-50 ring-emerald-200",
  } as const;
  const RiskIcon =
    preview.level === "green" ? CheckCircle2 : AlertTriangle;

  const setField = <K extends keyof VisitExtract>(
    key: K,
    value: VisitExtract[K],
  ) => {
    setForm((current) => (current ? { ...current, [key]: value } : current));
  };

  const setVital = (key: keyof Vitals, value: number | null) => {
    setForm((current) =>
      current ? { ...current, vitals: { ...current.vitals, [key]: value } } : current,
    );
  };

  const setPregnancy = <K extends keyof Pregnancy>(
    key: K,
    value: Pregnancy[K],
  ) => {
    setForm((current) =>
      current
        ? { ...current, pregnancy: { ...current.pregnancy, [key]: value } }
        : current,
    );
  };

  const handlePatientChange = (value: string) => {
    const nextId = value ? Number(value) : null;
    setPatientId(nextId);
    if (nextId == null) return;
    const patient = patients.find((item) => item.id === nextId);
    if (!patient) return;
    setForm((current) =>
      current
        ? {
            ...current,
            patient_name: current.patient_name || patient.name,
            age: current.age ?? patient.age ?? null,
            sex: current.sex ?? patient.sex ?? null,
            village: current.village ?? patient.village ?? null,
          }
        : current,
    );
  };

  const handleConfirm = async () => {
    if (!id || !form || saving) return;
    setSaving(true);
    setSaveError(null);
    try {
      const confirmed = await confirmVisit(id, {
        structured: { ...form, missing_fields: [] },
        patient_id: patientId,
        visit_type: visitType,
        language,
      });
      notify("Report confirmed. Playing it back now.", "success");
      navigate(`/readback/${id}`, { state: { visit: confirmed } });
    } catch (caught) {
      const message =
        caught instanceof Error
          ? caught.message
          : "Could not confirm the report. Please try again.";
      setSaveError(message);
      notify(message, "error");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div>
      <Link
        to="/visits"
        className="mb-4 inline-flex items-center gap-1.5 text-xs font-bold text-moss transition hover:text-pine"
      >
        <ArrowLeft className="size-3.5" />
        Back to visits
      </Link>
      <PageHeader
        eyebrow={isConfirmed ? "Confirmed report · edit" : "Step 2 of 3 · Draft"}
        title={
          isConfirmed
            ? "Review and re-confirm"
            : `Check ${form.patient_name || "this visit"}`
        }
        subtitle={
          isConfirmed
            ? "Edits are saved when you confirm again. The risk level recalculates."
            : "This is what ASHA Setu understood. Correct anything that sounds wrong before the report is final."
        }
      />
      <Steps current={2} />

      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_320px]">
        <div className="min-w-0 space-y-4">
          <section
            className={cn(
              "rounded-[24px] p-4 ring-1 md:p-5",
              riskStyles[preview.level],
            )}
          >
            <div className="flex items-start gap-3">
              <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-cream/70">
                <RiskIcon
                  className={cn(
                    "size-5",
                    preview.level === "red" && "text-rose-600",
                    preview.level === "amber" && "text-amber-700",
                    preview.level === "green" && "text-emerald-700",
                  )}
                />
              </span>
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <RiskBadge level={preview.level} size="md" />
                  <h2 className="font-display text-lg font-semibold text-ink">
                    {RISK_COPY[preview.level].sentence}
                  </h2>
                </div>
                {preview.reasons.length > 0 ? (
                  <ul className="mt-2 space-y-1 text-xs font-semibold text-ink/70">
                    {preview.reasons.map((reason) => (
                      <li key={reason} className="flex items-start gap-1.5">
                        <span className="mt-1.5 size-1 shrink-0 rounded-full bg-current" />
                        {reason}
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="mt-1.5 text-xs text-ink/60">
                    No danger signs recorded in this draft.
                  </p>
                )}
                <p className="mt-2 text-[10px] font-semibold uppercase tracking-wider text-ink/45">
                  Live risk preview · updates as you edit
                </p>
              </div>
            </div>
          </section>

          <details
            className="group rounded-[24px] border border-stone-200/80 bg-cream p-4 md:p-5"
            open
          >
            <summary className="flex cursor-pointer list-none items-center gap-2.5 [&::-webkit-details-marker]:hidden">
              <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-pine-soft text-pine">
                <FileText className="size-4" />
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-bold text-ink">
                  What Gnani Prisma heard
                </p>
                <p className="text-[11px] text-moss">
                  {languageOption(language).native} · tap to collapse
                </p>
              </div>
              <ChevronDown className="size-4 text-moss transition group-open:rotate-180" />
            </summary>
            <p className="mt-3 border-t border-stone-100 pt-3 text-sm leading-relaxed text-ink/80">
              “{visit.transcript}”
            </p>
          </details>

          <FormSection
            icon={UserRound}
            title="Patient"
            subtitle="The family this visit belongs to"
            badge={missing.has("age") ? "Age needed" : undefined}
          >
            <div className="grid gap-3 sm:grid-cols-2">
              <Field
                label="Name"
                missing={missing.has("patient_name")}
                className="sm:col-span-2"
              >
                <input
                  value={form.patient_name ?? ""}
                  onChange={(event) =>
                    setField("patient_name", event.target.value || null)
                  }
                  placeholder="Name as spoken"
                  className={inputClass(missing.has("patient_name"))}
                />
              </Field>
              <Field label="Age" missing={missing.has("age")}>
                <input
                  value={form.age ?? ""}
                  onChange={(event) => setField("age", numOrNull(event.target.value))}
                  inputMode="numeric"
                  type="number"
                  min={0}
                  max={120}
                  placeholder="Years"
                  className={inputClass(missing.has("age"))}
                />
              </Field>
              <Field label="Sex">
                <select
                  value={form.sex ?? ""}
                  onChange={(event) => setField("sex", event.target.value || null)}
                  className={inputClass()}
                >
                  <option value="">Not recorded</option>
                  <option value="F">Female</option>
                  <option value="M">Male</option>
                  <option value="Other">Other</option>
                </select>
              </Field>
              <Field label="Village" className="sm:col-span-2">
                <input
                  value={form.village ?? ""}
                  onChange={(event) =>
                    setField("village", event.target.value || null)
                  }
                  placeholder="Village or hamlet"
                  className={inputClass()}
                />
              </Field>
            </div>
          </FormSection>

          <FormSection
            icon={Activity}
            title="Vitals"
            subtitle="Leave a field blank if it was not measured"
            badge={missing.has("vitals") ? "Add a vital or symptom" : undefined}
          >
            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <span className="mb-1.5 block text-[12px] font-bold text-ink/75">
                  Blood pressure
                </span>
                <div className="flex items-center gap-2">
                  <input
                    value={form.vitals.bp_systolic ?? ""}
                    onChange={(event) =>
                      setVital("bp_systolic", numOrNull(event.target.value))
                    }
                    inputMode="numeric"
                    type="number"
                    placeholder="140"
                    aria-label="Systolic"
                    className={inputClass(false, "text-center")}
                  />
                  <span className="text-lg font-bold text-moss">/</span>
                  <input
                    value={form.vitals.bp_diastolic ?? ""}
                    onChange={(event) =>
                      setVital("bp_diastolic", numOrNull(event.target.value))
                    }
                    inputMode="numeric"
                    type="number"
                    placeholder="90"
                    aria-label="Diastolic"
                    className={inputClass(false, "text-center")}
                  />
                </div>
                <span className="mt-1 block text-[11px] text-moss">mmHg</span>
              </div>
              <Field label="Haemoglobin">
                <input
                  value={form.vitals.hemoglobin ?? ""}
                  onChange={(event) =>
                    setVital("hemoglobin", numOrNull(event.target.value))
                  }
                  inputMode="decimal"
                  type="number"
                  step="0.1"
                  placeholder="9.5"
                  className={inputClass()}
                />
              </Field>
              <Field label="Temperature">
                <input
                  value={form.vitals.temperature_c ?? ""}
                  onChange={(event) =>
                    setVital("temperature_c", numOrNull(event.target.value))
                  }
                  inputMode="decimal"
                  type="number"
                  step="0.1"
                  placeholder="37.0"
                  className={inputClass()}
                />
              </Field>
              <Field label="Weight">
                <input
                  value={form.vitals.weight_kg ?? ""}
                  onChange={(event) =>
                    setVital("weight_kg", numOrNull(event.target.value))
                  }
                  inputMode="decimal"
                  type="number"
                  step="0.1"
                  placeholder="52"
                  className={inputClass()}
                />
              </Field>
            </div>
          </FormSection>

          {anc && (
            <FormSection
              icon={Baby}
              title="Pregnancy"
              subtitle="Use months or weeks — whichever the worker said"
              badge={missing.has("pregnancy_weeks") ? "Gestation needed" : undefined}
            >
              <div className="grid gap-3 sm:grid-cols-2">
                <Field label="Months">
                  <input
                    value={form.pregnancy.months ?? ""}
                    onChange={(event) =>
                      setPregnancy("months", numOrNull(event.target.value))
                    }
                    inputMode="numeric"
                    type="number"
                    min={0}
                    max={10}
                    placeholder="7"
                    className={inputClass(missing.has("pregnancy_weeks"))}
                  />
                </Field>
                <Field label="Weeks">
                  <input
                    value={form.pregnancy.weeks ?? ""}
                    onChange={(event) =>
                      setPregnancy("weeks", numOrNull(event.target.value))
                    }
                    inputMode="numeric"
                    type="number"
                    min={0}
                    max={45}
                    placeholder="28"
                    className={inputClass(missing.has("pregnancy_weeks"))}
                  />
                </Field>
              </div>
              <div className="mt-3">
                <TagField
                  label="Danger signs"
                  values={form.pregnancy.danger_signs}
                  onChange={(values) => setPregnancy("danger_signs", values)}
                  suggestions={DANGER_SIGNS}
                  placeholder="Add a danger sign"
                />
              </div>
              <p className="mt-2 text-[11px] text-moss">
                {gestationText(form.pregnancy)} recorded · any danger sign makes
                the visit red.
              </p>
            </FormSection>
          )}

          <FormSection
            icon={Stethoscope}
            title="Symptoms"
            subtitle="What the family reported"
          >
            <TagField
              label="Symptoms"
              values={form.symptoms}
              onChange={(values) => setField("symptoms", values)}
              suggestions={COMMON_SYMPTOMS}
              placeholder="Add a symptom"
            />
          </FormSection>

          <FormSection
            icon={ClipboardList}
            title="What was done"
            subtitle="Actions, medicines and referrals"
          >
            <div className="space-y-3">
              <TagField
                label="Actions taken"
                values={form.actions_taken}
                onChange={(values) => setField("actions_taken", values)}
                suggestions={[
                  "IFA tablets given",
                  "BP checked",
                  "weight checked",
                  "counselling given",
                  "paracetamol given",
                ]}
                placeholder="Add an action"
              />
              <TagField
                label="Referrals"
                values={form.referrals}
                onChange={(values) => setField("referrals", values)}
                suggestions={["PHC", "CHC", "district hospital", "supervisor"]}
                placeholder="Where was the family referred?"
              />
            </div>
          </FormSection>

          <FormSection
            icon={CalendarDays}
            title="Follow-up and notes"
            subtitle="When to see this family again"
            badge={missing.has("follow_up_date") ? "Date needed" : undefined}
          >
            <div className="grid gap-3 sm:grid-cols-2">
              <Field
                label="Follow-up date"
                missing={missing.has("follow_up_date")}
                hint={followUpLabel(form.follow_up_date)}
              >
                <input
                  type="date"
                  value={form.follow_up_date ?? ""}
                  onChange={(event) =>
                    setField("follow_up_date", event.target.value || null)
                  }
                  className={inputClass(missing.has("follow_up_date"))}
                />
              </Field>
              <Field label="Notes">
                <input
                  value={form.notes ?? ""}
                  onChange={(event) => setField("notes", event.target.value || null)}
                  placeholder="Anything else worth recording"
                  className={inputClass()}
                />
              </Field>
              <Field
                label="Read-back wording"
                hint="Leave blank to let ASHA Setu phrase it."
                className="sm:col-span-2"
              >
                <textarea
                  value={form.readback_text ?? ""}
                  onChange={(event) =>
                    setField("readback_text", event.target.value || null)
                  }
                  rows={3}
                  placeholder="Optional: the exact words to read aloud"
                  className={inputClass(false, "resize-y")}
                />
              </Field>
            </div>
          </FormSection>
        </div>

        <aside className="space-y-4 self-start lg:sticky lg:top-6">
          <section className="rounded-[24px] border border-stone-200/80 bg-cream p-4">
            <div className="flex items-center justify-between gap-2">
              <h2 className="font-display text-lg font-semibold text-ink">
                Finish this report
              </h2>
              <RiskBadge level={preview.level} />
            </div>
            <div className="mt-3 flex flex-wrap gap-1.5 text-[10px] font-bold text-moss">
              <span className="rounded-full bg-stone-100 px-2.5 py-1">
                {visitTypeLabel(visitType)}
              </span>
              <span className="rounded-full bg-stone-100 px-2.5 py-1">
                {languageOption(language).native}
              </span>
              <span
                className={cn(
                  "rounded-full px-2.5 py-1",
                  missing.size === 0
                    ? "bg-emerald-50 text-emerald-700"
                    : "bg-amber-100 text-amber-800",
                )}
              >
                {missing.size === 0
                  ? "All key fields present"
                  : `Missing: ${missingText}`}
              </span>
            </div>

            <div className="mt-4">
              <label className="mb-1.5 flex items-center gap-1 text-[12px] font-bold text-ink/75">
                <Link2 className="size-3.5" />
                Linked patient
              </label>
              <select
                value={patientId ?? ""}
                onChange={(event) => handlePatientChange(event.target.value)}
                className={inputClass()}
              >
                <option value="">Create from the spoken name</option>
                {patients.map((patient) => (
                  <option key={patient.id} value={patient.id}>
                    {patient.name}
                    {patient.village ? ` · ${patient.village}` : ""}
                  </option>
                ))}
              </select>
              <p className="mt-1.5 text-[10px] leading-relaxed text-moss">
                A matching name is linked automatically. Linking fills age, sex
                and village from the patient record.
              </p>
            </div>

            {saveError && (
              <p className="mt-3 rounded-xl bg-rose-50 px-3 py-2 text-[11px] font-semibold text-rose-700 ring-1 ring-rose-200">
                {saveError}
              </p>
            )}

            <button
              type="button"
              onClick={() => void handleConfirm()}
              disabled={saving}
              className="mt-4 flex w-full items-center justify-center gap-2 rounded-xl bg-pine px-4 py-3.5 text-sm font-bold text-cream shadow-[0_14px_30px_-16px_rgba(15,76,70,0.9)] transition hover:bg-pine/90 disabled:opacity-60"
            >
              {saving ? (
                <Spinner className="size-4" />
              ) : (
                <CheckCircle2 className="size-4" />
              )}
              {isConfirmed ? "Save and read back" : "Confirm & read back"}
            </button>
            <p className="mt-2 text-center text-[10px] font-semibold text-moss/70">
              Edits are saved only when you confirm.
            </p>
          </section>

          <section className="rounded-[24px] border border-stone-200/80 bg-cream p-4">
            <div className="flex items-center gap-2">
              <Sparkles className="size-4 text-saffron" />
              <h2 className="text-sm font-bold text-ink">Report source</h2>
            </div>
            <dl className="mt-3 space-y-2 text-[11px]">
              <div className="flex justify-between gap-3">
                <dt className="text-moss">Heard in</dt>
                <dd className="text-right font-semibold text-ink">
                  {languageOption(visit.detected_language ?? language).native}
                </dd>
              </div>
              <div className="flex justify-between gap-3">
                <dt className="text-moss">Speech model</dt>
                <dd className="text-right font-semibold text-ink">
                  {visit.stt_model ?? "—"}
                </dd>
              </div>
              <div className="flex justify-between gap-3">
                <dt className="text-moss">Report model</dt>
                <dd className="text-right font-semibold text-ink">
                  {visit.llm_model ?? "—"}
                </dd>
              </div>
              <div className="flex justify-between gap-3">
                <dt className="text-moss">Latency</dt>
                <dd className="text-right font-semibold text-ink">
                  {visit.latency_ms != null
                    ? `${(visit.latency_ms / 1000).toFixed(1)}s`
                    : "—"}
                </dd>
              </div>
            </dl>
            <div className="mt-3 flex items-start gap-1.5 rounded-xl bg-pine-soft/60 px-2.5 py-2 text-[10px] leading-relaxed text-pine">
              <ShieldCheck className="mt-0.5 size-3.5 shrink-0" />
              ASHA Setu never invents clinical details. Empty fields stay empty
              until you add them.
            </div>
          </section>

          <section className="rounded-[24px] border border-stone-200/80 bg-cream p-4">
            <div className="flex items-center gap-2">
              <HeartPulse className="size-4 text-clay" />
              <h2 className="text-sm font-bold text-ink">Why this matters</h2>
            </div>
            <p className="mt-2 text-[11px] leading-relaxed text-moss">
              Red flags reach the supervisor as soon as this report is confirmed.
              If you are unsure, leave the field blank — never guess a number.
            </p>
          </section>
        </aside>
      </div>
    </div>
  );
}
