import { Mic } from "lucide-react";
import { cn } from "../utils";

export function Logo({
  compact = false,
  light = false,
}: {
  compact?: boolean;
  light?: boolean;
}) {
  return (
    <div className="flex items-center gap-2.5">
      <span
        className={cn(
          "relative grid size-10 shrink-0 place-items-center rounded-[14px] shadow-[0_8px_20px_-10px_rgba(15,76,70,0.8)]",
          light ? "bg-cream text-pine" : "bg-pine text-cream",
        )}
      >
        <Mic className="size-5" strokeWidth={2.3} />
        <span
          className={cn(
            "absolute -right-0.5 -top-0.5 size-2.5 rounded-full bg-saffron ring-2",
            light ? "ring-pine" : "ring-paper",
          )}
        />
      </span>
      {!compact && (
        <div className="leading-none">
          <div
            className={cn(
              "font-display text-[21px] font-semibold tracking-tight",
              light ? "text-cream" : "text-ink",
            )}
          >
            ASHA Setu
          </div>
          <div
            className={cn(
              "mt-1 text-[9px] font-bold uppercase tracking-[0.2em]",
              light ? "text-cream/60" : "text-moss",
            )}
          >
            Voice field reports
          </div>
        </div>
      )}
    </div>
  );
}
