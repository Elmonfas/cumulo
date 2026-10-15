"use client";

import { Cell, Pie, PieChart, ResponsiveContainer } from "recharts";
import type { AllocationSlice } from "@/domain/allocation";
import { formatCurrency, formatPercent } from "@/lib/format";

/** Tonos del acento (sin colores nuevos): de más a menos peso. */
const OPACITIES = [1, 0.72, 0.52, 0.38, 0.27, 0.18];

export function AllocationDonut({ slices, labelOf }: { slices: AllocationSlice[]; labelOf: (key: string) => string }) {
  const data = slices.map((s) => ({ key: s.key, value: Number(s.share.toFixed(6)) }));
  return (
    <div className="flex flex-col items-center gap-5 sm:flex-row sm:items-center">
      <div className="relative size-40 shrink-0" role="img" aria-label="Distribución de la cartera">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie data={data} dataKey="value" nameKey="key" innerRadius="68%" outerRadius="100%" paddingAngle={1.5} stroke="none" animationDuration={200}>
              {data.map((d, i) => (
                <Cell key={d.key} fill="var(--accent)" fillOpacity={OPACITIES[Math.min(i, OPACITIES.length - 1)]} />
              ))}
            </Pie>
          </PieChart>
        </ResponsiveContainer>
      </div>
      <ul className="grid w-full min-w-0 gap-2">
        {slices.map((s, i) => (
          <li key={s.key} className="flex items-center gap-2.5 text-sm">
            <span
              className="size-2.5 shrink-0 rounded-full bg-accent"
              style={{ opacity: OPACITIES[Math.min(i, OPACITIES.length - 1)] }}
              aria-hidden
            />
            <span className="min-w-0 flex-1 truncate">{labelOf(s.key)}</span>
            <span className="text-text-muted tabular-nums">{formatPercent(s.share, { signed: false })}</span>
            <span className="w-24 text-right font-medium tabular-nums">{formatCurrency(s.value)}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
