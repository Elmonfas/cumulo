"use client";

import Decimal from "decimal.js";
import { ChevronRight, PieChart } from "lucide-react";
import dynamic from "next/dynamic";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { AnimatedAmount } from "@/components/animated-amount";
import { AssetAvatar } from "@/components/asset-avatar";
import { EmptyState } from "@/components/empty-state";
import { PageHeader } from "@/components/layout/page-header";
import { buttonVariants } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Sheet } from "@/components/ui/sheet";
import { VariationAmount, VariationBadge } from "@/components/variation-badge";
import type { PositionValuation } from "@/domain/valuation";
import { useWideScreen } from "@/hooks/use-media-query";
import { usePortfolio, type PortfolioData } from "@/hooks/use-portfolio";
import { formatCurrency, formatPercent, formatQuantity, todayIso } from "@/lib/format";
import { annualReturn } from "@/domain/performance";
import { ASSET_TYPE_LABELS } from "@/lib/labels";

import { QuoteFreshness, quotesOf } from "./quote-freshness";
import { RefreshPricesButton } from "./refresh-prices-button";
import { PositionsTable, sortPositions, type SortState } from "./positions-table";
import { WatchlistSection } from "./watchlist-section";
import { ShareButton } from "@/components/share/share-sheet";
import { buildPortfolioCard } from "@/lib/share-builders";

const PositionDetail = dynamic(() => import("./position-detail").then((m) => m.PositionDetail), { ssr: false });

const signedCurrency = (v: Decimal) => formatCurrency(v, { signed: true });
const quantityText = (q: Decimal) => formatQuantity(q);

const SELECTED_PARAM = "activo";

/** Posición elegida en la URL (?activo=…), para volver a ella en escritorio. */
function selectedFromUrl(): string | null {
  if (typeof window === "undefined") return null;
  return new URLSearchParams(window.location.search).get(SELECTED_PARAM);
}

export function PortfolioScreen() {
  const portfolio = usePortfolio();
  const wide = useWideScreen();
  const [selected, setSelected] = useState<string | null>(selectedFromUrl);

  const select = (assetId: string) => {
    setSelected(assetId);
    if (wide) {
      const url = new URL(window.location.href);
      url.searchParams.set(SELECTED_PARAM, assetId);
      window.history.replaceState(window.history.state, "", url);
    }
  };

  return (
    <>
      <PageHeader title="Cartera" description="Posiciones, coste y rentabilidad." />
      {portfolio.status === "loading" && <div className="h-48 animate-pulse rounded-card bg-surface" aria-hidden />}
      {portfolio.status === "error" && (
        <Card className="text-sm text-pretty text-text-muted">
          Hay una incoherencia en tus operaciones: {portfolio.error.message} Revísala en Operaciones.
        </Card>
      )}
      {portfolio.status === "ready" &&
        (portfolio.data.valuation.positions.length === 0 && portfolio.data.state.positions.size === 0 ? (
          <div className="grid grid-cols-[minmax(0,1fr)] gap-4 md:gap-5">
          <EmptyState
            icon={PieChart}
            title="Aún no tienes posiciones"
            description="Cuando registres o importes operaciones, aquí verás cada activo con su valor y su rentabilidad."
            actions={
              <Link href="/operaciones" className={buttonVariants({ size: "lg" })}>
                Ir a operaciones
              </Link>
            }
          />
          <WatchlistSection data={portfolio.data} />
          </div>
        ) : (
          <PortfolioContent
            data={portfolio.data}
            refreshing={portfolio.refreshing}
            failedIds={portfolio.failedIds}
            onRefresh={() => portfolio.refresh(true)}
            onSelect={select}
            wide={wide}
            selected={selected}
          />
        ))}

      <Sheet open={!wide && selected !== null} onOpenChange={(open) => !open && setSelected(null)} title="Posición">
        {selected && portfolio.status === "ready" && <PositionDetail data={portfolio.data} assetId={selected} />}
      </Sheet>
    </>
  );
}

