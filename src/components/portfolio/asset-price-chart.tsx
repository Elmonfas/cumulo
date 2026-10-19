"use client";

import Decimal from "decimal.js";
import { useId, useMemo, useState } from "react";
import { Area, AreaChart, CartesianGrid, Line, ReferenceDot, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { ChartTooltipPill, type TooltipRow } from "@/components/charts/chart-tooltip";
import { PeriodSelector } from "@/components/charts/period-selector";
import { VariationBadge } from "@/components/variation-badge";
import { addDays, intradayDates, isIntradayPeriod, periodStart } from "@/domain/history";
import type { Asset, PeriodKey, Transaction } from "@/domain/models";
import { averageCostSeries, priceSeriesWithTrades, type TradeMarker } from "@/domain/trade-markers";
import { usePriceHistories } from "@/hooks/use-price-histories";
import { axisWidth, currencyAxisFormatter, formatPointDate, formatTimeTick, hasTime, niceScale, timeAxisTicks } from "@/lib/chart-axis";
import { areAmountsHidden, formatAxisDate, formatCurrency, formatQuantity, isLongRange, todayIso } from "@/lib/format";
import type { IntradayRange } from "@/prices/types";

interface AssetPriceChartProps {
  asset: Asset;
  transactions: Transaction[];
  currentPrice: Decimal | null;
  /** Precio medio de compra de la posición abierta; null si está cerrada. */
  averageCost: Decimal | null;
  /** Hora de la cotización actual (ISO): cierra la serie intradía en su instante real. */
  currentAt?: string;
}

interface Point {
  date: string;
  // Número solo para la geometría; las etiquetas salen de Decimal.
  close: number;
  label: string;
  /** Precio medio de la posición ese día (null sin posición o fuera de escala). */
  avg: number | null;
  avgLabel: string | null;
}

const PERIODS: PeriodKey[] = ["1D", "1W", "1M", "YTD", "1Y", "ALL"];
const toNumber = (d: Decimal) => Number(d.toFixed(6));
const tradeLabel = (m: TradeMarker) =>
  `${formatQuantity(m.quantity)} × ${formatCurrency(m.price)}`;

/**
 * Precio del activo con un punto sobre la curva en cada compra y venta, y la
 * línea del precio medio de compra para ver de un vistazo si vas en positivo.
 */
export function AssetPriceChart({ asset, transactions, currentPrice, averageCost, currentAt }: AssetPriceChartProps) {
  const today = todayIso();
  const trades = useMemo(() => transactions.filter((t) => t.type === "buy" || t.type === "sell"), [transactions]);
  // Al abrir una ficha se ve la última semana (datos intradía), como en el bróker.
  const [period, setPeriod] = useState<PeriodKey>("1W");
  const firstTrade = useMemo(() => trades.map((t) => t.date.slice(0, 10)).sort()[0] ?? today, [trades, today]);

  // Un único histórico que cubre todos los periodos; luego se recorta.
  const fetchFrom = useMemo(() => {
    const yearAgo = addDays(today, -366);
    return addDays(firstTrade < yearAgo ? firstTrade : yearAgo, -7);
  }, [firstTrade, today]);
  const assets = useMemo(() => [asset], [asset]);
  const remote = asset.priceSource !== "manual";
  const intraday = isIntradayPeriod(period) ? (period as IntradayRange) : null;
  // Cierres diarios para los periodos largos; precios intradía (5 min–1 h) para 1D, 1S y 1M.
  const daily = usePriceHistories(assets, remote && !intraday ? fetchFrom : null);
  const detailed = usePriceHistories(assets, remote && intraday ? fetchFrom : null, intraday);
  const histories = intraday ? detailed : daily;

  const series = useMemo(() => {
    if (histories.status !== "ready") return null;
    const closes = histories.closes.get(asset.id) ?? [];
    if (intraday) {
      const window = new Set(intradayDates([closes], intraday, new Date()));
      const points = closes.filter((p) => window.has(p.date));
      const current = currentPrice && currentAt ? { date: new Date(currentAt).toISOString(), price: currentPrice } : undefined;
      return priceSeriesWithTrades(points, trades, current, points[0]?.date.slice(0, 10));
    }
    const start = period === "ALL" ? (trades.length ? firstTrade : addDays(today, -365)) : periodStart(period, today, firstTrade);
    return priceSeriesWithTrades(closes, trades, currentPrice ? { date: today, price: currentPrice } : undefined, start);
  }, [histories, intraday, asset.id, trades, currentPrice, currentAt, period, firstTrade, today]);

  if (asset.priceSource === "manual") {
    return <p className="rounded-2xl bg-surface-2 px-4 py-3 text-sm text-text-muted">Sin histórico: este activo tiene precio manual.</p>;
  }

  const change =
    series && series.points.length > 1 ? series.points.at(-1)!.close.div(series.points[0].close).minus(1) : null;

  return (
    <div className="grid grid-cols-[minmax(0,1fr)] gap-3">
      <PeriodSelector
        value={period}
        onChange={setPeriod}
        periods={trades.length ? PERIODS : PERIODS.filter((p) => p !== "ALL")}
        className="w-full sm:w-72"
      />
      {change && (
        <p className="flex items-center gap-1.5 text-xs text-text-muted">
          <VariationBadge ratio={change} />
          variación del precio en el periodo
        </p>
      )}
      {!series ? (
        <div className="h-48 animate-pulse rounded-2xl bg-surface-2 md:h-56" aria-hidden />
      ) : series.points.length < 2 ? (
        <p className="rounded-2xl bg-surface-2 px-4 py-3 text-sm text-text-muted">Aún no hay histórico de precios en este periodo.</p>
      ) : (
        <Chart
          asset={asset}
          points={series.points}
          markers={series.markers}
          trades={trades}
          averageCost={averageCost}
          // En periodos cortos la línea del precio medio no debe aplastar la curva.
          extendToAverage={period === "1Y" || period === "ALL"}
        />
      )}
      {histories.status === "ready" && histories.failed > 0 && (
        <p className="text-xs text-text-muted">No se pudo cargar el histórico; se muestra lo disponible.</p>
      )}
    </div>
  );
}

function Chart({
  asset,
  points,
  markers,
  trades,
  averageCost,
  extendToAverage,
}: {
  asset: Asset;
  points: { date: string; close: Decimal }[];
  markers: TradeMarker[];
  trades: Transaction[];
  averageCost: Decimal | null;
  /** Ampliar el eje para que siempre se vea la línea del precio medio. */
  extendToAverage: boolean;
}) {
  const gradientId = `fill-asset-price-${useId().replace(/[^\w-]/g, "")}`;
  const averages = averageCostSeries(trades, points.map((p) => p.date));
  const closesNum = points.map((p) => toNumber(p.close));
  const low = Math.min(...closesNum);
  const high = Math.max(...closesNum);
  const span = high - low;
  // En periodos cortos la línea del precio medio no debe aplastar la curva: si
  // se sale mucho de la escala del precio, no se dibuja (la leyenda lo dice).
  const avgFits =
    extendToAverage ||
    averages.every((a) => !a || (toNumber(a) >= low - span * 0.25 && toNumber(a) <= high + span * 0.25));
  const data: Point[] = points.map((p, i) => ({
    date: p.date,
    close: closesNum[i],
    label: formatCurrency(p.close),
    avg: avgFits && averages[i] ? toNumber(averages[i]) : null,
    avgLabel: averages[i] ? formatCurrency(averages[i]) : null,
  }));
  const showAvgLine = data.some((d) => d.avg !== null);
  const markersByDate = new Map<string, TradeMarker[]>();
  for (const m of markers) markersByDate.set(m.date, [...(markersByDate.get(m.date) ?? []), m]);
  const longRange = isLongRange(data[0].date, data.at(-1)!.date);
  const dates = data.map((d) => d.date);
  const intraday = hasTime(dates[0]);
  const xTicks = timeAxisTicks(dates);
  const yScale = niceScale([...closesNum, ...data.flatMap((d) => (d.avg === null ? [] : [d.avg]))]);
  const axisLabel = currencyAxisFormatter(yScale.ticks, { hidden: areAmountsHidden() });
  const yWidth = axisWidth(yScale.ticks.map(axisLabel));
  const hasSells = markers.some((m) => m.type === "sell");
  // Cada día con operaciones se dibuja una sola vez sobre la curva.
  const dots = [...markersByDate.entries()].map(([date, list]) => ({
    date,
    close: toNumber(list[0].close),
    hasBuy: list.some((m) => m.type === "buy"),
    hasSell: list.some((m) => m.type === "sell"),
  }));

  return (
    <div>
      <div className="h-48 w-full md:h-56" role="img" aria-label={`Precio de ${asset.name} con ${markers.length} operaciones marcadas`}>
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={data} margin={{ top: 10, right: 12, bottom: 0, left: 0 }}>
            <defs>
              <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="var(--accent)" stopOpacity={0.3} />
                <stop offset="100%" stopColor="var(--accent)" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid vertical={false} stroke="var(--border)" strokeDasharray="3 3" />
            <XAxis
              dataKey="date"
              tickLine={false}
              axisLine={false}
              tick={{ fill: "var(--text-muted)", fontSize: 11 }}
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
              tick={{ fill: "var(--text-muted)", fontSize: 11 }}
              tickFormatter={axisLabel}
            />
            <Tooltip
              cursor={{ stroke: "var(--border)" }}
              content={({ active, payload }) => {
                const point = active ? (payload?.[0]?.payload as Point | undefined) : undefined;
                if (!point) return null;
                const rows: TooltipRow[] = [{ label: intraday ? "Precio" : "Cierre", value: point.label }];
                for (const m of markersByDate.get(point.date) ?? []) {
                  rows.push({
                    label: m.type === "buy" ? "Compra" : "Venta",
                    value: tradeLabel(m),
                    dotClassName: m.type === "buy" ? "bg-accent" : "bg-series-3",
                  });
                }
                if (point.avgLabel) rows.push({ label: "Tu precio medio", value: point.avgLabel, dotClassName: "bg-series-2" });
                return <ChartTooltipPill title={formatPointDate(point.date)} rows={rows} />;
              }}
            />
            <Area
              type="linear"
              dataKey="close"
              stroke="var(--accent)"
              strokeWidth={1.75}
              strokeLinejoin="round"
              fill={`url(#${gradientId})`}
              activeDot={{ r: 4, fill: "var(--accent)", stroke: "var(--surface)", strokeWidth: 2 }}
              animationDuration={200}
            />
            {showAvgLine && (
              <Line
                type="stepAfter"
                dataKey="avg"
                stroke="var(--series-2)"
                strokeDasharray="4 4"
                strokeWidth={1.5}
                dot={false}
                activeDot={false}
                isAnimationActive={false}
              />
            )}
            {dots.map((d) => (
              <ReferenceDot
                key={d.date}
                x={d.date}
                y={d.close}
                r={5.5}
                fill={d.hasSell && !d.hasBuy ? "var(--series-3)" : "var(--accent)"}
                stroke="var(--surface)"
                strokeWidth={2}
              />
            ))}
          </AreaChart>
        </ResponsiveContainer>
      </div>
      <ul className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-text-muted">
        {markers.some((m) => m.type === "buy") && (
          <li className="flex items-center gap-1.5">
            <span className="size-2.5 rounded-full bg-accent" aria-hidden />
            Compra
          </li>
        )}
        {hasSells && (
          <li className="flex items-center gap-1.5">
            <span className="size-2.5 rounded-full bg-series-3" aria-hidden />
            Venta
          </li>
        )}
        {averageCost && (
          <li className="flex items-center gap-1.5">
            <span className="h-0 w-4 border-t-[1.5px] border-dashed border-series-2" aria-hidden />
            Tu precio medio hoy · {formatCurrency(averageCost)}
            {!showAvgLine && <span className="text-text-muted/80">(fuera de escala)</span>}
          </li>
        )}
      </ul>
    </div>
  );
}
