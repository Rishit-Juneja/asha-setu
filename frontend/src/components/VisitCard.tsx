import { ChevronRight, UserRound } from "lucide-react";
import { Link } from "react-router-dom";
import type { Visit } from "../types";
import {
  bpText,
  followUpLabel,
  gestationText,
  languageOption,
  relativeDay,
  visitTypeLabel,
} from "../utils";
import { RiskBadge } from "./RiskBadge";

export function VisitCard({ visit, to }: { visit: Visit; to?: string }) {
  const structured = visit.structured;
  const name = visit.patient_name ?? structured.patient_name ?? "Unnamed patient";
  const village = structured.village ?? "Village not recorded";
  const anc = ["anc", "postnatal"].includes(visit.visit_type);
  const followUp = followUpLabel(visit.follow_up_date);
  const overdue = followUp.startsWith("Overdue");
  const isDraft = visit.status === "draft";

  return (
    <Link
      to={to ?? `/visits/${visit.id}`}
      className="group block min-w-0 rounded-[22px] border border-stone-200/80 bg-cream p-4 shadow-[0_1px_0_rgba(20,37,31,0.03)] transition duration-200 hover:-translate-y-0.5 hover:border-pine/25 hover:shadow-[0_16px_40px_-24px_rgba(20,37,31,0.35)]"
    >
      <div className="flex items-start gap-3">
        <span className="grid size-11 shrink-0 place-items-center rounded-2xl bg-pine-soft text-pine">
          <UserRound className="size-5" />
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="truncate font-display text-[19px] font-semibold leading-tight text-ink">
              {name}
            </h3>
            {isDraft && (
              <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider text-amber-800">
                Draft
              </span>
            )}
          </div>
          <p className="mt-0.5 truncate text-xs text-moss">
            {village} · {relativeDay(visit.created_at)} ·{" "}
            {visitTypeLabel(visit.visit_type)}
          </p>
        </div>
        <RiskBadge level={visit.risk_level} />
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-1.5 text-[11px] font-semibold text-ink/70">
        <span className="rounded-full bg-stone-100 px-2.5 py-1">
          {bpText(structured.vitals)}
        </span>
        {anc && (
          <span className="rounded-full bg-stone-100 px-2.5 py-1">
            {gestationText(structured.pregnancy)}
          </span>
        )}
        <span
          className={
            overdue
              ? "rounded-full bg-rose-50 px-2.5 py-1 text-rose-700"
              : "rounded-full bg-stone-100 px-2.5 py-1"
          }
        >
          {followUp}
        </span>
        <span className="rounded-full bg-stone-100 px-2.5 py-1">
          {languageOption(visit.language).native}
        </span>
      </div>

      {visit.risk_reasons[0] && (
        <p className="mt-2 line-clamp-1 text-xs text-moss">{visit.risk_reasons[0]}</p>
      )}

      <div className="mt-3 flex min-w-0 items-center justify-between gap-2 border-t border-stone-100 pt-2.5 text-[11px] text-moss">
        <span className="min-w-0 flex-1 truncate">
          {visit.worker_name ? `${visit.worker_name} · ` : ""}
          {visit.transcript.slice(0, 70)}
          {visit.transcript.length > 70 ? "…" : ""}
        </span>
        <ChevronRight className="size-4 shrink-0 transition group-hover:translate-x-0.5 group-hover:text-pine" />
      </div>
    </Link>
  );
}
