import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ClipboardList,
  FileSearch,
  Mic,
  Search,
  ShieldCheck,
  TriangleAlert,
} from "lucide-react";
import { Link, useSearchParams } from "react-router-dom";
import { getVisits } from "../api";
import { useAuth } from "../auth";
import { cacheVisits, readCachedVisits } from "../cache";
import { useSyncKey } from "../hooks";
import type { Visit } from "../types";
import { cn, isSupervisor } from "../utils";
import { EmptyState } from "../components/EmptyState";
import { PageHeader } from "../components/PageHeader";
import { PageLoader } from "../components/Spinner";
import { VisitCard } from "../components/VisitCard";

type Tab = "all" | "drafts" | "attention" | "stable";

const TABS: Array<{ key: Tab; label: string }> = [
  { key: "all", label: "All" },
  { key: "drafts", label: "Drafts" },
  { key: "attention", label: "Attention" },
  { key: "stable", label: "Stable" },
];

function matchesTab(visit: Visit, tab: Tab): boolean {
  if (tab === "drafts") return visit.status === "draft";
  if (tab === "attention") return visit.risk_level !== "green";
  if (tab === "stable") {
    return visit.risk_level === "green" && visit.status === "confirmed";
  }
  return true;
}

export function Visits() {
  const { worker } = useAuth();
  const syncKey = useSyncKey();
  const [params, setParams] = useSearchParams();
  const [visits, setVisits] = useState<Visit[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState("");

  const tabParam = params.get("status");
  const tab: Tab = TABS.some((item) => item.key === tabParam)
    ? (tabParam as Tab)
    : "all";

  const load = useCallback(async () => {
    if (!worker) return;
    try {
      const data = await getVisits({ limit: 100 });
      setVisits(data);
      setError(null);
      cacheVisits(worker.id, data);
    } catch (caught) {
      const cached = readCachedVisits(worker.id);
      setVisits(cached);
      setError(
        caught instanceof Error ? caught.message : "Could not load visits.",
      );
    }
  }, [worker]);

  useEffect(() => {
    void load();
  }, [load, syncKey]);

  const counts = useMemo(() => {
    const all = visits ?? [];
    return {
      all: all.length,
      drafts: all.filter((visit) => visit.status === "draft").length,
      attention: all.filter((visit) => visit.risk_level !== "green").length,
      stable: all.filter(
        (visit) => visit.risk_level === "green" && visit.status === "confirmed",
      ).length,
    };
  }, [visits]);

  const filtered = useMemo(() => {
    let list = (visits ?? []).filter((visit) => matchesTab(visit, tab));
    const search = query.trim().toLowerCase();
    if (search) {
      list = list.filter((visit) => {
        const structured = visit.structured;
        return (
          (visit.patient_name ?? structured.patient_name ?? "")
            .toLowerCase()
            .includes(search) ||
          (structured.village ?? "").toLowerCase().includes(search) ||
          visit.transcript.toLowerCase().includes(search)
        );
      });
    }
    return list;
  }, [visits, tab, query]);

  const setTab = (next: Tab) => {
    const nextParams = new URLSearchParams(params);
    if (next === "all") {
      nextParams.delete("status");
    } else {
      nextParams.set("status", next);
    }
    setParams(nextParams, { replace: true });
  };

  if (!worker) return null;
  if (visits === null) return <PageLoader label="Loading visits" />;
  const supervisor = isSupervisor(worker);

  return (
    <div>
      <PageHeader
        eyebrow={supervisor ? "Every family, every visit" : "Your field record"}
        title="All visits"
        subtitle={
          supervisor
            ? "Every confirmed report and every draft from your ASHA team."
            : "Drafts, confirmed reports and follow-ups — all in one place."
        }
        action={
          !supervisor ? (
            <Link
              to="/record"
              className="inline-flex items-center gap-2 rounded-full bg-pine px-5 py-3 text-sm font-bold text-cream shadow-[0_12px_26px_-14px_rgba(15,76,70,0.9)]"
            >
              <Mic className="size-4" />
              New visit
            </Link>
          ) : (
            <Link
              to="/dashboard"
              className="hidden items-center gap-2 rounded-full border border-stone-200 bg-cream px-4 py-2.5 text-xs font-bold text-ink sm:inline-flex"
            >
              Open overview
            </Link>
          )
        }
      />

      <div className="flex flex-col gap-3">
        <div className="no-scrollbar flex gap-1.5 overflow-x-auto pb-1">
          {TABS.map((item) => {
            const active = item.key === tab;
            return (
              <button
                key={item.key}
                type="button"
                onClick={() => setTab(item.key)}
                className={cn(
                  "inline-flex shrink-0 items-center gap-1 rounded-full px-3 py-2 text-[11px] font-bold transition sm:gap-1.5 sm:px-3.5 sm:text-xs",
                  active
                    ? "bg-pine text-cream shadow-sm"
                    : "border border-stone-200 bg-cream text-ink/65 hover:border-pine/25 hover:text-ink",
                )}
              >
                {item.key === "attention" && (
                  <TriangleAlert className="hidden size-3.5 sm:block" />
                )}
                {item.key === "stable" && (
                  <ShieldCheck className="hidden size-3.5 sm:block" />
                )}
                {item.key === "drafts" && (
                  <FileSearch className="hidden size-3.5 sm:block" />
                )}
                {item.label}
                <span
                  className={cn(
                    "rounded-full px-1.5 py-0.5 text-[9px] font-extrabold",
                    active ? "bg-cream/15 text-cream" : "bg-stone-100 text-moss",
                  )}
                >
                  {counts[item.key]}
                </span>
              </button>
            );
          })}
        </div>

        <div className="relative">
          <Search className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-moss/60" />
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search patient, village or transcript"
            className="w-full rounded-2xl border border-stone-200 bg-cream py-3 pl-10 pr-3.5 text-sm text-ink outline-none transition placeholder:text-stone-400 focus:border-pine focus:ring-2 focus:ring-pine/15"
          />
        </div>

        {error && (
          <div className="rounded-2xl bg-amber-50 px-4 py-3 text-xs font-semibold text-amber-900 ring-1 ring-amber-200">
            {navigator.onLine
              ? `${error} Showing the last saved copy.`
              : "You are offline. Showing the last saved copy."}
          </div>
        )}
      </div>

      <div className="mt-4">
        {filtered.length === 0 ? (
          <EmptyState
            icon={
              tab === "drafts"
                ? FileSearch
                : tab === "attention"
                  ? ShieldCheck
                  : ClipboardList
            }
            title={
              query.trim()
                ? "No visits match this search"
                : tab === "drafts"
                  ? "No drafts waiting"
                  : tab === "attention"
                    ? "No red or amber cases"
                    : tab === "stable"
                      ? "No stable reports yet"
                      : "No visits yet"
            }
            body={
              query.trim()
                ? "Try a patient name, a village, or a word from the transcript."
                : tab === "drafts"
                  ? "Voice notes that have not been confirmed will appear here."
                  : tab === "attention"
                    ? "When a report has a danger sign or a high reading, it lands here."
                    : tab === "stable"
                      ? "Confirmed reports without a red or amber flag appear here."
                      : "Record your first home visit and it will be saved here."
            }
            action={
              !supervisor && tab !== "attention"
                ? { label: "Record a visit", to: "/record" }
                : undefined
            }
          />
        ) : (
          <div className="grid gap-3 md:grid-cols-2">
            {filtered.map((visit) => (
              <VisitCard
                key={visit.id}
                visit={visit}
                to={
                  visit.status === "draft"
                    ? `/review/${visit.id}`
                    : `/visits/${visit.id}`
                }
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
