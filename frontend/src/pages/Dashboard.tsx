import { useCallback, useEffect, useRef, useState } from "react";
import {
  Activity,
  AlertTriangle,
  ArrowRight,
  CalendarDays,
  ChevronRight,
  ClipboardList,
  CloudOff,
  Download,
  RefreshCw,
  Siren,
  Users,
  Volume2,
  X,
} from "lucide-react";
import { Link, Navigate } from "react-router-dom";
import { exportCsv, getAlertAudio, getSummary, getVisits } from "../api";
import { useAuth } from "../auth";
import { cacheSummary, readCachedSummary } from "../cache";
import { useOnline } from "../hooks";
import { useToast } from "../toast";
import type { DashboardSummary, Visit, VisitBrief } from "../types";
import {
  followUpLabel,
  formatDate,
  isSupervisor,
  parseDateOnly,
  relativeDay,
  todayKey,
  visitTypeLabel,
} from "../utils";
import { PageHeader } from "../components/PageHeader";
import { PageLoader, Spinner } from "../components/Spinner";
import { RiskBadge, RiskDot } from "../components/RiskBadge";
import { StatCard } from "../components/StatCard";

function FollowUpRow({ item }: { item: VisitBrief }) {
  const date = parseDateOnly(item.follow_up_date ?? todayKey());
  const overdue =
    (item.follow_up_date ?? todayKey()) < new Date().toISOString().slice(0, 10);
  return (
    <Link
      to={`/visits/${item.id}`}
      className="group flex items-center gap-3 rounded-2xl border border-stone-200/80 bg-paper/50 px-3 py-2.5 transition hover:-translate-y-0.5 hover:border-pine/25 hover:bg-cream hover:shadow-md"
    >
      <span
        className={
          overdue
            ? "grid size-11 shrink-0 place-items-center rounded-xl bg-rose-50 ring-1 ring-rose-200"
            : "grid size-11 shrink-0 place-items-center rounded-xl bg-cream ring-1 ring-stone-200"
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
          {item.patient_name ?? "Unnamed patient"}
        </span>
        <span
          className={
            overdue
              ? "mt-0.5 block truncate text-[11px] font-semibold text-rose-600"
              : "mt-0.5 block truncate text-[11px] text-moss"
          }
        >
          {followUpLabel(item.follow_up_date)} ·{" "}
          {item.village ?? "Village not recorded"}
        </span>
      </span>
      <RiskBadge level={item.risk_level} />
    </Link>
  );
}

function RecentRow({ item }: { item: VisitBrief }) {
  return (
    <Link
      to={`/visits/${item.id}`}
      className="group flex items-center gap-3 rounded-2xl border border-stone-200/80 bg-paper/50 px-3 py-2.5 transition hover:-translate-y-0.5 hover:border-pine/25 hover:bg-cream hover:shadow-md"
    >
      <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-cream ring-1 ring-stone-200">
        <RiskDot level={item.risk_level} />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-sm font-bold text-ink">
          {item.patient_name ?? "Unnamed patient"}
        </span>
        <span className="mt-0.5 block truncate text-[11px] text-moss">
          {visitTypeLabel(item.visit_type)} · {item.village ?? "Village not recorded"} ·{" "}
          {relativeDay(item.created_at)}
        </span>
      </span>
      <span className="hidden shrink-0 text-[10px] font-semibold text-moss/70 sm:block">
        {formatDate(item.created_at, true)}
      </span>
      <ChevronRight className="size-4 shrink-0 text-moss transition group-hover:translate-x-0.5 group-hover:text-pine" />
    </Link>
  );
}

export function Dashboard() {
  const { worker } = useAuth();
  const online = useOnline();
  const { notify } = useToast();
  const [summary, setSummary] = useState<DashboardSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [updatedAt, setUpdatedAt] = useState<Date | null>(null);

  const load = useCallback(
    async (isRefresh = false) => {
      if (!worker) return;
      if (isRefresh) setRefreshing(true);
      try {
        const data = await getSummary();
        setSummary(data);
        cacheSummary(worker.id, data);
        setUpdatedAt(new Date());
        setError(null);
      } catch (caught) {
        const cached = readCachedSummary(worker.id);
        if (cached) setSummary(cached);
        setError(
          caught instanceof Error
            ? caught.message
            : "Could not load the dashboard.",
        );
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [worker],
  );

  useEffect(() => {
    void load();
  }, [load]);

  // Live red alerts: poll for new red reports, speak them with Timbre.
  // ponytail: 10s polling, switch to SSE if the block grows past a few hundred visits/day
  const [alert, setAlert] = useState<Visit | null>(null);
  const seen = useRef<Set<string> | null>(null);
  const playAlert = useCallback((visit: Visit) => {
    getAlertAudio(visit.id)
      .then((blob) => {
        const audio = new Audio(URL.createObjectURL(blob));
        audio.onended = () => URL.revokeObjectURL(audio.src);
        return audio.play();
      })
      .catch(() => undefined);
  }, []);
  useEffect(() => {
    if (!online) return;
    const poll = async () => {
      try {
        const reds = await getVisits({ status: "confirmed", risk: "red", limit: 10 });
        if (seen.current) {
          const fresh = reds.find((visit) => !seen.current!.has(visit.id));
          if (fresh) {
            setAlert(fresh);
            playAlert(fresh);
            void load(true);
          }
        }
        seen.current = new Set(reds.map((visit) => visit.id));
      } catch {
        // Next poll retries.
      }
    };
    void poll();
    const timer = window.setInterval(poll, 10000);
    return () => window.clearInterval(timer);
  }, [online, load, playAlert]);

  const handleExport = async () => {
    if (!online) {
      notify("Connect to the internet to export the CSV.", "error");
      return;
    }
    setExporting(true);
    try {
      const blob = await exportCsv();
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = `asha-setu-visits-${todayKey()}.csv`;
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      window.setTimeout(() => URL.revokeObjectURL(url), 1000);
      notify(
        `CSV downloaded · ${summary?.totals.visits ?? 0} confirmed visits`,
        "success",
      );
    } catch (caught) {
      notify(
        caught instanceof Error ? caught.message : "Could not export the CSV.",
        "error",
      );
    } finally {
      setExporting(false);
    }
  };

  if (!worker) return null;
  if (!isSupervisor(worker)) return <Navigate to="/" replace />;
  if (loading) return <PageLoader label="Reading the field dashboard" />;
  if (!summary) {
    return (
      <div className="mx-auto max-w-xl">
        <div className="rounded-[24px] border border-rose-200 bg-rose-50 p-6 text-center">
          <AlertTriangle className="mx-auto size-7 text-rose-700" />
          <h1 className="mt-3 font-display text-2xl font-semibold text-ink">
            The dashboard could not be loaded
          </h1>
          <p className="mt-1 text-sm text-rose-800/80">
            {error ?? "Check your connection and try again."}
          </p>
          <button
            type="button"
            onClick={() => void load()}
            disabled={!online}
            className="mt-4 inline-flex items-center gap-2 rounded-full bg-pine px-5 py-2.5 text-sm font-bold text-cream disabled:opacity-60"
          >
            <RefreshCw className="size-4" />
            Try again
          </button>
        </div>
      </div>
    );
  }

  const { totals, followups, recent } = summary;
  const todayLabel = new Date().toLocaleDateString("en-IN", {
    weekday: "long",
    day: "numeric",
    month: "long",
  });

  return (
    <div>
      {alert && (
        <div
          role="alert"
          className="mb-6 overflow-hidden rounded-[28px] border border-red-300 bg-gradient-to-br from-red-600 to-red-800 p-5 text-white shadow-[0_24px_60px_-28px_rgba(185,28,28,0.95)]"
        >
          <div className="flex items-start gap-4">
            <span className="relative grid size-12 shrink-0 place-items-center rounded-2xl bg-white/15">
              <span className="absolute inset-0 animate-ping rounded-2xl bg-white/20" />
              <Siren className="relative size-6" />
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-red-100">
                Red alert · just reported by {alert.worker_name ?? "an ASHA"}
              </p>
              <p className="mt-1 font-display text-2xl font-semibold">
                {alert.patient_name ?? alert.structured.patient_name ?? "Unnamed patient"}
              </p>
              <p className="mt-1 text-sm text-red-50">{alert.risk_reasons.slice(0, 2).join(" · ")}</p>
              <div className="mt-3 flex flex-wrap gap-2">
                <Link
                  to={`/visits/${alert.id}`}
                  className="inline-flex h-10 items-center gap-2 rounded-full bg-white px-4 text-sm font-bold text-red-800"
                >
                  Open report
                  <ArrowRight className="size-4" />
                </Link>
                <button
                  type="button"
                  onClick={() => playAlert(alert)}
                  className="inline-flex h-10 items-center gap-2 rounded-full border border-white/40 px-4 text-sm font-bold"
                >
                  <Volume2 className="size-4" />
                  Hear again
                </button>
              </div>
            </div>
            <button
              type="button"
              aria-label="Dismiss alert"
              onClick={() => setAlert(null)}
              className="grid size-9 shrink-0 place-items-center rounded-full hover:bg-white/15"
            >
              <X className="size-4" />
            </button>
          </div>
        </div>
      )}
      <PageHeader
        eyebrow="Supervisor overview"
        title="The block, at a glance"
        subtitle="Confirmed visits from your ASHA team, with the cases that need a call today."
        action={
          <button
            type="button"
            onClick={() => void handleExport()}
            disabled={exporting || !online}
            title={!online ? "Reconnect to export" : "Download confirmed visits as CSV"}
            className="inline-flex items-center gap-2 rounded-full border border-stone-200 bg-cream px-4 py-2.5 text-xs font-bold text-ink transition hover:border-pine/30 disabled:opacity-50"
          >
            {exporting ? (
              <Spinner className="size-3.5" />
            ) : (
              <Download className="size-3.5" />
            )}
            Export CSV
          </button>
        }
      />

      {error && (
        <div className="mb-4 flex items-start gap-2 rounded-2xl bg-amber-50 px-4 py-3 text-xs font-semibold text-amber-900 ring-1 ring-amber-200">
          <CloudOff className="mt-0.5 size-4 shrink-0" />
          {navigator.onLine
            ? `${error} Showing the last saved view.`
            : "You are offline. Showing the last saved view."}
        </div>
      )}

      <section className="relative overflow-hidden rounded-[28px] bg-pine p-5 text-cream shadow-[0_28px_70px_-40px_rgba(15,76,70,0.9)] md:p-6">
        <div className="pointer-events-none absolute -right-20 -top-24 size-64 rounded-full bg-saffron/20 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-24 left-1/3 size-52 rounded-full bg-emerald-300/10 blur-3xl" />
        <div className="relative">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-cream/50">
                Namaste, {worker.name}
              </p>
              <h2 className="mt-1 font-display text-2xl font-semibold md:text-3xl">
                {totals.visits_today === 0
                  ? "A quiet day so far"
                  : `${totals.visits_today} report${totals.visits_today === 1 ? "" : "s"} today`}
              </h2>
              <p className="mt-1 text-xs text-cream/60">
                {todayLabel} · updated{" "}
                {updatedAt
                  ? updatedAt.toLocaleTimeString("en-IN", {
                      hour: "numeric",
                      minute: "2-digit",
                    })
                  : "—"}
              </p>
            </div>
            <button
              type="button"
              onClick={() => void load(true)}
              disabled={refreshing || !online}
              className="inline-flex items-center gap-1.5 rounded-full bg-cream/10 px-3 py-1.5 text-[10px] font-bold text-cream/85 ring-1 ring-cream/15 transition hover:bg-cream/15 disabled:opacity-50"
            >
              <RefreshCw
                className={refreshing ? "size-3 animate-spin" : "size-3"}
              />
              Refresh
            </button>
          </div>

          <div className="mt-5 grid grid-cols-3 divide-x divide-cream/10 rounded-2xl bg-cream/5 ring-1 ring-cream/10">
            <Link to="/visits?status=attention" className="px-3 py-3">
              <p className="flex items-center gap-1 text-[9px] font-bold uppercase tracking-[0.14em] text-cream/50">
                <span className="size-1.5 rounded-full bg-rose-400" />
                Red · 7 days
              </p>
              <p className="mt-1 font-display text-3xl leading-none font-semibold text-rose-200">
                {totals.red_last_7d}
              </p>
              <p className="mt-1 text-[10px] text-cream/45">urgent cases</p>
            </Link>
            <Link to="/visits?status=attention" className="px-3 py-3">
              <p className="flex items-center gap-1 text-[9px] font-bold uppercase tracking-[0.14em] text-cream/50">
                <span className="size-1.5 rounded-full bg-amber-300" />
                Amber · 7 days
              </p>
              <p className="mt-1 font-display text-3xl leading-none font-semibold text-amber-200">
                {totals.amber_last_7d}
              </p>
              <p className="mt-1 text-[10px] text-cream/45">watch list</p>
            </Link>
            <Link to="/visits" className="px-3 py-3">
              <p className="flex items-center gap-1 text-[9px] font-bold uppercase tracking-[0.14em] text-cream/50">
                <span className="size-1.5 rounded-full bg-cream/50" />
                Overdue
              </p>
              <p className="mt-1 font-display text-3xl leading-none font-semibold text-cream">
                {totals.overdue_followups}
              </p>
              <p className="mt-1 text-[10px] text-cream/45">
                {totals.overdue_followups === 1 ? "follow-up" : "follow-ups"}
              </p>
            </Link>
          </div>

          <Link
            to="/visits?status=attention"
            className="mt-4 inline-flex items-center gap-1.5 text-[11px] font-bold text-saffron transition hover:text-amber-200"
          >
            Open the attention list
            <ArrowRight className="size-3.5" />
          </Link>
        </div>
      </section>

      <div className="mt-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard
          label="Today"
          value={totals.visits_today}
          hint="confirmed reports"
          icon={Activity}
          tone="pine"
          to="/visits"
        />
        <StatCard
          label="Confirmed"
          value={totals.visits}
          hint="all time"
          icon={ClipboardList}
          to="/visits"
        />
        <StatCard
          label="Patients"
          value={totals.patients}
          hint="registered families"
          icon={Users}
        />
        <StatCard
          label="Team"
          value={totals.workers}
          hint="ASHA workers"
          icon={CalendarDays}
        />
      </div>

      <div className="mt-4 grid items-start gap-4 lg:grid-cols-2">
        <section className="rounded-[24px] border border-stone-200/80 bg-cream p-4">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <span className="grid size-9 place-items-center rounded-xl bg-pine-soft text-pine">
                <CalendarDays className="size-4" />
              </span>
              <div>
                <h2 className="font-display text-lg font-semibold text-ink">
                  Follow-ups due
                </h2>
                <p className="text-[10px] font-semibold uppercase tracking-wider text-moss">
                  Next 3 days
                </p>
              </div>
            </div>
            <span className="rounded-full bg-stone-100 px-2.5 py-1 text-[10px] font-bold text-moss">
              {followups.length}
            </span>
          </div>
          {followups.length === 0 ? (
            <div className="mt-4 rounded-2xl border border-dashed border-stone-300/70 px-4 py-8 text-center">
              <p className="text-sm font-bold text-ink">Nothing due right now</p>
              <p className="mt-1 text-xs text-moss">
                No follow-ups land in the next three days.
              </p>
            </div>
          ) : (
            <div className="mt-3 space-y-2">
              {followups.map((item) => (
                <FollowUpRow key={item.id} item={item} />
              ))}
            </div>
          )}
        </section>

        <section className="rounded-[24px] border border-stone-200/80 bg-cream p-4">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <span className="grid size-9 place-items-center rounded-xl bg-pine-soft text-pine">
                <ClipboardList className="size-4" />
              </span>
              <div>
                <h2 className="font-display text-lg font-semibold text-ink">
                  Latest reports
                </h2>
                <p className="text-[10px] font-semibold uppercase tracking-wider text-moss">
                  Confirmed by the team
                </p>
              </div>
            </div>
            <Link
              to="/visits"
              className="inline-flex items-center gap-1 text-[10px] font-bold text-pine hover:underline"
            >
              View all
              <ChevronRight className="size-3" />
            </Link>
          </div>
          {recent.length === 0 ? (
            <div className="mt-4 rounded-2xl border border-dashed border-stone-300/70 px-4 py-8 text-center">
              <p className="text-sm font-bold text-ink">No confirmed reports yet</p>
              <p className="mt-1 text-xs text-moss">
                Reports appear here as soon as an ASHA worker confirms them.
              </p>
            </div>
          ) : (
            <div className="mt-3 space-y-2">
              {recent.map((item) => (
                <RecentRow key={item.id} item={item} />
              ))}
            </div>
          )}
        </section>
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-3 rounded-2xl border border-stone-200/80 bg-cream px-4 py-3">
        <Download className="size-4 shrink-0 text-pine" />
        <p className="min-w-0 flex-1 text-xs text-moss">
          The CSV includes every confirmed visit with vitals, pregnancy details,
          actions and risk reasons — ready for block review.
        </p>
      </div>
    </div>
  );
}
