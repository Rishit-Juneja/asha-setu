import { useState } from "react";
import { Plus, X } from "lucide-react";

export function TagEditor({
  values,
  onChange,
  suggestions = [],
  placeholder = "Type and press Enter",
}: {
  values: string[];
  onChange: (values: string[]) => void;
  suggestions?: string[];
  placeholder?: string;
}) {
  const [draft, setDraft] = useState("");

  const add = (value: string) => {
    const clean = value.trim().replace(/,$/, "");
    if (!clean) return;
    if (!values.some((item) => item.toLowerCase() === clean.toLowerCase())) {
      onChange([...values, clean]);
    }
    setDraft("");
  };

  const remove = (value: string) => {
    onChange(values.filter((item) => item !== value));
  };

  const remaining = suggestions.filter(
    (suggestion) =>
      !values.some((value) => value.toLowerCase() === suggestion.toLowerCase()),
  );

  return (
    <div className="rounded-xl border border-stone-200 bg-cream p-2.5">
      <div className="flex flex-wrap items-center gap-1.5">
        {values.map((value) => (
          <span
            key={value}
            className="inline-flex items-center gap-1 rounded-full bg-pine-soft px-2.5 py-1 text-xs font-semibold text-pine"
          >
            {value}
            <button
              type="button"
              onClick={() => remove(value)}
              className="rounded-full p-0.5 hover:bg-pine/10"
              aria-label={`Remove ${value}`}
            >
              <X className="size-3" />
            </button>
          </span>
        ))}
        <input
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter" || event.key === ",") {
              event.preventDefault();
              add(draft);
            }
            if (event.key === "Backspace" && !draft && values.length > 0) {
              remove(values[values.length - 1]);
            }
          }}
          onBlur={() => add(draft)}
          placeholder={values.length ? "Add another…" : placeholder}
          className="min-w-[9rem] flex-1 bg-transparent px-1.5 py-1 text-sm text-ink outline-none placeholder:text-stone-400"
        />
      </div>
      {remaining.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-1.5 border-t border-stone-100 pt-2">
          {remaining.slice(0, 8).map((suggestion) => (
            <button
              key={suggestion}
              type="button"
              onClick={() => add(suggestion)}
              className="inline-flex items-center gap-1 rounded-full border border-stone-200 bg-paper px-2.5 py-1 text-[11px] font-semibold text-ink/70 transition hover:border-pine/30 hover:text-pine"
            >
              <Plus className="size-3" />
              {suggestion}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
