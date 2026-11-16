import { RISK_COPY } from "../constants";
import type { RiskLevel } from "../types";
import { cn } from "../utils";

const STYLES: Record<RiskLevel, string> = {
  red: "bg-rose-50 text-rose-700 ring-rose-200",
  amber: "bg-amber-50 text-amber-800 ring-amber-200",
  green: "bg-emerald-50 text-emerald-700 ring-emerald-200",
};

const DOTS: Record<RiskLevel, string> = {
  red: "bg-rose-500",
  amber: "bg-amber-500",
  green: "bg-emerald-500",
};

export function RiskBadge({
  level,
  size = "sm",
  className,
}: {
  level: RiskLevel;
  size?: "sm" | "md";
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full font-bold uppercase tracking-wide ring-1",
        size === "sm" ? "px-2.5 py-1 text-[10px]" : "px-3 py-1.5 text-xs",
        STYLES[level],
        className,
      )}
    >
      <span className={cn("size-1.5 rounded-full", DOTS[level])} />
      {RISK_COPY[level].label}
    </span>
  );
}

export function RiskDot({ level }: { level: RiskLevel }) {
  return (
    <span
      className={cn("inline-block size-2.5 rounded-full", DOTS[level])}
      title={RISK_COPY[level].label}
    />
  );
}