function PortfolioContent({
  data,
  refreshing,
  failedIds,
  onRefresh,
  onSelect,
  wide,
  selected,
}: {
  data: PortfolioData;
  refreshing: boolean;
  failedIds: string[];
  onRefresh: () => void;
  onSelect: (assetId: string) => void;
  wide: boolean;
  selected: string | null;
}) {
  const v = data.valuation;
  const annual = useMemo(() => annualReturn(data.transactions, v.totalValue, todayIso()), [data.transactions, v.totalValue]);
  const closed = [...data.state.positions.values()].filter((p) => p.quantity.isZero());
  const [sort, setSort] = useState<SortState>({ key: "value", desc: true });
  const sorted = useMemo(() => sortPositions(v.positions, sort, data), [v.positions, sort, data]);
  // En escritorio siempre hay una posición a la vista: la elegida o la primera.
  const current = selected && data.state.positions.has(selected) ? selected : (sorted[0]?.position.assetId ?? null);

  // ↑/↓ recorren la tabla en escritorio, salvo si se está escribiendo.
  useEffect(() => {
    if (!wide) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== "ArrowDown" && event.key !== "ArrowUp") return;
      const target = event.target as HTMLElement | null;
      if (target?.closest("input, textarea, select, [contenteditable], [role=dialog]")) return;
      const index = sorted.findIndex((p) => p.position.assetId === current);
      const next = sorted[index + (event.key === "ArrowDown" ? 1 : -1)];
      if (!next) return;
      event.preventDefault();
      onSelect(next.position.assetId);
      document.getElementById(`posicion-${next.position.assetId}`)?.scrollIntoView({ block: "nearest" });
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [wide, sorted, current, onSelect]);

  return (
    <div className="grid grid-cols-[minmax(0,1fr)] gap-4 md:gap-5">
      {/* Escritorio: la cifra y las seis claves en una sola franja. */}
      <div className="grid grid-cols-[minmax(0,1fr)] gap-4 md:gap-5 xl:grid-cols-[minmax(0,5fr)_minmax(0,7fr)]">
      <Card>
        <div className="flex items-start justify-between gap-3">
          <p className="text-sm text-text-muted">Valor de la cartera</p>
          <RefreshPricesButton refreshing={refreshing} lastFetchedAt={data.lastFetchedAt} onRefresh={onRefresh} />
        </div>
        <div className="@container">
          <AnimatedAmount value={v.totalValue} className="hero-figure mt-1 block whitespace-nowrap" />
        </div>
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <VariationBadge ratio={v.unrealizedPct} />
          <VariationAmount value={v.unrealized} format={signedCurrency} className="text-sm" />
          <span className="text-sm text-text-muted">no realizado</span>
        </div>
        <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
          <QuoteFreshness quotes={quotesOf(data)} failed={failedIds.length} missing={v.missingPrices} />
          <ShareButton title="Compartir mi cartera" fileName="cumulo-cartera" build={(o) => buildPortfolioCard(data, o)} />
        </div>
      </Card>

      <dl className="grid grid-cols-2 gap-3 md:grid-cols-3 md:gap-5">
        <Stat label="Invertido ahora" value={formatCurrency(v.invested)} hint="Coste de lo que tienes" />
        <Stat label="Ganancia total" value={<VariationAmount value={v.totalGain} format={signedCurrency} />} hint="No realizado + realizado" />
        <Stat label="Cobrado en ventas" value={formatCurrency(v.saleProceeds)} />
        <Stat label="Realizado" value={<VariationAmount value={v.realized} format={signedCurrency} />} hint="Ganancia de lo vendido" />
        <Stat
          label="Rentabilidad total"
          value={data.state.bought.gt(0) ? <VariationAmount value={v.totalGain.div(data.state.bought)} format={(r) => formatPercent(r)} /> : "—"}
          hint="Ganancia / total comprado"
        />
        <Stat
          label="Rentabilidad anual"
          value={annual ? <VariationAmount value={annual} format={(r) => formatPercent(r)} /> : "—"}
          hint={annual ? "TIR" : "TIR · menos de 1 año"}
        />
      </dl>
      </div>

      {/* Escritorio: tabla a la izquierda y la ficha de la posición a la derecha. */}
      <div className="grid grid-cols-[minmax(0,1fr)] gap-4 md:gap-5 xl:grid-cols-[minmax(0,3fr)_minmax(0,2fr)] xl:items-start">
      <div className="grid grid-cols-[minmax(0,1fr)] gap-4 md:gap-5">
      {v.positions.length > 0 && (
        <section aria-labelledby="open-positions">
          <h2 id="open-positions" className="mb-2 px-1 text-sm font-medium text-text-muted">
            Posiciones abiertas · {v.positions.length}
          </h2>
          {wide ? (
            <PositionsTable positions={sorted} data={data} sort={sort} onSort={setSort} selected={current} onSelect={onSelect} />
          ) : (
          <Card className="p-1.5 md:p-2">
            <ul>
              {v.positions.map((p) => (
                <li key={p.position.assetId}>
                  <PositionRow valuation={p} data={data} onSelect={() => onSelect(p.position.assetId)} />
                </li>
              ))}
            </ul>
          </Card>
          )}
        </section>
      )}

      <WatchlistSection data={data} />

      {closed.length > 0 && (
        <section aria-labelledby="closed-positions">
          <h2 id="closed-positions" className="mb-2 px-1 text-sm font-medium text-text-muted">
            Posiciones cerradas · {closed.length}
          </h2>
          <Card className="p-1.5 md:p-2">
            <ul>
              {closed.map((p) => {
                const asset = data.assets.get(p.assetId);
                return (
                  <li key={p.assetId} className="flex items-center gap-3 rounded-2xl px-2.5 py-2.5">
                    {asset && <AssetAvatar asset={asset} />}
                    <span className="min-w-0 flex-1 truncate text-sm font-medium">{asset?.name ?? "Activo"}</span>
                    <span className="text-right text-sm">
                      <VariationAmount value={p.realizedGain} format={signedCurrency} className="font-medium" />
                      <span className="block text-xs text-text-muted">realizado</span>
                    </span>
                  </li>
                );
              })}
            </ul>
          </Card>
        </section>
      )}
      </div>

      {wide && current && (
        <Card aria-label="Detalle de la posición" className="sticky top-8 max-h-[calc(100dvh-4rem)] overflow-y-auto">
          <PositionDetail key={current} data={data} assetId={current} />
        </Card>
      )}
      </div>
    </div>
  );
}

