"use client";

import { useId } from "react";
import { Area, AreaChart, CartesianGrid, Line, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import type { HistoryPoint } from "@/domain/history";
import { axisWidth, currencyAxisFormatter, formatPointDate, formatTimeTick, hasTime, niceScale, timeAxisTicks } from "@/lib/chart-axis";
import { areAmountsHidden, formatAxisDate, formatCurrency, isLongRange } from "@/lib/format";
import { ChartTooltipPill } from "./chart-tooltip";

interface Point {
  date: string;
  // Números solo para la geometría; las etiquetas salen de Decimal.
  value: number;
  /** null si la línea de lo invertido se sale mucho de la escala del valor. */
  invested: number | null;
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
  const dates = data.map((d) => d.date);
  const intraday = dates.length > 0 && hasTime(dates[0]);
  const xTicks = timeAxisTicks(dates);
  // Lo invertido solo se dibuja si cae dentro del rango del valor; si no,
  // aplastaría la curva (sigue en el tooltip).
  const values = data.map((d) => d.value);
  const low = Math.min(...values);
  const high = Math.max(...values);
  // Igual que el precio medio en la ficha de cada activo: nunca estira la escala.
  const margin = Math.max(high - low, high * 0.002) * 0.1;
  const investedFits = data.every((d) => d.invested === null || (d.invested >= low - margin && d.invested <= high + margin));
  if (!investedFits) for (const d of data) d.invested = null;
  const yScale = niceScale(data.flatMap((d) => (d.invested === null ? [d.value] : [d.value, d.invested])));
  const axisLabel = currencyAxisFormatter(yScale.ticks, { hidden: areAmountsHidden() });
  const yWidth = axisWidth(yScale.ticks.map(axisLabel));
  const gradientId = `fill-value-${useId().replace(/[^\w-]/g, "")}`;

  return (
    <div className="h-52 w-full md:h-64 xl:h-80" role="img" aria-label="Evolución del patrimonio en el periodo">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data} margin={{ top: 8, right: 4, bottom: 0, left: 0 }}>
          <defs>
            <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
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
            ticks={xTicks}
            interval={xTicks ? 0 : "preserveEnd"}
            tickFormatter={(d: string) => (intraday ? formatTimeTick(d, dates) : formatAxisDate(d, longRange))}
            minTickGap={24}
          />
          <YAxis
            tickLine={false}
            axisLine={false}
            width={yWidth}
            domain={yScale.domain}
            ticks={yScale.ticks}
            tick={{ fill: "var(--text-muted)", fontSize: 12 }}
            tickFormatter={axisLabel}
          />
          <Tooltip
            cursor={{ stroke: "var(--border)" }}
            content={({ active, payload }) => {
              const point = active ? (payload?.[0]?.payload as Point | undefined) : undefined;
              if (!point) return null;
              return (
                <ChartTooltipPill
                  title={formatPointDate(point.date)}
                  rows={[
                    { label: "Patrimonio", value: point.valueLabel, dotClassName: "bg-accent" },
                    { label: investedLabel, value: point.investedLabel, dotClassName: "bg-series-2" },
                  ]}
                />
              );
            }}
          />
          <Area
            type="linear"
            dataKey="value"
            stroke="var(--accent)"
            strokeWidth={1.75}
            strokeLinejoin="round"
            fill={`url(#${gradientId})`}
            activeDot={{ r: 4, fill: "var(--accent)", stroke: "var(--surface)", strokeWidth: 2 }}
            animationDuration={200}
          />
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
