"use client";

import Decimal from "decimal.js";
import { useMemo } from "react";
import { Area, AreaChart, CartesianGrid, ReferenceDot, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { ChartTooltipPill, type TooltipRow } from "@/components/charts/chart-tooltip";
import type { Asset, Transaction } from "@/domain/models";
import { priceSeriesWithTrades, type TradeMarker } from "@/domain/trade-markers";
import { usePriceHistories } from "@/hooks/use-price-histories";
import { formatCompactCurrency, formatCurrency, formatDate, formatNumber, todayIso } from "@/lib/format";

interface AssetPriceChartProps {
  asset: Asset;
  transactions: Transaction[];
  currentPrice: Decimal | null;
}

interface Point {
  date: string;
  // Número solo para la geometría; las etiquetas salen de Decimal.
  close: number;
  label: string;
}

const MONTHS = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sept", "oct", "nov", "dic"];
const shortDate = (iso: string, withYear: boolean) => {
  const [y, m, d] = iso.split("-");
  return withYear ? `${MONTHS[Number(m) - 1]} ${y.slice(2)}` : `${Number(d)} ${MONTHS[Number(m) - 1]}`;
};

const tradeLabel = (m: TradeMarker) =>
  `${formatNumber(m.quantity, Math.min(8, m.quantity.decimalPlaces()))} × ${formatCurrency(m.price)}`;

/** Precio del activo desde la primera operación, con un punto en cada compra y venta. */
export function AssetPriceChart({ asset, transactions, currentPrice }: AssetPriceChartProps) {
  const trades = useMemo(() => transactions.filter((t) => t.type === "buy" || t.type === "sell"), [transactions]);
  const from = useMemo(() => {
    const first = trades.map((t) => t.date.slice(0, 10)).sort()[0] ?? todayIso();
    const d = new Date(`${first}T00:00:00Z`);
    d.setUTCDate(d.getUTCDate() - 7);
    return d.toISOString().slice(0, 10);
  }, [trades]);
  const assets = useMemo(() => [asset], [asset]);
  const histories = usePriceHistories(assets, asset.priceSource === "manual" ? null : from);

  const series = useMemo(() => {
    if (histories.status !== "ready") return null;
    const closes = histories.closes.get(asset.id) ?? [];
    return priceSeriesWithTrades(closes, trades, currentPrice ? { date: todayIso(), price: currentPrice } : undefined);
  }, [histories, asset.id, trades, currentPrice]);

  if (asset.priceSource === "manual") {
    return <p className="rounded-2xl bg-surface-2 px-4 py-3 text-sm text-text-muted">Sin histórico: este activo tiene precio manual.</p>;
  }
  if (!series) return <div className="h-48 animate-pulse rounded-2xl bg-surface-2" aria-hidden />;
  if (series.points.length < 2) {
    return <p className="rounded-2xl bg-surface-2 px-4 py-3 text-sm text-text-muted">Aún no hay histórico de precios para este activo.</p>;
  }

  const data: Point[] = series.points.map((p) => ({ date: p.date, close: Number(p.close.toFixed(6)), label: formatCurrency(p.close) }));
  const markersByDate = new Map<string, TradeMarker[]>();
  for (const m of series.markers) markersByDate.set(m.date, [...(markersByDate.get(m.date) ?? []), m]);
  const longRange = Date.parse(data.at(-1)!.date) - Date.parse(data[0].date) > 400 * 86_400_000;
  const hasSells = series.markers.some((m) => m.type === "sell");

  return (
    <div>
      <div
        className="h-48 w-full md:h-56"
        role="img"
        aria-label={`Precio de ${asset.name} con ${series.markers.length} operaciones marcadas`}
      >
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
              tickFormatter={(d: string) => shortDate(d, longRange)}
              minTickGap={24}
            />
            <YAxis
              tickLine={false}
              axisLine={false}
              width={60}
              domain={["auto", "auto"]}
              tick={{ fill: "var(--text-muted)", fontSize: 11 }}
              tickFormatter={(v: number) => formatCompactCurrency(String(v))}
            />
            <Tooltip
              cursor={{ stroke: "var(--border)" }}
              content={({ active, payload }) => {
                const point = active ? (payload?.[0]?.payload as Point | undefined) : undefined;
                if (!point) return null;
                const rows: TooltipRow[] = [{ label: "Precio", value: point.label }];
                for (const m of markersByDate.get(point.date) ?? []) {
                  rows.push({
                    label: m.type === "buy" ? "Compra" : "Venta",
                    value: tradeLabel(m),
                    dotClassName: m.type === "buy" ? "bg-accent" : "bg-series-2",
                  });
                }
                return <ChartTooltipPill title={formatDate(point.date)} rows={rows} />;
              }}
            />
            <Area type="monotone" dataKey="close" stroke="var(--accent)" strokeWidth={2} fill="url(#fill-asset-price)" animationDuration={200} />
            {series.markers.map((m) => (
              <ReferenceDot
                key={m.transactionId}
                x={m.date}
                y={Number(m.price.toFixed(6))}
                r={5}
                fill={m.type === "buy" ? "var(--accent)" : "var(--series-2)"}
                stroke="var(--surface)"
                strokeWidth={2}
                ifOverflow="extendDomain"
              />
            ))}
          </AreaChart>
        </ResponsiveContainer>
      </div>
      <ul className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-text-muted">
        <li className="flex items-center gap-1.5">
          <span className="size-2.5 rounded-full bg-accent" aria-hidden />
          Compra
        </li>
        {hasSells && (
          <li className="flex items-center gap-1.5">
            <span className="size-2.5 rounded-full bg-series-2" aria-hidden />
            Venta
          </li>
        )}
        <li>Puntos al precio de cada operación</li>
      </ul>
      {histories.status === "ready" && histories.failed > 0 && (
        <p className="mt-1 text-xs text-text-muted">No se pudo cargar el histórico; se muestra lo disponible.</p>
      )}
    </div>
  );
}
