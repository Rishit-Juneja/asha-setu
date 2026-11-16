import type { ReactNode } from "react";

export function PageHeader({
  eyebrow,
  title,
  subtitle,
  action,
}: {
  eyebrow?: string;
  title: string;
  subtitle?: string;
  action?: ReactNode;
}) {
  return (
    <header className="mb-6 flex flex-wrap items-end justify-between gap-4 md:mb-8">
      <div className="min-w-0">
        {eyebrow && (
          <p className="mb-1.5 text-[10px] font-bold uppercase tracking-[0.2em] text-moss">
            {eyebrow}
          </p>
        )}
        <h1 className="font-display text-[28px] leading-tight font-semibold tracking-tight text-ink md:text-4xl">
          {title}
        </h1>
        {subtitle && (
          <p className="mt-1.5 max-w-2xl text-sm leading-relaxed text-moss">
            {subtitle}
          </p>
        )}
      </div>
      {action && <div className="shrink-0">{action}</div>}
    </header>
  );
}
