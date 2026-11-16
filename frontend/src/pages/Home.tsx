import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ArrowRight,
  CalendarDays,
  ChevronRight,
  ClipboardList,
  FileText,
  Mic,
  ShieldCheck,
  Sparkles,
  TriangleAlert,
  WifiOff,
  Phone,
} from "lucide-react";
import { Link, Navigate } from "react-router-dom";
import { useAuth } from "../auth";
import { cacheVisits, readCachedVisits } from "../cache";
import { getVisits } from "../api";
import { useOnline, useSyncKey } from "../hooks";
import type { Visit, VisitBrief } from "../types";
import {
  formatDay,
  formatDate,
  followUpLabel,
  greetingFor,
  heroLineFor,
  isSupervisor,
  parseDateOnly,
  parseServerDate,
  relativeDay,
  todayKey,
  visitTypeLabel,
} from "../utils";
import { PageHeader } from "../components/PageHeader";
import { PageLoader } from "../components/Spinner";
import { RiskBadge, RiskDot } from "../components/RiskBadge";
import { StatCard } from "../components/StatCard";
import { VisitCard } from "../components/VisitCard";
import { EmptyState } from "../components/EmptyState";

function BriefRow({ visit }: { visit: Visit | VisitBrief }) {
  const name = visit.patient_name ?? "Unnamed patient";
  const village =
    "structured" in visit ? visit.structured.village : visit.village;
  return (
    <Link
      to={`/visits/${visit.id}`}
      className="group flex items-center gap-3 rounded-2xl border border-stone-200/80 bg-cream px-3.5 py-3 transition hover:-translate-y-0.5 hover:border-pine/25 hover:shadow-md"
    >
      <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-paper ring-1 ring-stone-200">
        <RiskDot level={visit.risk_level} />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-sm font-bold text-ink">{name}</span>
        <span className="mt-0.5 block truncate text-[11px] text-moss">
          {village ?? "Village not recorded"} ·{" "}
          {visitTypeLabel(visit.visit_type)} · {relativeDay(visit.created_at)}
        </span>
      </span>
      <ChevronRight className="size-4 shrink-0 text-moss transition group-hover:translate-x-0.5 group-hover:text-pine" />
    </Link>
  );
}

function FollowUpRow({ visit, overdue }: { visit: Visit; overdue: boolean }) {
  const date = parseDateOnly(visit.follow_up_date ?? todayKey());
  return (
    <Link
      to={`/visits/${visit.id}`}
      className="group flex items-center gap-3 rounded-2xl border border-stone-200/80 bg-cream px-3.5 py-3 transition hover:-translate-y-0.5 hover:border-pine/25 hover:shadow-md"
    >
      <span
        className={
          overdue
            ? "grid size-11 shrink-0 place-items-center rounded-xl bg-rose-50 ring-1 ring-rose-200"
            : "grid size-11 shrink-0 place-items-center rounded-xl bg-paper ring-1 ring-stone-200"
        }
      >
        <span className="text-center leading-none">
          <span className="block text-[8px] font-bold uppercase tracking-wider text-moss">
            {date.toLocaleDateString("en-IN", { month: "short" })}
          </span>
          <span className="mt-0.5 block text-sm font-extrabold text-ink">
            {date.getDate()}
          </span>
        </span>
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-sm font-bold text-ink">
          {visit.patient_name ?? visit.structured.patient_name ?? "Unnamed patient"}
        </span>
        <span
          className={
            overdue
              ? "mt-0.5 block truncate text-[11px] font-semibold text-rose-600"
              : "mt-0.5 block truncate text-[11px] text-moss"
          }
        >
          {followUpLabel(visit.follow_up_date)} ·{" "}
          {visit.structured.village ?? "Village not recorded"}
        </span>
      </span>
      <RiskBadge level={visit.risk_level} />
    </Link>
  );
}

