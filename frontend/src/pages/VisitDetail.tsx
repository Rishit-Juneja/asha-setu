import { useEffect, useState } from "react";
import {
  Activity,
  AlertTriangle,
  ArrowLeft,
  Baby,
  CalendarDays,
  ClipboardList,
  FileText,
  HeartPulse,
  MapPin,
  Pencil,
  Play,
  ShieldCheck,
  Stethoscope,
  UserRound,
} from "lucide-react";
import { Link, useParams } from "react-router-dom";
import { getVisit } from "../api";
import type { Visit } from "../types";
import {
  bpText,
  cn,
  formatDate,
  followUpLabel,
  gestationText,
  languageOption,
  relativeDay,
  visitTypeLabel,
} from "../utils";
import { EmptyState } from "../components/EmptyState";
import { RiskBadge } from "../components/RiskBadge";
import { PageLoader, Spinner } from "../components/Spinner";

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-start justify-between gap-3 border-b border-stone-100 py-2 last:border-0 last:pb-0">
      <span className="text-[11px] text-moss">{label}</span>
      <span className="text-right text-[11px] font-semibold text-ink">{value}</span>
    </div>
  );
}

function TagList({ values }: { values: string[] }) {
  if (values.length === 0) {
    return <p className="text-xs text-moss/70">Not recorded</p>;
  }
  return (
    <div className="flex flex-wrap gap-1.5">
      {values.map((value) => (
        <span
          key={value}
          className="rounded-full bg-pine-soft px-2.5 py-1 text-[11px] font-semibold text-pine"
        >
          {value}
        </span>
      ))}
    </div>
  );
}

