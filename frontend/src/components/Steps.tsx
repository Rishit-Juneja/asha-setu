import { Check } from "lucide-react";
import { Fragment } from "react";
import { cn } from "../utils";

const STEPS = ["Speak", "Review", "Read back"];

export function Steps({ current }: { current: 1 | 2 | 3 }) {
  return (
    <div className="mb-6 flex items-center gap-2">
      {STEPS.map((step, index) => {
        const number = index + 1;
        const done = number < current;
        const active = number === current;
        return (
          <Fragment key={step}>
            <div className="flex items-center gap-2">
              <span
                className={cn(
                  "grid size-6 shrink-0 place-items-center rounded-full text-[10px] font-extrabold",
                  done && "bg-pine text-cream",
                  active && "bg-saffron text-pine",
                  !done && !active && "bg-stone-200 text-moss/60",
                )}
              >
                {done ? <Check className="size-3.5" /> : number}
              </span>
              <span
                className={cn(
                  "text-[10px] font-bold uppercase tracking-[0.12em] sm:text-[11px]",
                  active ? "text-ink" : done ? "text-pine" : "text-moss/45",
                )}
              >
                {step}
              </span>
            </div>
            {index < STEPS.length - 1 && (
              <span
                className={cn(
                  "h-px flex-1",
                  done ? "bg-pine/30" : "bg-stone-200",
                )}
              />
            )}
          </Fragment>
        );
      })}
    </div>
  );
}
