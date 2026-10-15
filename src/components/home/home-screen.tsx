"use client";

import Decimal from "decimal.js";
import { FileUp, Plus, Sparkles } from "lucide-react";
import dynamic from "next/dynamic";
import Link from "next/link";
import { useMemo, useState } from "react";
import { AnimatedAmount } from "@/components/animated-amount";
import { AssetAvatar } from "@/components/asset-avatar";
import { PeriodSelector } from "@/components/charts/period-selector";
import { EmptyState } from "@/components/empty-state";
import { PageHeader } from "@/components/layout/page-header";
import { QuoteFreshness } from "@/components/portfolio/quote-freshness";
import { buttonVariants } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { VariationAmount, VariationBadge } from "@/components/variation-badge";
import type { Repositories } from "@/data/repositories";
import { allocationByAsset, allocationByType } from "@/domain/allocation";
import { periodChange, periodDates, portfolioHistory } from "@/domain/history";
import { PERIODS, type PeriodKey } from "@/domain/models";
import { sortTransactions } from "@/domain/portfolio";
import { useLiveQuery } from "@/hooks/use-live-query";
import { usePortfolio, type PortfolioData } from "@/hooks/use-portfolio";
import { usePriceHistories } from "@/hooks/use-price-histories";
import { formatCurrency, todayIso } from "@/lib/format";
import { ASSET_TYPE_LABELS } from "@/lib/labels";
import { cn } from "@/lib/utils";

// Recharts se carga aparte para no retrasar el primer pintado.
const ValueChart = dynamic(() => import("@/components/charts/value-chart").then((m) => m.ValueChart), {
  ssr: false,
  loading: () => <div className="h-52 animate-pulse rounded-2xl bg-surface-2 md:h-64" aria-hidden />,
});
const AllocationDonut = dynamic(() => import("@/components/charts/allocation-donut").then((m) => m.AllocationDonut), {
  ssr: false,
  loading: () => <div className="h-40 animate-pulse rounded-2xl bg-surface-2" aria-hidden />,
});

const loadSettings = (repositories: Repositories) => repositories.settings.get();
const signedCurrency = (v: Decimal) => formatCurrency(v, { signed: true });

export function HomeScreen() {
  const portfolio = usePortfolio();
  const settings = useLiveQuery(loadSettings);
  const greeting = settings.status === "ready" && settings.data.profileName ? `Hola, ${settings.data.profileName}` : "Inicio";

  return (
    <>
      <PageHeader title={greeting} description="Tu patrimonio, de un vistazo." />
      {portfolio.status === "loading" && <div className="h-72 animate-pulse rounded-card bg-surface" aria-hidden />}
      {portfolio.status === "error" && (
        <Card className="text-sm text-pretty text-text-muted">
          Hay una incoherencia en tus operaciones: {portfolio.error.message} Revísala en Operaciones.
        </Card>
      )}
      {portfolio.status === "ready" &&
        (portfolio.data.transactions.length === 0 ? (
          <EmptyState
            icon={Sparkles}
            title="Empieza tu cartera"
            description="Importa el CSV de Trade Republic o registra tu primera operación. Tus datos se guardan solo en este dispositivo."
            actions={
              <>
                <Link href="/operaciones" className={buttonVariants({ size: "lg" })}>
                  <Plus aria-hidden />
                  Añadir operación
                </Link>
                <Link href="/operaciones/importar" className={buttonVariants({ size: "lg", variant: "outline" })}>
                  <FileUp aria-hidden />
                  Importar CSV
                </Link>
              </>
            }
          />
        ) : (
          <HomeContent
            data={portfolio.data}
            failed={portfolio.failedIds.length}
            defaultPeriod={settings.status === "ready" ? settings.data.defaultPeriod : "1M"}
          />
        ))}
    </>
  );
}

