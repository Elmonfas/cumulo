"use client";

import { Area, AreaChart, CartesianGrid, Line, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import type { HistoryPoint } from "@/domain/history";
import { formatAxisDate, formatCompactCurrency, formatCurrency, formatDate, isLongRange } from "@/lib/format";
import { ChartTooltipPill } from "./chart-tooltip";

interface Point {
  date: string;
  // Números solo para la geometría; las etiquetas salen de Decimal.
  value: number;
  invested: number;
  valueLabel: string;
  investedLabel: string;
}

/** Patrimonio (área con degradado de acento) y lo aportado (línea). */
export function ValueChart({ points: all, investedLabel }: { points: HistoryPoint[]; investedLabel: string }) {
  // Los días previos a la primera compra no tienen nada que dibujar: fuera, o la
  // gráfica arranca con un tramo plano en 0 y un salto vertical.
  const firstHeld = all.findIndex((p) => !p.value.isZero() || !p.invested.isZero());
  const points = firstHeld <= 0 ? all : all.slice(Math.min(firstHeld, all.length - 2));
  const data: Point[] = points.map((p) => ({
    date: p.date,
    value: Number(p.value.toFixed(2)),
    invested: Number(p.invested.toFixed(2)),
    valueLabel: formatCurrency(p.value),
    investedLabel: formatCurrency(p.invested),
  }));
  const longRange = isLongRange(points[0]?.date, points.at(-1)?.date);

  return (
    <div className="h-52 w-full md:h-64" role="img" aria-label="Evolución del patrimonio en el periodo">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data} margin={{ top: 8, right: 4, bottom: 0, left: 0 }}>
          <defs>
            <linearGradient id="fill-value" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="var(--accent)" stopOpacity={0.35} />
              <stop offset="100%" stopColor="var(--accent)" stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid vertical={false} stroke="var(--border)" strokeDasharray="3 3" />
          <XAxis
            dataKey="date"
            tickLine={false}
            axisLine={false}
            tick={{ fill: "var(--text-muted)", fontSize: 12 }}
            tickFormatter={(d: string) => formatAxisDate(d, longRange)}
            minTickGap={24}
          />
          <YAxis
            tickLine={false}
            axisLine={false}
            width={68}
            domain={["auto", "auto"]}
            tick={{ fill: "var(--text-muted)", fontSize: 12 }}
            tickFormatter={(v: number) => formatCompactCurrency(String(v))}
          />
          <Tooltip
            cursor={{ stroke: "var(--border)" }}
            content={({ active, payload }) => {
              const point = active ? (payload?.[0]?.payload as Point | undefined) : undefined;
              if (!point) return null;
              return (
                <ChartTooltipPill
                  title={formatDate(point.date)}
                  rows={[
                    { label: "Patrimonio", value: point.valueLabel, dotClassName: "bg-accent" },
                    { label: investedLabel, value: point.investedLabel, dotClassName: "bg-series-2" },
                  ]}
                />
              );
            }}
          />
          <Area type="monotone" dataKey="value" stroke="var(--accent)" strokeWidth={2} fill="url(#fill-value)" animationDuration={200} />
          <Line
            type="stepAfter"
            dataKey="invested"
            stroke="var(--series-2)"
            strokeWidth={1.5}
            strokeDasharray="4 4"
            dot={false}
            animationDuration={200}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