export function Home() {
  const { worker } = useAuth();
  const online = useOnline();
  const syncKey = useSyncKey();
  const [visits, setVisits] = useState<Visit[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!worker) return;
    try {
      const data = await getVisits({ limit: 50 });
      setVisits(data);
      setError(null);
      cacheVisits(worker.id, data);
    } catch (caught) {
      const cached = readCachedVisits(worker.id);
      setVisits(cached);
      setError(
        caught instanceof Error ? caught.message : "Could not load your visits.",
      );
    }
  }, [worker]);

  useEffect(() => {
    void load();
  }, [load, syncKey]);

  const derived = useMemo(() => {
    const all = visits ?? [];
    const today = todayKey();
    const confirmed = all.filter((visit) => visit.status === "confirmed");
    const drafts = all.filter((visit) => visit.status === "draft");
    const todayVisits = confirmed.filter(
      (visit) => visit.created_at.slice(0, 10) === today,
    );
    const weekAgo = Date.now() - 7 * 86_400_000;
    const attention = confirmed.filter(
      (visit) =>
        visit.risk_level !== "green" &&
        parseServerDate(visit.created_at).getTime() >= weekAgo,
    );
    const withFollowUp = confirmed.filter((visit) => visit.follow_up_date);
    const overdue = withFollowUp
      .filter((visit) => (visit.follow_up_date ?? "") < today)
      .sort((a, b) => (a.follow_up_date ?? "").localeCompare(b.follow_up_date ?? ""));
    const upcoming = withFollowUp
      .filter((visit) => (visit.follow_up_date ?? "") >= today)
      .sort((a, b) => (a.follow_up_date ?? "").localeCompare(b.follow_up_date ?? ""));
    return {
      confirmed,
      drafts,
      todayVisits,
      attention,
      overdue,
      upcoming,
      followups: [...overdue.slice(0, 2), ...upcoming].slice(0, 4),
      recent: confirmed.slice(0, 4),
    };
  }, [visits]);

  if (!worker) return null;
  if (isSupervisor(worker)) return <Navigate to="/dashboard" replace />;
  if (visits === null) return <PageLoader label="Opening your day" />;

  const firstName = worker.name.split(" ")[0];
  const hasAnyVisits = visits.length > 0;
  const subtitle = [
    `${derived.todayVisits.length} confirmed today`,
    derived.drafts.length > 0
      ? `${derived.drafts.length} draft${derived.drafts.length === 1 ? "" : "s"} to review`
      : null,
    derived.overdue.length > 0
      ? `${derived.overdue.length} overdue follow-up${derived.overdue.length === 1 ? "" : "s"}`
      : null,
  ]
    .filter(Boolean)
    .join(" · ");

  return (
    <div>
      <PageHeader
        eyebrow={formatDay(new Date().toISOString())}
        title={`${greetingFor(worker.language)}, ${firstName}`}
        subtitle={subtitle}
        action={
          <Link
            to="/record"
            className="hidden items-center gap-2 rounded-full bg-pine px-5 py-3 text-sm font-bold text-cream shadow-[0_12px_26px_-14px_rgba(15,76,70,0.9)] transition hover:bg-pine/90 sm:inline-flex"
          >
            <Mic className="size-4" />
            New visit
          </Link>
        }
      />

      <section
        className="relative overflow-hidden rounded-[28px] p-6 text-cream shadow-[0_28px_70px_-38px_rgba(15,76,70,0.9)] md:p-8"
        style={{
          backgroundImage:
            "radial-gradient(circle at 86% 18%, rgba(233,162,59,0.22), transparent 42%), linear-gradient(135deg, #0f4c46 0%, #0b3934 100%)",
        }}
      >
        <div
          className="pointer-events-none absolute -right-16 -top-24 size-72 rounded-full border border-cream/10"
          aria-hidden
        />
        <div className="relative grid items-center gap-6 md:grid-cols-[1fr_auto]">
          <div>
            <span className="inline-flex items-center gap-1.5 rounded-full border border-cream/15 bg-cream/5 px-3 py-1 text-[10px] font-bold uppercase tracking-[0.16em] text-cream/65">
              <Sparkles className="size-3 text-saffron" />
              Voice-first visit
            </span>
            <h2 className="mt-4 max-w-lg font-display text-[2rem] leading-[1.05] font-semibold tracking-tight sm:text-4xl">
              Your voice is the report.
            </h2>
            <p className="mt-2 max-w-md text-sm leading-relaxed text-cream/70">
              {heroLineFor(worker.language)}
            </p>
            <div className="mt-5 flex flex-wrap items-center gap-2.5">
              <Link
                to="/record"
                className="inline-flex items-center gap-2 rounded-full bg-saffron px-5 py-3 text-sm font-extrabold text-pine shadow-lg shadow-black/10 transition hover:bg-amber-300"
              >
                <Mic className="size-4" />
                Start recording
              </Link>
              <Link
                to="/call"
                className="inline-flex items-center gap-2 rounded-full border border-cream/25 px-5 py-3 text-sm font-bold text-cream transition hover:bg-cream/10"
              >
                <Phone className="size-4" />
                Call mode
              </Link>
              <span className="inline-flex items-center gap-1.5 rounded-full border border-cream/15 px-3 py-2 text-[10px] font-bold uppercase tracking-wider text-cream/60">
                {online ? (
                  <>
                    <ShieldCheck className="size-3.5 text-saffron" />
                    Saves locally if offline
                  </>
                ) : (
                  <>
                    <WifiOff className="size-3.5 text-saffron" />
                    Offline ready
                  </>
                )}
              </span>
            </div>
          </div>
          <div className="relative hidden size-40 place-items-center md:grid">
            <span className="absolute inset-0 rounded-full border border-cream/15" />
            <span className="absolute inset-5 rounded-full border border-cream/10" />
            <span className="grid size-24 place-items-center rounded-full bg-cream text-pine shadow-[0_20px_40px_-20px_rgba(0,0,0,0.55)]">
              <Mic className="size-9" strokeWidth={1.8} />
            </span>
            <span className="absolute right-4 top-4 size-3 rounded-full bg-saffron shadow-[0_0_0_5px_rgba(233,162,59,0.15)]" />
          </div>
        </div>
      </section>

      <div className="mt-4 grid grid-cols-2 gap-2.5 md:grid-cols-4 md:gap-3">
        <StatCard
          label="Visits today"
          value={derived.todayVisits.length}
          hint="Confirmed reports"
          icon={ClipboardList}
          tone="pine"
        />
        <StatCard
          label="To review"
          value={derived.drafts.length}
          hint="Voice drafts waiting"
          icon={FileText}
          tone={derived.drafts.length > 0 ? "amber" : "neutral"}
          to={derived.drafts.length > 0 ? "/visits?status=drafts" : undefined}
        />
        <StatCard
          label="Follow-ups"
          value={derived.overdue.length + derived.upcoming.length}
          hint={
            derived.overdue.length > 0
              ? `${derived.overdue.length} overdue`
              : "Next 7 days"
          }
          icon={CalendarDays}
          tone={derived.overdue.length > 0 ? "red" : "neutral"}
        />
        <StatCard
          label="Attention"
          value={derived.attention.length}
          hint="Red or amber, last 7 days"
          icon={TriangleAlert}
          tone={derived.attention.length > 0 ? "red" : "green"}
          to="/visits?status=attention"
        />
      </div>

      {error && online && (
        <div className="mt-4 flex flex-wrap items-center gap-2 rounded-2xl bg-amber-50 px-4 py-3 text-xs font-semibold text-amber-900 ring-1 ring-amber-200">
          <TriangleAlert className="size-4" />
          <span className="flex-1">{error}</span>
          <button
            type="button"
            onClick={() => void load()}
            className="rounded-full bg-amber-900 px-3 py-1.5 text-[11px] font-bold text-amber-50"
          >
            Retry
          </button>
        </div>
      )}

      {derived.drafts.length > 0 && (
        <section className="mt-8">
          <div className="mb-3 flex items-end justify-between gap-3">
            <div>
              <h2 className="font-display text-2xl font-semibold text-ink">
                Needs your review
              </h2>
              <p className="text-xs text-moss">
                A draft is not a report until you confirm it.
              </p>
            </div>
            <Link
              to="/visits?status=drafts"
              className="text-xs font-bold text-pine hover:underline"
            >
              See all
            </Link>
          </div>
          <div className="grid gap-3 md:grid-cols-2">
            {derived.drafts.slice(0, 4).map((visit) => (
              <VisitCard
                key={visit.id}
                visit={visit}
                to={`/review/${visit.id}`}
              />
            ))}
          </div>
        </section>
      )}

      {!hasAnyVisits && !error && (
        <EmptyState
          className="mt-8"
          icon={Mic}
          title="Your first report starts with a voice note"
          body="Tap record, speak naturally in your language, then check what ASHA Setu understood. It will be saved here."
          action={{ label: "Record a visit", to: "/record" }}
        />
      )}

      {hasAnyVisits && (
        <div className="mt-8 grid gap-6 lg:grid-cols-2">
          <section>
            <div className="mb-3 flex items-end justify-between gap-3">
              <div>
                <h2 className="font-display text-2xl font-semibold text-ink">
                  Follow-ups
                </h2>
                <p className="text-xs text-moss">
                  Families to see in the next few days
                </p>
              </div>
              <Link
                to="/visits"
                className="text-xs font-bold text-pine hover:underline"
              >
                All visits
              </Link>
            </div>
            {derived.followups.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-stone-300/80 bg-cream/60 px-4 py-6 text-center text-xs text-moss">
                No follow-ups in the next few days.
              </div>
            ) : (
              <div className="space-y-2">
                {derived.followups.map((visit) => (
                  <FollowUpRow
                    key={visit.id}
                    visit={visit}
                    overdue={(visit.follow_up_date ?? "") < todayKey()}
                  />
                ))}
              </div>
            )}
          </section>

          <section>
            <div className="mb-3 flex items-end justify-between gap-3">
              <div>
                <h2 className="font-display text-2xl font-semibold text-ink">
                  Recent reports
                </h2>
                <p className="text-xs text-moss">Confirmed and on the record</p>
              </div>
              <Link
                to="/record"
                className="inline-flex items-center gap-1 text-xs font-bold text-pine hover:underline"
              >
                New <ArrowRight className="size-3" />
              </Link>
            </div>
            {derived.recent.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-stone-300/80 bg-cream/60 px-4 py-6 text-center text-xs text-moss">
                No confirmed reports yet.
              </div>
            ) : (
              <div className="space-y-2">
                {derived.recent.map((visit) => (
                  <BriefRow key={visit.id} visit={visit} />
                ))}
              </div>
            )}
          </section>
        </div>
      )}

      <section className="mt-8 rounded-[24px] border border-stone-200/80 bg-cream p-5">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-moss">
              How it works
            </p>
            <h2 className="mt-1 font-display text-xl font-semibold text-ink">
              Three steps, one voice note
            </h2>
          </div>
          <p className="text-[11px] text-moss">
            {formatDate(new Date(), true)} · saved on this device
          </p>
        </div>
        <div className="mt-4 grid gap-3 sm:grid-cols-3">
          {[
            {
              icon: Mic,
              title: "Speak",
              body: "Name, BP, pregnancy, medicines, follow-up. Any order.",
            },
            {
              icon: ClipboardList,
              title: "Check",
              body: "Every field is editable. Missing details are flagged.",
            },
            {
              icon: ShieldCheck,
              title: "Read back",
              body: "Hear the report aloud before it is shared.",
            },
          ].map((step, index) => (
            <div
              key={step.title}
              className="rounded-2xl bg-paper/80 px-3.5 py-3.5 ring-1 ring-stone-200/70"
            >
              <div className="flex items-center gap-2">
                <span className="grid size-8 place-items-center rounded-xl bg-pine-soft text-pine">
                  <step.icon className="size-4" />
                </span>
                <span className="text-[10px] font-extrabold text-moss">
                  0{index + 1}
                </span>
              </div>
              <p className="mt-2 text-sm font-bold text-ink">{step.title}</p>
              <p className="mt-0.5 text-[11px] leading-relaxed text-moss">
                {step.body}
              </p>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
