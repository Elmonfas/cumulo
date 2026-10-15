"use client";

import Decimal from "decimal.js";
import { useMemo, useState } from "react";
import { Area, AreaChart, CartesianGrid, Line, ReferenceDot, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { ChartTooltipPill, type TooltipRow } from "@/components/charts/chart-tooltip";
import { PeriodSelector } from "@/components/charts/period-selector";
import { VariationBadge } from "@/components/variation-badge";
import { addDays, periodStart } from "@/domain/history";
import type { Asset, PeriodKey, Transaction } from "@/domain/models";
import { averageCostSeries, priceSeriesWithTrades, type TradeMarker } from "@/domain/trade-markers";
import { usePriceHistories } from "@/hooks/use-price-histories";
import { areAmountsHidden, formatAxisDate, formatCompactCurrency, formatCurrency, formatDate, formatNumber, formatQuantity, isLongRange, MASK, todayIso } from "@/lib/format";

interface AssetPriceChartProps {
  asset: Asset;
  transactions: Transaction[];
  currentPrice: Decimal | null;
  /** Precio medio de compra de la posición abierta; null si está cerrada. */
  averageCost: Decimal | null;
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

const PERIODS: PeriodKey[] = ["1W", "1M", "YTD", "1Y", "ALL"];
const toNumber = (d: Decimal) => Number(d.toFixed(6));
const tradeLabel = (m: TradeMarker) =>
  `${formatQuantity(m.quantity)} × ${formatCurrency(m.price)}`;

/**
 * Precio del activo con un punto sobre la curva en cada compra y venta, y la
 * línea del precio medio de compra para ver de un vistazo si vas en positivo.
 */
export function AssetPriceChart({ asset, transactions, currentPrice, averageCost }: AssetPriceChartProps) {
  const today = todayIso();
  const trades = useMemo(() => transactions.filter((t) => t.type === "buy" || t.type === "sell"), [transactions]);
  // Sin operaciones (activo seguido) "Todo" no tiene sentido: se empieza por un año.
  const [period, setPeriod] = useState<PeriodKey>(() => (trades.length ? "ALL" : "1Y"));
  const firstTrade = useMemo(() => trades.map((t) => t.date.slice(0, 10)).sort()[0] ?? today, [trades, today]);

  // Un único histórico que cubre todos los periodos; luego se recorta.
  const fetchFrom = useMemo(() => {
    const yearAgo = addDays(today, -366);
    return addDays(firstTrade < yearAgo ? firstTrade : yearAgo, -7);
  }, [firstTrade, today]);
  const assets = useMemo(() => [asset], [asset]);
  const histories = usePriceHistories(assets, asset.priceSource === "manual" ? null : fetchFrom);

  const series = useMemo(() => {
    if (histories.status !== "ready") return null;
    const start = period === "ALL" ? (trades.length ? firstTrade : addDays(today, -365)) : periodStart(period, today, firstTrade);
    const closes = histories.closes.get(asset.id) ?? [];
    return priceSeriesWithTrades(closes, trades, currentPrice ? { date: today, price: currentPrice } : undefined, start);
  }, [histories, asset.id, trades, currentPrice, period, firstTrade, today]);

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
  // Con rangos estrechos (p. ej. una semana) el formato compacto repetiría etiquetas: se usan decimales.
  const axisDecimals = high >= 1000 ? null : span < 2 ? 2 : span < 20 ? 1 : 0;
  const axisLabel = (v: number) =>
    areAmountsHidden() ? MASK : axisDecimals === null ? formatCompactCurrency(String(v)) : `${formatNumber(new Decimal(String(v)), axisDecimals)} €`;
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
              <linearGradient id="fill-asset-price" x1="0" y1="0" x2="0" y2="1">
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
              tickFormatter={(d: string) => formatAxisDate(d, longRange)}
              minTickGap={24}
            />
            <YAxis
              tickLine={false}
              axisLine={false}
              width={60}
              domain={["auto", "auto"]}
              tick={{ fill: "var(--text-muted)", fontSize: 11 }}
              tickFormatter={axisLabel}
            />
            <Tooltip
              cursor={{ stroke: "var(--border)" }}
              content={({ active, payload }) => {
                const point = active ? (payload?.[0]?.payload as Point | undefined) : undefined;
                if (!point) return null;
                const rows: TooltipRow[] = [{ label: "Cierre", value: point.label }];
                for (const m of markersByDate.get(point.date) ?? []) {
                  rows.push({
                    label: m.type === "buy" ? "Compra" : "Venta",
                    value: tradeLabel(m),
                    dotClassName: m.type === "buy" ? "bg-accent" : "bg-series-2",
                  });
                }
                if (point.avgLabel) rows.push({ label: "Tu precio medio", value: point.avgLabel, dotClassName: "bg-series-2" });
                return <ChartTooltipPill title={formatDate(point.date)} rows={rows} />;
              }}
            />
            <Area type="monotone" dataKey="close" stroke="var(--accent)" strokeWidth={2} fill="url(#fill-asset-price)" animationDuration={200} />
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
                fill={d.hasSell && !d.hasBuy ? "var(--series-2)" : "var(--accent)"}
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
            <span className="size-2.5 rounded-full bg-series-2" aria-hidden />
            Venta
          </li>
        )}
        {averageCost && (
          <li className="flex items-center gap-1.5">
            <span className="h-0 w-4 border-t-[1.5px] border-dashed border-series-2" aria-hidden />
            Tu precio medio hoy · {formatCurrency(averageCost)}
          </li>
        )}
      </ul>
    </div>
  );
}
