import type { ReactNode } from "react";

export interface TooltipRow {
  label: string;
  value: string;
  /** Clase de color del punto: "bg-accent", "bg-series-2"… */
  dotClassName?: string;
}

/** Tooltip en píldora común a todas las gráficas. */
export function ChartTooltipPill({ title, rows }: { title?: ReactNode; rows: TooltipRow[] }) {
  return (
    <div className="rounded-2xl border border-border bg-surface px-3.5 py-2 text-xs shadow-card tabular-nums">
      {title && <p className="mb-1 font-medium text-text-muted">{title}</p>}
      <ul className="grid gap-0.5">
        {rows.map((row) => (
          <li key={row.label} className="flex items-center gap-2">
            {row.dotClassName && <span className={`size-2 rounded-full ${row.dotClassName}`} aria-hidden />}
            <span className="text-text-muted">{row.label}</span>
            <span className="ml-auto pl-3 font-medium">{row.value}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