function Stat({ label, value, hint }: { label: string; value: React.ReactNode; hint?: string }) {
  return (
    <Card className="p-4 md:p-5">
      <dt className="text-xs text-text-muted">{label}</dt>
      <dd className="mt-1 truncate text-base font-medium tabular-nums md:text-lg">{value}</dd>
      {hint && <dd className="text-xs text-text-muted">{hint}</dd>}
    </Card>
  );
}

function PositionRow({ valuation: p, data, onSelect }: { valuation: PositionValuation; data: PortfolioData; onSelect: () => void }) {
  const asset = data.assets.get(p.position.assetId);
  return (
    <button
      type="button"
      onClick={onSelect}
      className="flex w-full items-center gap-3 rounded-2xl px-2.5 py-2.5 text-left transition-colors outline-none hover:bg-surface-2 focus-visible:bg-surface-2 focus-visible:ring-3 focus-visible:ring-accent/40"
    >
      {asset && <AssetAvatar asset={asset} />}
      <span className="min-w-0 flex-1">
        <span className="block truncate text-sm font-medium">{asset?.name ?? "Activo"}</span>
        <span className="block truncate text-xs text-text-muted tabular-nums">
          {[
            asset && ASSET_TYPE_LABELS[asset.type],
            `${quantityText(p.position.quantity)} uds`,
            p.weight ? formatPercent(p.weight, { signed: false }) : null,
          ]
            .filter(Boolean)
            .join(" · ")}
        </span>
      </span>
      <span className="flex shrink-0 flex-col items-end gap-1">
        <span className="text-sm font-medium tabular-nums">
          {p.marketValue ? formatCurrency(p.marketValue) : <span className="text-text-muted">Sin precio</span>}
        </span>
        {p.unrealizedPct ? <VariationBadge ratio={p.unrealizedPct} /> : null}
      </span>
      <ChevronRight className="size-4 shrink-0 text-text-muted" aria-hidden />
    </button>
  );
}
