"use client";

import Decimal from "decimal.js";
import { CalendarCheck, Flame, Rocket, Sparkles, TrendingDown, TrendingUp, Undo2 } from "lucide-react";
import Link from "next/link";
import { useMemo, useState, type ReactNode } from "react";
import { Bar, BarChart, Cell, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { AssetAvatar } from "@/components/asset-avatar";
import { ChartTooltipPill } from "@/components/charts/chart-tooltip";
import { EmptyState } from "@/components/empty-state";
import { PageHeader } from "@/components/layout/page-header";
import { ShareButton } from "@/components/share/share-sheet";
import { buttonVariants } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { VariationAmount, VariationBadge } from "@/components/variation-badge";
import { portfolioHistory } from "@/domain/history";
import { summarizeYear, yearCutoffs, yearsWithActivity, type YearSummary } from "@/domain/year";
import { usePortfolio, type PortfolioData } from "@/hooks/use-portfolio";
import { usePriceHistories } from "@/hooks/use-price-histories";
import { formatCurrency, formatDate, formatPercent, todayIso } from "@/lib/format";
import { buildYearCard } from "@/lib/share-builders";
import { cn } from "@/lib/utils";

const MONTHS = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sept", "oct", "nov", "dic"];
const MONTHS_LONG = ["enero", "febrero", "marzo", "abril", "mayo", "junio", "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre"];
const signed = (v: Decimal) => formatCurrency(v, { signed: true });
const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;

export function YearScreen() {
  const portfolio = usePortfolio();
  return (
    <>
      <PageHeader title="Tu año en cúmulo" description="Tu año inversor, sin adornos." />
      {portfolio.status === "loading" && <div className="h-80 animate-pulse rounded-card bg-surface" aria-hidden />}
      {portfolio.status === "error" && <Card className="text-sm text-text-muted">{portfolio.error.message}</Card>}
      {portfolio.status === "ready" &&
        (portfolio.data.transactions.some((t) => t.type === "buy") ? (
          <YearContent data={portfolio.data} />
        ) : (
          <EmptyState
            icon={Sparkles}
            title="Aún no hay año que contar"
            description="Cuando registres tus compras verás aquí tu resumen del año: meses aportando, mejor mes, mejor compra y más."
            actions={
              <Link href="/operaciones" className={buttonVariants({ size: "lg" })}>
                Ir a operaciones
              </Link>
            }
          />
        ))}
    </>
  );
}

function YearContent({ data }: { data: PortfolioData }) {
  const today = todayIso();
  const years = useMemo(() => yearsWithActivity(data.transactions, today), [data.transactions, today]);
  const [year, setYear] = useState(years[0]);
  const isCurrent = String(year) === today.slice(0, 4);
  const cutoffs = useMemo(() => yearCutoffs(year, today), [year, today]);
  const from = useMemo(() => `${year - 1}-12-20`, [year]);
  const assets = useMemo(
    () => [...data.state.positions.keys()].map((id) => data.assets.get(id)).filter((a) => a !== undefined),
    [data.state.positions, data.assets],
  );
  const histories = usePriceHistories(assets, from);

  const summary = useMemo(() => {
    if (histories.status !== "ready") return null;
    const currentPrices = new Map([...data.prices].map(([id, p]) => [id, new Decimal(p.price)]));
    const history = portfolioHistory(data.transactions, histories.closes, cutoffs, { currentPrices, currentOnLastDay: isCurrent });
    return summarizeYear({ year, transactions: data.transactions, history, state: data.state, currentPrices, today });
  }, [histories, data, cutoffs, isCurrent, year, today]);

  return (
    <div className="grid grid-cols-[minmax(0,1fr)] gap-4 md:gap-5">
      {years.length > 1 && (
        <div role="radiogroup" aria-label="Año" className="flex flex-wrap gap-1.5">
          {years.map((y) => (
            <button
              key={y}
              type="button"
              role="radio"
              aria-checked={year === y}
              onClick={() => setYear(y)}
              className={cn(
                "h-9 rounded-full border px-4 text-sm font-medium tabular-nums transition-colors outline-none focus-visible:ring-3 focus-visible:ring-accent/40",
                year === y ? "border-accent bg-accent text-accent-foreground" : "border-border text-text-muted hover:text-text",
              )}
            >
              {y}
            </button>
          ))}
        </div>
      )}

      {!summary ? (
        <div className="h-96 animate-pulse rounded-card bg-surface" aria-hidden />
      ) : (
        <YearView summary={summary} data={data} isCurrent={isCurrent} />
      )}
    </div>
  );
}

function YearView({ summary: s, data, isCurrent }: { summary: YearSummary; data: PortfolioData; isCurrent: boolean }) {
  const best = s.bestBuy ? data.assets.get(s.bestBuy.transaction.assetId!) : undefined;
  const top = s.topAssetId ? data.assets.get(s.topAssetId) : undefined;
  const bars = s.months.map((m) => ({
    label: MONTHS[m.month - 1],
    value: m.pct ? Number(m.pct.times(100).toFixed(2)) : 0,
    pctLabel: m.pct ? formatPercent(m.pct) : "—",
    gainLabel: signed(m.gain),
    month: MONTHS_LONG[m.month - 1],
  }));

  return (
    <>
      <Card className="relative overflow-hidden">
        <div className="pointer-events-none absolute -top-24 -left-16 size-72 rounded-full bg-accent/20 blur-3xl" aria-hidden />
        <div className="relative">
          <p className="text-sm text-text-muted">{isCurrent ? `Tu ${s.year} hasta hoy` : `Tu ${s.year}`}</p>
          <p className={cn("hero-figure mt-2", s.change?.pct ? (s.change.pct.isNegative() ? "text-negative" : "text-positive") : "text-accent")}>
            {s.change?.pct ? formatPercent(s.change.pct) : "—"}
          </p>
          <p className="mt-2 text-sm text-text-muted">
            Rentabilidad del año{s.change ? <> · <VariationAmount value={s.change.gain} format={signed} /></> : null}
          </p>
          <ShareButton
            title={`Compartir tu ${s.year}`}
            fileName={`cumulo-${s.year}`}
            build={(o) => buildYearCard(data, s, o)}
            className="mt-4"
          />
        </div>
      </Card>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4 md:gap-5">
        <Tile icon={<CalendarCheck />} label="Meses aportando" value={`${s.activeMonths.length} de ${isCurrent ? s.months.length || 1 : 12}`} />
        <Tile icon={<Flame />} label="Racha más larga" value={`${s.longestStreak} ${s.longestStreak === 1 ? "mes" : "meses"}`} />
        <Tile icon={<Rocket />} label="Aportado" value={formatCurrency(s.bought)} hint={plural(s.buys, "compra", "compras")} />
        <Tile icon={<Undo2 />} label="Cobrado en ventas" value={formatCurrency(s.proceeds)} hint={plural(s.sells, "venta", "ventas")} />
      </div>

      {bars.length > 0 && (
        <Card>
          <h2 className="font-medium">Mes a mes</h2>
          <p className="mt-0.5 text-xs text-text-muted">Rentabilidad de cada mes, sin contar lo que aportaste.</p>
          <div className="mt-4 h-52 w-full" role="img" aria-label="Rentabilidad de cada mes">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={bars} margin={{ top: 6, right: 0, bottom: 0, left: 0 }}>
                <XAxis dataKey="label" tickLine={false} axisLine={false} interval={0} tick={{ fill: "var(--text-muted)", fontSize: 11 }} />
                <YAxis tickLine={false} axisLine={false} width={40} tick={{ fill: "var(--text-muted)", fontSize: 11 }} tickFormatter={(v: number) => `${Math.round(v)}%`} />
                <ReferenceLine y={0} stroke="var(--border)" />
                <Tooltip
                  cursor={{ fill: "var(--surface-2)" }}
                  content={({ active, payload }) => {
                    const bar = active ? (payload?.[0]?.payload as (typeof bars)[number] | undefined) : undefined;
                    if (!bar) return null;
                    return (
                      <ChartTooltipPill
                        title={bar.month}
                        rows={[
                          { label: "Rentabilidad", value: bar.pctLabel },
                          { label: "Ganancia", value: bar.gainLabel },
                        ]}
                      />
                    );
                  }}
                />
                <Bar dataKey="value" radius={[6, 6, 6, 6]} maxBarSize={28} animationDuration={200}>
                  {bars.map((b) => (
                    <Cell key={b.label} fill={b.value >= 0 ? "var(--positive)" : "var(--negative)"} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Card>
      )}

      <div className="grid grid-cols-[minmax(0,1fr)] gap-4 md:grid-cols-2 md:gap-5">
        {s.bestMonth && (
          <Highlight icon={<TrendingUp className="text-positive" />} title="Mejor mes" value={MONTHS_LONG[s.bestMonth.month - 1]}>
            <VariationBadge ratio={s.bestMonth.pct} />
          </Highlight>
        )}
        {s.worstMonth && (
          <Highlight icon={<TrendingDown className="text-negative" />} title="Peor mes" value={MONTHS_LONG[s.worstMonth.month - 1]}>
            <VariationBadge ratio={s.worstMonth.pct} />
          </Highlight>
        )}
        {s.bestBuy && best && (
          <Highlight
            icon={<AssetAvatar asset={best} className="size-8" />}
            title="Tu mejor compra del año"
            value={best.name}
            detail={`${formatDate(s.bestBuy.transaction.date.slice(0, 10))} a ${formatCurrency(s.bestBuy.transaction.price, { reveal: true })}`}
          >
            <VariationBadge ratio={s.bestBuy.gainPct} />
          </Highlight>
        )}
        {top && (
          <Highlight icon={<AssetAvatar asset={top} className="size-8" />} title="Donde más metiste" value={top.name} />
        )}
        {s.sold && (
          <Highlight
            icon={<Undo2 className="text-accent" />}
            title="Si no hubieras vendido"
            value={
              s.sold.difference.isZero()
                ? "Daría igual"
                : s.sold.difference.isPositive()
                  ? "Hoy valdría más"
                  : "Vender fue buena idea"
            }
            detail={`Lo vendido valdría hoy ${formatCurrency(s.sold.valueToday)} (cobraste ${formatCurrency(s.sold.proceeds)})`}
          >
            <VariationAmount value={s.sold.difference.negated()} format={signed} className="text-sm font-medium" />
          </Highlight>
        )}
      </div>
    </>
  );
}

function Tile({ icon, label, value, hint }: { icon: ReactNode; label: string; value: string; hint?: string }) {
  return (
    <Card className="p-4 md:p-5">
      <span className="flex size-8 items-center justify-center rounded-full bg-accent/15 text-accent [&_svg]:size-4" aria-hidden>
        {icon}
      </span>
      <p className="mt-3 text-xs text-text-muted">{label}</p>
      <p className="mt-0.5 truncate text-lg font-medium tabular-nums">{value}</p>
      {hint && <p className="text-xs text-text-muted">{hint}</p>}
    </Card>
  );
}

function Highlight({ icon, title, value, detail, children }: { icon: ReactNode; title: string; value: string; detail?: string; children?: ReactNode }) {
  return (
    <Card className="flex items-center gap-4 p-4 md:p-5">
      <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-surface-2 [&_svg]:size-5" aria-hidden>
        {icon}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-xs text-text-muted">{title}</span>
        <span className="block truncate font-medium first-letter:uppercase">{value}</span>
        {detail && <span className="block truncate text-xs text-text-muted tabular-nums">{detail}</span>}
      </span>
      {children && <span className="shrink-0">{children}</span>}
    </Card>
  );
}
