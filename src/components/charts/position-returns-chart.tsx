"use client";

import { Bar, BarChart, Cell, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import type { PositionValuation } from "@/domain/valuation";
import { formatAxisPercent, formatCurrency, formatPercent } from "@/lib/format";
import { ChartTooltipPill } from "./chart-tooltip";

interface Bar {
  key: string;
  label: string;
  name: string;
  // Número solo para la geometría; las etiquetas salen de Decimal.
  pct: number;
  pctLabel: string;
  gainLabel: string;
  up: boolean;
}

/** Rentabilidad no realizada de cada posición (verde si gana, rojo si pierde). */
export function PositionReturnsChart({
  positions,
  nameOf,
  tickerOf,
}: {
  positions: PositionValuation[];
  nameOf: (assetId: string) => string;
  tickerOf: (assetId: string) => string;
}) {
  const data: Bar[] = positions
    .filter((p) => p.unrealizedPct && p.unrealized)
    .sort((a, b) => b.unrealizedPct!.comparedTo(a.unrealizedPct!))
    // Más barras no caben con su etiqueta legible.
    .slice(0, 8)
    .map((p) => ({
      key: p.position.assetId,
      label: tickerOf(p.position.assetId),
      name: nameOf(p.position.assetId),
      pct: Number(p.unrealizedPct!.times(100).toFixed(2)),
      pctLabel: formatPercent(p.unrealizedPct!),
      gainLabel: formatCurrency(p.unrealized!, { signed: true }),
      up: !p.unrealizedPct!.isNegative(),
    }));

  if (data.length === 0) return <p className="text-sm text-text-muted">Sin precios todavía.</p>;

  return (
    <div className="h-44 w-full @md:h-52" role="img" aria-label="Rentabilidad de cada posición">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 6, right: 0, bottom: 0, left: 0 }}>
          <XAxis
            dataKey="label"
            tickLine={false}
            axisLine={false}
            interval={0}
            height={18}
            tick={{ fill: "var(--text-muted)", fontSize: 11 }}
          />
          <YAxis
            tickLine={false}
            axisLine={false}
            width={40}
            tick={{ fill: "var(--text-muted)", fontSize: 11 }}
            tickFormatter={formatAxisPercent}
          />
          <ReferenceLine y={0} stroke="var(--border)" />
          <Tooltip
            cursor={{ fill: "var(--surface-2)" }}
            content={({ active, payload }) => {
              const bar = active ? (payload?.[0]?.payload as Bar | undefined) : undefined;
              if (!bar) return null;
              return (
                <ChartTooltipPill
                  title={bar.name}
                  rows={[
                    { label: "Rentabilidad", value: bar.pctLabel },
                    { label: "Ganancia", value: bar.gainLabel },
                  ]}
                />
              );
            }}
          />
          <Bar dataKey="pct" radius={[6, 6, 6, 6]} maxBarSize={28} animationDuration={200}>
            {data.map((d) => (
              <Cell key={d.key} fill={d.up ? "var(--positive)" : "var(--negative)"} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