function HomeContent({ data, failed, defaultPeriod }: { data: PortfolioData; failed: number; defaultPeriod: PeriodKey }) {
  const [chosen, setChosen] = useState<PeriodKey | null>(null);
  const period = chosen ?? defaultPeriod;
  const v = data.valuation;
  const today = todayIso();
  const firstDate = useMemo(() => sortTransactions(data.transactions)[0]?.date ?? null, [data.transactions]);
  const dates = useMemo(() => periodDates(period, today, firstDate), [period, today, firstDate]);

  const involvedAssets = useMemo(
    () => [...data.state.positions.keys()].map((id) => data.assets.get(id)).filter((a) => a !== undefined),
    [data.state.positions, data.assets],
  );
  const from = useMemo(() => {
    const d = new Date(`${dates[0]}T00:00:00Z`);
    d.setUTCDate(d.getUTCDate() - 7);
    return d.toISOString().slice(0, 10);
  }, [dates]);
  const histories = usePriceHistories(involvedAssets, from);

  const history = useMemo(() => {
    if (histories.status !== "ready") return null;
    const currentPrices = new Map([...data.prices].map(([id, p]) => [id, new Decimal(p.price)]));
    const points = portfolioHistory(data.transactions, histories.closes, dates, { tracksCash: v.tracksCash, currentPrices });
    return { points, change: periodChange(points) };
  }, [histories, data.prices, data.transactions, dates, v.tracksCash]);

  const periodLabel = PERIODS.find((p) => p.key === period)!.label;
  const byType = allocationByType(v, (id) => data.assets.get(id)?.type ?? "other");
  const byAsset = allocationByAsset(v);
  const ranked = v.positions.filter((p) => p.unrealizedPct).sort((a, b) => b.unrealizedPct!.comparedTo(a.unrealizedPct!));
  const best = ranked.slice(0, 3);
  const worst = ranked.length > 3 ? ranked.slice(-3).reverse().filter((p) => !best.includes(p)) : [];

  return (
    <div className="grid grid-cols-[minmax(0,1fr)] gap-4 md:gap-5 lg:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)] lg:items-start">
      <Card className="lg:row-span-2">
        <p className="text-sm text-text-muted">{v.tracksCash ? "Patrimonio" : "Valor de la cartera"}</p>
        <div className="@container">
          <AnimatedAmount value={v.totalValue} className="hero-figure mt-1 block whitespace-nowrap" />
        </div>
        <div className="mt-3 flex min-h-6 flex-wrap items-center gap-2">
          {history?.change ? (
            <>
              <VariationBadge ratio={history.change.pct} />
              <VariationAmount value={history.change.gain} format={signedCurrency} className="text-sm" />
              <span className="text-sm text-text-muted">{period === "ALL" ? "desde el inicio" : `en ${periodLabel}`}</span>
            </>
          ) : (
            <span className="h-5 w-40 animate-pulse rounded-full bg-surface-2" aria-hidden />
          )}
        </div>

        <PeriodSelector value={period} onChange={setChosen} className="mt-5" />
        <div className="mt-4 -mx-1">
          {history ? (
            <ValueChart points={history.points} investedLabel={v.tracksCash ? "Aportado" : "Invertido"} />
          ) : (
            <div className="h-52 animate-pulse rounded-2xl bg-surface-2 md:h-64" aria-hidden />
          )}
        </div>
        <QuoteFreshness
          oldest={data.oldestQuote}
          failed={failed + (histories.status === "ready" ? histories.failed : 0)}
          missing={v.missingPrices}
          className="mt-3"
        />
      </Card>

      <Card>
        <h2 className="font-medium">Resumen</h2>
        <dl className="mt-3 divide-y divide-border text-sm">
          <Row label={v.tracksCash ? "Aportado neto" : "Invertido"} value={formatCurrency(v.tracksCash ? data.state.netDeposits : v.invested)} />
          <Row label="Ganancia total" value={<VariationAmount value={v.totalGain} format={signedCurrency} />} />
          <Row label="No realizado" value={<VariationAmount value={v.unrealized} format={signedCurrency} />} />
          <Row label="Realizado" value={<VariationAmount value={v.realized} format={signedCurrency} />} />
          {!data.state.dividends.isZero() && <Row label="Dividendos netos" value={formatCurrency(data.state.dividends)} />}
          {!data.state.fees.isZero() && <Row label="Comisiones" value={formatCurrency(data.state.fees.negated())} />}
          {v.tracksCash && <Row label="Efectivo" value={formatCurrency(v.cash)} />}
        </dl>
      </Card>

      {byAsset.length > 0 && <AllocationCard byType={byType} byAsset={byAsset} data={data} />}

      {best.length > 0 && (
        <Card className="lg:col-span-2">
          <h2 className="font-medium">Movimientos de tus posiciones</h2>
          <div className={cn("mt-3 grid gap-4", worst.length > 0 && "md:grid-cols-2")}>
            <RankList title="Más suben" items={best} data={data} />
            {worst.length > 0 && <RankList title="Más bajan" items={worst} data={data} />}
          </div>
        </Card>
      )}
    </div>
  );
}

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-4 py-2.5">
      <dt className="text-text-muted">{label}</dt>
      <dd className="font-medium tabular-nums">{value}</dd>
    </div>
  );
}

function AllocationCard({
  byType,
  byAsset,
  data,
}: {
  byType: ReturnType<typeof allocationByType>;
  byAsset: ReturnType<typeof allocationByAsset>;
  data: PortfolioData;
}) {
  const [mode, setMode] = useState<"asset" | "type">("asset");
  const slices = mode === "asset" ? byAsset : byType;
  const labelOf = (key: string) =>
    mode === "type"
      ? ASSET_TYPE_LABELS[key as keyof typeof ASSET_TYPE_LABELS]
      : key === "other"
        ? "Otros"
        : (data.assets.get(key)?.name ?? "Activo");

  return (
    <Card>
      <div className="flex items-center justify-between gap-3">
        <h2 className="font-medium">Distribución</h2>
        <div role="radiogroup" aria-label="Agrupar por" className="flex gap-0.5 rounded-full bg-surface-2 p-1">
          {(["asset", "type"] as const).map((m) => (
            <button
              key={m}
              type="button"
              role="radio"
              aria-checked={mode === m}
              onClick={() => setMode(m)}
              className={cn(
                "h-7 rounded-full px-3 text-xs font-medium transition-colors outline-none focus-visible:ring-3 focus-visible:ring-accent/40",
                mode === m ? "bg-accent text-accent-foreground" : "text-text-muted hover:text-text",
              )}
            >
              {m === "asset" ? "Activo" : "Tipo"}
            </button>
          ))}
        </div>
      </div>
      <div className="mt-4">
        <AllocationDonut slices={slices} labelOf={labelOf} />
      </div>
    </Card>
  );
}

function RankList({ title, items, data }: { title: string; items: PortfolioData["valuation"]["positions"]; data: PortfolioData }) {
  return (
    <div className="min-w-0">
      <h3 className="mb-1 text-xs text-text-muted">{title}</h3>
      <ul>
        {items.map((p) => {
          const asset = data.assets.get(p.position.assetId);
          return (
            <li key={p.position.assetId} className="flex items-center gap-3 py-2">
              {asset && <AssetAvatar asset={asset} className="size-8 text-[10px]" />}
              <span className="min-w-0 flex-1 truncate text-sm">{asset?.name}</span>
              <VariationBadge ratio={p.unrealizedPct} />
            </li>
          );
        })}
      </ul>
    </div>
  );
}
