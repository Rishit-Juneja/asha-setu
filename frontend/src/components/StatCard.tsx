import type { LucideIcon } from "lucide-react";
import { Link } from "react-router-dom";
import { cn } from "../utils";

type Tone = "neutral" | "red" | "amber" | "green" | "pine";

const TONE_STYLES: Record<Tone, string> = {
  neutral: "bg-stone-100 text-ink",
  red: "bg-rose-100 text-rose-700",
  amber: "bg-amber-100 text-amber-800",
  green: "bg-emerald-100 text-emerald-700",
  pine: "bg-pine-soft text-pine",
};

export function StatCard({
  label,
  value,
  hint,
  icon: Icon,
  tone = "neutral",
  to,
}: {
  label: string;
  value: number | string;
  hint?: string;
  icon: LucideIcon;
  tone?: Tone;
  to?: string;
}) {
  const content = (
    <>
      <div className="flex items-start justify-between gap-2">
        <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-moss">
          {label}
        </p>
        <span
          className={cn(
            "grid size-8 shrink-0 place-items-center rounded-xl",
            TONE_STYLES[tone],
          )}
        >
          <Icon className="size-4" />
        </span>
      </div>
      <p className="mt-2 font-display text-3xl leading-none font-semibold text-ink">
        {value}
      </p>
      {hint && <p className="mt-1.5 text-[11px] leading-snug text-moss">{hint}</p>}
    </>
  );

  const className =
    "rounded-[20px] border border-stone-200/80 bg-cream p-4 shadow-[0_1px_0_rgba(20,37,31,0.03)]";

  return to ? (
    <Link
      to={to}
      className={cn(
        className,
        "block transition hover:-translate-y-0.5 hover:border-pine/25 hover:shadow-md",
      )}
    >
      {content}
    </Link>
  ) : (
    <div className={className}>{content}</div>
  );
}
