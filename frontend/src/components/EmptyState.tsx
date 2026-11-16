import type { LucideIcon } from "lucide-react";
import { Link } from "react-router-dom";
import { cn } from "../utils";

export function EmptyState({
  icon: Icon,
  title,
  body,
  action,
  className,
}: {
  icon: LucideIcon;
  title: string;
  body: string;
  action?: { label: string; to: string };
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center rounded-[24px] border border-dashed border-stone-300/80 bg-cream/60 px-6 py-12 text-center",
        className,
      )}
    >
      <span className="grid size-12 place-items-center rounded-2xl bg-pine-soft text-pine">
        <Icon className="size-5" />
      </span>
      <h3 className="mt-4 font-display text-xl text-ink">{title}</h3>
      <p className="mt-1 max-w-sm text-sm leading-relaxed text-moss">{body}</p>
      {action && (
        <Link
          to={action.to}
          className="mt-5 rounded-full bg-pine px-5 py-2.5 text-sm font-bold text-cream transition hover:bg-pine/90"
        >
          {action.label}
        </Link>
      )}
    </div>
  );
}
