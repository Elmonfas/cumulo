"use client";

import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { ChartTooltipPill } from "@/components/charts/chart-tooltip";
import type { CompoundInterestYear } from "@/domain/compound-interest";
import { formatCompactCurrency, formatCurrency } from "@/lib/format";

interface Point {
  year: number;
  // Números solo para la geometría de la gráfica; los textos salen de Decimal.
  contributed: number;
  interest: number;
  contributedLabel: string;
  interestLabel: string;
  balanceLabel: string;
}

export function GrowthChart({ timeline }: { timeline: CompoundInterestYear[] }) {
  const data: Point[] = timeline.map((row) => ({
    year: row.year,
    contributed: Number(row.contributed.toFixed(2)),
    interest: Number(row.interest.toFixed(2)),
    contributedLabel: formatCurrency(row.contributed),
    interestLabel: formatCurrency(row.interest),
    balanceLabel: formatCurrency(row.balance),
  }));

  return (
    <div className="h-56 w-full md:h-64" role="img" aria-label="Evolución del capital aportado y de los intereses por año">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data} margin={{ top: 8, right: 4, bottom: 0, left: 0 }}>
          <defs>
            <linearGradient id="fill-contributed" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="var(--accent)" stopOpacity={0.35} />
              <stop offset="100%" stopColor="var(--accent)" stopOpacity={0} />
            </linearGradient>
            <linearGradient id="fill-interest" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="var(--series-2)" stopOpacity={0.35} />
              <stop offset="100%" stopColor="var(--series-2)" stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid vertical={false} stroke="var(--border)" strokeDasharray="3 3" />
          <XAxis
            dataKey="year"
            tickLine={false}
            axisLine={false}
            tick={{ fill: "var(--text-muted)", fontSize: 12 }}
            tickFormatter={(year: number) => (year === 0 ? "Hoy" : `${year}a`)}
            minTickGap={16}
          />
          <YAxis
            tickLine={false}
            axisLine={false}
            width={68}
            tick={{ fill: "var(--text-muted)", fontSize: 12 }}
            tickFormatter={(value: number) => formatCompactCurrency(String(value))}
          />
          <Tooltip
            cursor={{ stroke: "var(--border)" }}
            content={({ active, payload }) => {
              const point = active ? (payload?.[0]?.payload as Point | undefined) : undefined;
              if (!point) return null;
              return (
                <ChartTooltipPill
                  title={point.year === 0 ? "Hoy" : `Año ${point.year}`}
                  rows={[
                    { label: "Total", value: point.balanceLabel },
                    { label: "Aportado", value: point.contributedLabel, dotClassName: "bg-accent" },
                    { label: "Intereses", value: point.interestLabel, dotClassName: "bg-series-2" },
                  ]}
                />
              );
            }}
          />
          <Area
            type="monotone"
            dataKey="contributed"
            stackId="total"
            stroke="var(--accent)"
            strokeWidth={2}
            fill="url(#fill-contributed)"
            animationDuration={200}
          />
          <Area
            type="monotone"
            dataKey="interest"
            stackId="total"
            stroke="var(--series-2)"
            strokeWidth={2}
            fill="url(#fill-interest)"
            animationDuration={200}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
