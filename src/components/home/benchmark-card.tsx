"use client";

import Decimal from "decimal.js";
import { useMemo, useState } from "react";
import { CartesianGrid, Line, LineChart, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { ChartTooltipPill } from "@/components/charts/chart-tooltip";
import { Card } from "@/components/ui/card";
import { VariationAmount } from "@/components/variation-badge";
import { BENCHMARKS, benchmarkHistory, cumulativeReturn, type BenchmarkId } from "@/domain/benchmark";
import { periodDates, portfolioHistory } from "@/domain/history";
import type { Asset } from "@/domain/models";
import { sortTransactions } from "@/domain/portfolio";
import type { PortfolioData } from "@/hooks/use-portfolio";
import { usePriceHistories } from "@/hooks/use-price-histories";
import { formatCurrency, formatDate, formatNumber, formatPercent, todayIso } from "@/lib/format";
import { cn } from "@/lib/utils";

const MONTHS = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sept", "oct", "nov", "dic"];
const shortDate = (iso: string) => {
  const [y, m] = iso.split("-");
  return `${MONTHS[Number(m) - 1]} ${y.slice(2)}`;
};

interface Point {
  date: string;
  // Números solo para la geometría; las etiquetas salen de Decimal.
  you: number | null;
  index: number | null;
  youLabel: string;
  indexLabel: string;
}

/** "¿Le ganas al índice?": tu rentabilidad frente a la del índice con tu mismo dinero y calendario. */
export function BenchmarkCard({ data }: { data: PortfolioData }) {
  const [benchmark, setBenchmark] = useState<BenchmarkId>("EUNL.DE");
  const today = todayIso();
  const trades = useMemo(() => data.transactions.filter((t) => t.type === "buy" || t.type === "sell"), [data.transactions]);
  const firstDate = useMemo(() => sortTransactions(trades)[0]?.date ?? null, [trades]);
  const dates = useMemo(() => periodDates("ALL", today, firstDate), [today, firstDate]);
  const from = useMemo(() => {
    const d = new Date(`${dates[0]}T00:00:00Z`);
    d.setUTCDate(d.getUTCDate() - 7);
    return d.toISOString().slice(0, 10);
  }, [dates]);

  const assets = useMemo(() => {
    const benchAsset: Asset = { id: `bench:${benchmark}`, name: benchmark, type: "etf", priceSource: "yahoo", priceSourceId: benchmark };
    const own = [...data.state.positions.keys()].map((id) => data.assets.get(id)).filter((a): a is Asset => Boolean(a));
    return [...own, benchAsset];
  }, [data.state.positions, data.assets, benchmark]);
  const histories = usePriceHistories(assets, firstDate ? from : null);

  const view = useMemo(() => {
    if (histories.status !== "ready") return null;
    const benchCloses = histories.closes.get(`bench:${benchmark}`);
    if (!benchCloses?.length) return { failed: true as const };
    const currentPrices = new Map([...data.prices].map(([id, p]) => [id, new Decimal(p.price)]));
    const mine = portfolioHistory(data.transactions, histories.closes, dates, { currentPrices });
    const theirs = benchmarkHistory(trades, benchCloses, dates);
    const points: Point[] = mine.map((p, i) => {
      const you = cumulativeReturn(p);
      const index = cumulativeReturn(theirs[i]);
      return {
        date: p.date,
        you: you ? Number(you.times(100).toFixed(2)) : null,
        index: index ? Number(index.times(100).toFixed(2)) : null,
        youLabel: you ? formatPercent(you) : "—",
        indexLabel: index ? formatPercent(index) : "—",
      };
    });
    const lastMine = mine.at(-1)!;
    const lastTheirs = theirs.at(-1)!;
    const you = cumulativeReturn(lastMine);
    const index = cumulativeReturn(lastTheirs);
    const euros = lastMine.value.plus(lastMine.proceeds).minus(lastTheirs.value.plus(lastTheirs.proceeds));
    return { failed: false as const, points, you, index, euros };
  }, [histories, benchmark, data.prices, data.transactions, dates, trades]);

  const label = BENCHMARKS.find((b) => b.id === benchmark)!.label;
  const diff = view && !view.failed && view.you && view.index ? view.you.minus(view.index) : null;

  return (
    <Card>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="font-medium">¿Le ganas al índice?</h2>
          <p className="mt-0.5 text-xs text-text-muted">
            Tu mismo dinero, en las mismas fechas, metido en un ETF {firstDate ? `desde ${formatDate(firstDate.slice(0, 10))}` : ""}.
          </p>
        </div>
        <div role="radiogroup" aria-label="Índice" className="flex gap-0.5 rounded-full bg-surface-2 p-0.5">
          {BENCHMARKS.map((b) => (
            <button
              key={b.id}
              type="button"
              role="radio"
              aria-checked={benchmark === b.id}
              title={b.name}
              onClick={() => setBenchmark(b.id)}
              className={cn(
                "h-7 rounded-full px-2.5 text-[11px] font-medium transition-colors outline-none focus-visible:ring-3 focus-visible:ring-accent/40",
                benchmark === b.id ? "bg-accent text-accent-foreground" : "text-text-muted hover:text-text",
              )}
            >
              {b.label}
            </button>
          ))}
        </div>
      </div>

      {!view ? (
        <div className="mt-4 h-56 animate-pulse rounded-2xl bg-surface-2" aria-hidden />
      ) : view.failed ? (
        <p className="mt-4 text-sm text-text-muted">No se pudo cargar el histórico del índice. Inténtalo más tarde.</p>
      ) : (
        <>
          <div className="mt-4 grid grid-cols-2 gap-3">
            <Stat label="Tú" value={view.you} dot="bg-accent" />
            <Stat label={label} value={view.index} dot="bg-series-2" />
          </div>
          {diff && (
            <p className="mt-3 text-sm text-pretty">
              <VariationAmount value={diff} format={(d) => `${formatNumber(d.abs().times(100), 1)} puntos`} className="font-medium" />{" "}
              {diff.isNegative() ? "por detrás" : "por delante"} del {label}
              <span className="text-text-muted"> · {formatCurrency(view.euros, { signed: true })} frente a haber comprado el índice</span>
            </p>
          )}
          <div className="mt-4 h-52 w-full md:h-60" role="img" aria-label={`Tu rentabilidad frente al ${label}`}>
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={view.points} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
                <CartesianGrid vertical={false} stroke="var(--border)" strokeDasharray="3 3" />
                <XAxis dataKey="date" tickLine={false} axisLine={false} minTickGap={32} tick={{ fill: "var(--text-muted)", fontSize: 11 }} tickFormatter={shortDate} />
                <YAxis tickLine={false} axisLine={false} width={44} tick={{ fill: "var(--text-muted)", fontSize: 11 }} tickFormatter={(v: number) => `${Math.round(v)}%`} />
                <ReferenceLine y={0} stroke="var(--border)" />
                <Tooltip
                  cursor={{ stroke: "var(--border)" }}
                  content={({ active, payload }) => {
                    const point = active ? (payload?.[0]?.payload as Point | undefined) : undefined;
                    if (!point) return null;
                    return (
                      <ChartTooltipPill
                        title={formatDate(point.date)}
                        rows={[
                          { label: "Tú", value: point.youLabel, dotClassName: "bg-accent" },
                          { label, value: point.indexLabel, dotClassName: "bg-series-2" },
                        ]}
                      />
                    );
                  }}
                />
                <Line type="monotone" dataKey="index" stroke="var(--series-2)" strokeWidth={2} dot={false} connectNulls animationDuration={200} />
                <Line type="monotone" dataKey="you" stroke="var(--accent)" strokeWidth={2.5} dot={false} connectNulls animationDuration={200} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </>
      )}
    </Card>
  );
}

function Stat({ label, value, dot }: { label: string; value: Decimal | null; dot: string }) {
  return (
    <div className="rounded-2xl bg-surface-2 p-3.5">
      <p className="flex items-center gap-2 text-xs text-text-muted">
        <span className={cn("size-2 rounded-full", dot)} aria-hidden />
        {label}
      </p>
      <p className="mt-1 text-lg font-medium tabular-nums">
        {value ? <VariationAmount value={value} format={(v) => formatPercent(v)} /> : "—"}
      </p>
    </div>
  );
}
