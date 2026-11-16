import type { ReactNode } from "react";
import { cn } from "../utils";

export function inputClass(missing = false, extra = ""): string {
  return cn(
    "w-full rounded-xl border bg-cream px-3.5 py-2.5 text-[15px] text-ink outline-none transition placeholder:text-stone-400",
    missing
      ? "border-amber-300 ring-2 ring-amber-100"
      : "border-stone-200 focus:border-pine focus:ring-2 focus:ring-pine/15",
    extra,
  );
}

export function Field({
  label,
  hint,
  missing,
  children,
  className,
}: {
  label: string;
  hint?: string;
  missing?: boolean;
  children: ReactNode;
  className?: string;
}) {
  return (
    <label className={cn("block", className)}>
      <span className="mb-1.5 flex items-center justify-between gap-2">
        <span className="text-[12px] font-bold text-ink/75">{label}</span>
        {missing && (
          <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider text-amber-800">
            Needed
          </span>
        )}
      </span>
      {children}
      {hint && <span className="mt-1 block text-[11px] text-moss">{hint}</span>}
    </label>
  );
}
