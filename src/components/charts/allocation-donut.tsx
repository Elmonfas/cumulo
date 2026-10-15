"use client";

import { Cell, Pie, PieChart, ResponsiveContainer } from "recharts";
import type { AllocationSlice } from "@/domain/allocation";
import { formatCurrency, formatPercent } from "@/lib/format";
import { cn } from "@/lib/utils";

/** Paleta de series para distribuciones (clases completas para que Tailwind las vea). "Otros" va en gris. */
const PALETTE = [
  { css: "var(--accent)", dot: "bg-accent" },
  { css: "var(--series-2)", dot: "bg-series-2" },
  { css: "var(--series-4)", dot: "bg-series-4" },
  { css: "var(--series-3)", dot: "bg-series-3" },
  { css: "var(--series-5)", dot: "bg-series-5" },
  { css: "var(--series-6)", dot: "bg-series-6" },
];
const OTHER = { css: "var(--text-muted)", dot: "bg-text-muted" };
const colorOf = (key: string, index: number) => (key === "other" ? OTHER : PALETTE[index % PALETTE.length]);

export function AllocationDonut({ slices, labelOf }: { slices: AllocationSlice[]; labelOf: (key: string) => string }) {
  const data = slices.map((s, i) => ({ key: s.key, value: Number(s.share.toFixed(6)), fill: colorOf(s.key, i).css }));
  return (
    <div className="@container min-w-0">
      <div className="flex min-w-0 flex-col items-center gap-4 @md:flex-row @md:items-center">
        <div className="relative size-28 shrink-0 @md:size-40" role="img" aria-label="Distribución de la cartera">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie data={data} dataKey="value" nameKey="key" innerRadius="64%" outerRadius="100%" paddingAngle={2} stroke="none" animationDuration={200}>
                {data.map((d) => (
                  <Cell key={d.key} fill={d.fill} />
                ))}
              </Pie>
            </PieChart>
          </ResponsiveContainer>
        </div>
        <ul className="grid w-full min-w-0 grid-cols-[minmax(0,1fr)] gap-1.5">
          {slices.map((s, i) => (
            <li key={s.key} className="flex items-center gap-2 text-xs @md:text-sm">
              <span className={cn("size-2.5 shrink-0 rounded-full", colorOf(s.key, i).dot)} aria-hidden />
              <span className="min-w-0 flex-1 truncate">{labelOf(s.key)}</span>
              <span className="text-text-muted tabular-nums">{formatPercent(s.share, { signed: false, decimals: 0 })}</span>
              <span className="hidden w-24 text-right font-medium tabular-nums @md:inline">{formatCurrency(s.value)}</span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