export function VisitDetail() {
  const { id } = useParams<{ id: string }>();
  const [visit, setVisit] = useState<Visit | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!id) return;
    let cancelled = false;
    setLoading(true);
    getVisit(id)
      .then((loaded) => {
        if (!cancelled) {
          setVisit(loaded);
          setError(null);
        }
      })
      .catch((caught) => {
        if (!cancelled) {
          setError(
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
  }, [id]);

  if (loading) return <PageLoader label="Opening the report" />;
  if (error || !visit || !id) {
    return (
      <EmptyState
        icon={AlertTriangle}
        title="This report could not be opened"
        body={error ?? "The visit was not found, or it belongs to another worker."}
        action={{ label: "Back to visits", to: "/visits" }}
      />
    );
  }

  const structured = visit.structured;
  const name = visit.patient_name ?? structured.patient_name ?? "Unnamed patient";
  const isDraft = visit.status === "draft";
  const anc = ["anc", "postnatal"].includes(visit.visit_type);
  const vitals = structured.vitals;

  return (
    <div>
      <Link
        to="/visits"
        className="mb-4 inline-flex items-center gap-1.5 text-xs font-bold text-moss transition hover:text-pine"
      >
        <ArrowLeft className="size-3.5" />
        Back to visits
      </Link>

      <header className="mb-5 flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <RiskBadge level={visit.risk_level} size="md" />
            <span className="rounded-full bg-stone-100 px-2.5 py-1 text-[10px] font-bold text-moss">
              {visitTypeLabel(visit.visit_type)}
            </span>
            {isDraft && (
              <span className="rounded-full bg-amber-100 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-amber-800">
                Draft
              </span>
            )}
          </div>
          <h1 className="mt-2 font-display text-3xl font-semibold tracking-tight text-ink md:text-4xl">
            {name}
          </h1>
          <p className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-moss">
            <span className="inline-flex items-center gap-1">
              <MapPin className="size-3.5" />
              {structured.village ?? "Village not recorded"}
            </span>
            <span className="inline-flex items-center gap-1">
              <CalendarDays className="size-3.5" />
              {formatDate(visit.created_at, true)} · {relativeDay(visit.created_at)}
            </span>
            {visit.worker_name && (
              <span className="inline-flex items-center gap-1">
                <UserRound className="size-3.5" />
                {visit.worker_name}
              </span>
            )}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {isDraft ? (
            <Link
              to={`/review/${visit.id}`}
              className="inline-flex items-center gap-2 rounded-full bg-pine px-5 py-2.5 text-sm font-bold text-cream"
            >
              <Pencil className="size-4" />
              Review & confirm
            </Link>
          ) : (
            <Link
              to={`/readback/${visit.id}`}
              className="inline-flex items-center gap-2 rounded-full bg-pine px-5 py-2.5 text-sm font-bold text-cream"
            >
              <Play className="size-4" />
              Play read-back
            </Link>
          )}
        </div>
      </header>

      {isDraft && (
        <div className="mb-5 flex flex-wrap items-center gap-2 rounded-2xl bg-amber-50 px-4 py-3 text-xs font-semibold text-amber-900 ring-1 ring-amber-200">
          <AlertTriangle className="size-4 shrink-0" />
          <span className="flex-1">
            This report is still a draft. Confirm it before it reaches your
            supervisor.
          </span>
          <Link
            to={`/review/${visit.id}`}
            className="rounded-full bg-amber-900 px-3 py-1.5 text-[10px] font-bold text-amber-50"
          >
            Review now
          </Link>
        </div>
      )}

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_300px]">
        <div className="space-y-4">
          <section className="rounded-[24px] border border-stone-200/80 bg-cream p-4 md:p-5">
            <div className="flex items-center gap-2">
              <span className="grid size-9 place-items-center rounded-xl bg-pine-soft text-pine">
                <Activity className="size-4" />
              </span>
              <h2 className="font-display text-lg font-semibold text-ink">
                Vitals
              </h2>
            </div>
            <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
              {[
                {
                  label: "Blood pressure",
                  value:
                    vitals.bp_systolic != null && vitals.bp_diastolic != null
                      ? `${vitals.bp_systolic}/${vitals.bp_diastolic}`
                      : "—",
                  unit: "mmHg",
                },
                {
                  label: "Haemoglobin",
                  value: vitals.hemoglobin ?? "—",
                  unit: "g/dL",
                },
                {
                  label: "Temperature",
                  value: vitals.temperature_c ?? "—",
                  unit: "°C",
                },
                {
                  label: "Weight",
                  value: vitals.weight_kg ?? "—",
                  unit: "kg",
                },
              ].map((item) => (
                <div
                  key={item.label}
                  className="rounded-2xl bg-paper/80 px-3 py-3 ring-1 ring-stone-200/60"
                >
                  <p className="text-[9px] font-bold uppercase tracking-wider text-moss">
                    {item.label}
                  </p>
                  <p className="mt-1 font-display text-2xl leading-none font-semibold text-ink">
                    {item.value}
                  </p>
                  <p
                    className={cn(
                      "mt-1 text-[9px]",
                      item.value === "—" ? "text-moss/60" : "text-moss/70",
                    )}
                  >
                    {item.value === "—" ? "not recorded" : item.unit}
                  </p>
                </div>
              ))}
            </div>
          </section>

          {anc && (
            <section className="rounded-[24px] border border-stone-200/80 bg-cream p-4 md:p-5">
              <div className="flex items-center gap-2">
                <span className="grid size-9 place-items-center rounded-xl bg-pine-soft text-pine">
                  <Baby className="size-4" />
                </span>
                <h2 className="font-display text-lg font-semibold text-ink">
                  Pregnancy
                </h2>
              </div>
              <div className="mt-3 flex flex-wrap items-center gap-2">
                <span className="rounded-full bg-stone-100 px-3 py-1.5 text-xs font-bold text-ink/75">
                  {gestationText(structured.pregnancy)}
                </span>
                {structured.pregnancy.months != null &&
                  structured.pregnancy.weeks != null && (
                    <span className="rounded-full bg-stone-100 px-3 py-1.5 text-xs font-bold text-ink/75">
                      {structured.pregnancy.weeks} weeks
                    </span>
                  )}
              </div>
              <div className="mt-3">
                <p className="mb-1.5 text-[10px] font-bold uppercase tracking-wider text-moss">
                  Danger signs
                </p>
                <TagList values={structured.pregnancy.danger_signs} />
              </div>
            </section>
          )}

          <section className="rounded-[24px] border border-stone-200/80 bg-cream p-4 md:p-5">
            <div className="flex items-center gap-2">
              <span className="grid size-9 place-items-center rounded-xl bg-pine-soft text-pine">
                <Stethoscope className="size-4" />
              </span>
              <h2 className="font-display text-lg font-semibold text-ink">
                Symptoms and care
              </h2>
            </div>
            <div className="mt-3 space-y-3">
              <div>
                <p className="mb-1.5 text-[10px] font-bold uppercase tracking-wider text-moss">
                  Symptoms
                </p>
                <TagList values={structured.symptoms} />
              </div>
              <div>
                <p className="mb-1.5 text-[10px] font-bold uppercase tracking-wider text-moss">
                  Actions taken
                </p>
                <TagList values={structured.actions_taken} />
              </div>
              <div>
                <p className="mb-1.5 text-[10px] font-bold uppercase tracking-wider text-moss">
                  Referrals
                </p>
                <TagList values={structured.referrals} />
              </div>
            </div>
          </section>

          <section className="rounded-[24px] border border-stone-200/80 bg-cream p-4 md:p-5">
            <div className="flex items-center gap-2">
              <span className="grid size-9 place-items-center rounded-xl bg-pine-soft text-pine">
                <ClipboardList className="size-4" />
              </span>
              <h2 className="font-display text-lg font-semibold text-ink">
                Follow-up and notes
              </h2>
            </div>
            <div className="mt-3 grid gap-3 sm:grid-cols-2">
              <div className="rounded-2xl bg-paper/80 px-3 py-2.5 ring-1 ring-stone-200/60">
                <p className="text-[9px] font-bold uppercase tracking-wider text-moss">
                  Follow-up
                </p>
                <p
                  className={cn(
                    "mt-0.5 text-sm font-bold",
                    (visit.follow_up_date ?? "") <
                      new Date().toISOString().slice(0, 10)
                      ? "text-rose-600"
                      : "text-ink",
                  )}
                >
                  {followUpLabel(visit.follow_up_date)}
                </p>
              </div>
              <div className="rounded-2xl bg-paper/80 px-3 py-2.5 ring-1 ring-stone-200/60">
                <p className="text-[9px] font-bold uppercase tracking-wider text-moss">
                  Notes
                </p>
                <p className="mt-0.5 text-sm text-ink/80">
                  {structured.notes || "None"}
                </p>
              </div>
            </div>
          </section>

          <section className="rounded-[24px] border border-stone-200/80 bg-cream p-4 md:p-5">
            <div className="flex items-center gap-2">
              <span className="grid size-9 place-items-center rounded-xl bg-pine-soft text-pine">
                <FileText className="size-4" />
              </span>
              <h2 className="font-display text-lg font-semibold text-ink">
                Transcript
              </h2>
            </div>
            <p className="mt-3 text-sm leading-relaxed text-ink/80">
              “{visit.transcript}”
            </p>
            <p className="mt-2 text-[10px] font-semibold uppercase tracking-wider text-moss/60">
              Heard in {languageOption(visit.detected_language ?? visit.language).native}
            </p>
          </section>
        </div>

        <aside className="space-y-4 self-start">
          {visit.risk_reasons.length > 0 && (
            <section className="rounded-[24px] border border-amber-200 bg-amber-50 p-4">
              <div className="flex items-center gap-2">
                <AlertTriangle className="size-4 text-amber-700" />
                <h2 className="text-sm font-bold text-amber-900">Why flagged</h2>
              </div>
              <ul className="mt-2 space-y-1 text-[11px] font-semibold text-amber-900">
                {visit.risk_reasons.map((reason) => (
                  <li key={reason} className="flex items-start gap-1.5">
                    <span className="mt-1.5 size-1 shrink-0 rounded-full bg-amber-700" />
                    {reason}
                  </li>
                ))}
              </ul>
            </section>
          )}

          <section className="rounded-[24px] border border-stone-200/80 bg-cream p-4">
            <div className="flex items-center gap-2">
              <UserRound className="size-4 text-pine" />
              <h2 className="text-sm font-bold text-ink">Patient</h2>
            </div>
            <div className="mt-2">
              <InfoRow label="Name" value={name} />
              <InfoRow
                label="Age"
                value={structured.age != null ? `${structured.age} years` : "—"}
              />
              <InfoRow label="Sex" value={structured.sex ?? "—"} />
              <InfoRow label="Village" value={structured.village ?? "—"} />
              <InfoRow
                label="Linked record"
                value={visit.patient_id != null ? "Yes" : "Created from voice"}
              />
            </div>
          </section>

          <section className="rounded-[24px] border border-stone-200/80 bg-cream p-4">
            <div className="flex items-center gap-2">
              <ShieldCheck className="size-4 text-pine" />
              <h2 className="text-sm font-bold text-ink">Report source</h2>
            </div>
            <div className="mt-2">
              <InfoRow label="Language" value={languageOption(visit.language).native} />
              <InfoRow label="Speech model" value={visit.stt_model ?? "—"} />
              <InfoRow label="Report model" value={visit.llm_model ?? "—"} />
              <InfoRow
                label="Latency"
                value={
                  visit.latency_ms != null
                    ? `${(visit.latency_ms / 1000).toFixed(1)}s`
                    : "—"
                }
              />
              <InfoRow
                label="Confirmed"
                value={
                  visit.confirmed_at ? formatDate(visit.confirmed_at, true) : "Not yet"
                }
              />
            </div>
          </section>

          {structured.missing_fields.length > 0 && (
            <section className="rounded-[24px] border border-stone-200/80 bg-cream p-4">
              <div className="flex items-center gap-2">
                <HeartPulse className="size-4 text-clay" />
                <h2 className="text-sm font-bold text-ink">Missing details</h2>
              </div>
              <div className="mt-2 flex flex-wrap gap-1.5">
                {structured.missing_fields.map((field) => (
                  <span
                    key={field}
                    className="rounded-full bg-amber-100 px-2.5 py-1 text-[10px] font-bold text-amber-800"
                  >
                    {field.replaceAll("_", " ")}
                  </span>
                ))}
              </div>
            </section>
          )}
        </aside>
      </div>
    </div>
  );
}
