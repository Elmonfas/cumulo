"use client";

import type { KeyboardEvent } from "react";
import { PERIODS, type PeriodKey } from "@/domain/models";
import { cn } from "@/lib/utils";

/** Selector de periodo en píldora: 1D · 1S · 1M · YTD · 1A · Todo. */
export function PeriodSelector({
  value,
  onChange,
  className,
  periods = PERIODS.map((p) => p.key),
}: {
  value: PeriodKey;
  onChange: (p: PeriodKey) => void;
  className?: string;
  /** Subconjunto de periodos a ofrecer (por defecto, todos). */
  periods?: PeriodKey[];
}) {
  const options = PERIODS.filter((p) => periods.includes(p.key));
  function onKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    const step = event.key === "ArrowRight" ? 1 : event.key === "ArrowLeft" ? -1 : 0;
    if (!step) return;
    event.preventDefault();
    const index = options.findIndex((p) => p.key === value);
    const next = options[(index + step + options.length) % options.length];
    onChange(next.key);
    (event.currentTarget.querySelector(`[data-period="${next.key}"]`) as HTMLButtonElement | null)?.focus();
  }

  return (
    <div
      role="radiogroup"
      aria-label="Periodo"
      onKeyDown={onKeyDown}
      style={{ gridTemplateColumns: `repeat(${options.length}, minmax(0, 1fr))` }}
      className={cn("grid gap-0.5 rounded-full bg-surface-2 p-1", className)}
    >
      {options.map((p) => {
        const checked = p.key === value;
        return (
          <button
            key={p.key}
            type="button"
            role="radio"
            data-period={p.key}
            aria-checked={checked}
            tabIndex={checked ? 0 : -1}
            onClick={() => onChange(p.key)}
            className={cn(
              "h-8 rounded-full text-xs font-medium transition-colors outline-none focus-visible:ring-3 focus-visible:ring-accent/40",
              checked ? "bg-accent text-accent-foreground" : "text-text-muted hover:text-text",
            )}
          >
            {p.label}
          </button>
        );
      })}
    </div>
  );
}
