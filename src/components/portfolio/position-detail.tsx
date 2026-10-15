"use client";

import Decimal from "decimal.js";
import { useState, type FormEvent } from "react";
import { AssetAvatar } from "@/components/asset-avatar";
import { Button } from "@/components/ui/button";
import { DecimalField } from "@/components/ui/decimal-field";
import { VariationAmount, VariationBadge } from "@/components/variation-badge";
import { getRepositories } from "@/data/repositories";
import type { PortfolioData } from "@/hooks/use-portfolio";
import { OperationDetail } from "@/components/operation-detail";
import type { Transaction } from "@/domain/models";
import { annualReturn, buyDetail, sellDetail } from "@/domain/performance";
import { sortTransactions } from "@/domain/portfolio";
import { formatCurrency, formatDate, formatPercent, formatQuantity, formatTime, todayIso } from "@/lib/format";
import { ASSET_TYPE_LABELS, TRANSACTION_TYPE_LABELS } from "@/lib/labels";
import { cn } from "@/lib/utils";
import { ChevronDown } from "lucide-react";
import { parseDecimal } from "@/lib/parse";
import { setManualPrice } from "@/services/prices";
import { AssetPriceChart } from "./asset-price-chart";
import { PriceAlerts } from "./price-alerts";
import { WhatIfBuy } from "./what-if-buy";
import { ShareButton } from "@/components/share/share-sheet";
import { buildOperationCard, buildPositionCard } from "@/lib/share-builders";

const SOURCE_LABELS = { yahoo: "Yahoo Finance", coingecko: "CoinGecko", manual: "Manual" } as const;

export function PositionDetail({ data, assetId }: { data: PortfolioData; assetId: string }) {
  const asset = data.assets.get(assetId);
  const valuation = data.valuation.positions.find((p) => p.position.assetId === assetId);
  const position = valuation?.position ?? data.state.positions.get(assetId);
  const cached = data.prices.get(assetId);
  if (!asset || !position) return <p className="text-sm text-text-muted">Esta posición ya no existe.</p>;
  const assetTransactions = sortTransactions(data.transactions.filter((t) => t.assetId === assetId));
  const annual = annualReturn(assetTransactions, valuation?.marketValue ?? new Decimal(0), todayIso());

  const rows: [string, React.ReactNode][] = [
    ["Cantidad", formatQuantity(position.quantity)],
    ["Precio medio de compra", formatCurrency(position.averageCost)],
    ["Coste", formatCurrency(position.cost)],
    ["Precio actual", valuation?.price ? formatCurrency(valuation.price) : "—"],
    ["Valor de mercado", valuation?.marketValue ? formatCurrency(valuation.marketValue) : "—"],
    [
      "No realizado",
      valuation?.unrealized ? (
        <span className="inline-flex items-center gap-2">
          <VariationAmount value={valuation.unrealized} format={(v) => formatCurrency(v, { signed: true })} />
          <VariationBadge ratio={valuation.unrealizedPct} />
        </span>
      ) : (
        "—"
      ),
    ],
    ["Realizado", <VariationAmount key="r" value={position.realizedGain} format={(v) => formatCurrency(v, { signed: true })} />],
    ["Cobrado en ventas", formatCurrency(position.saleProceeds)],
    [
      "Rentabilidad anual (TIR)",
      annual ? (
        <VariationAmount key="a" value={annual} format={(v) => formatPercent(v)} />
      ) : (
        <span key="a" className="text-text-muted">Menos de 1 año</span>
      ),
    ],
  ];

  return (
    <div className="grid grid-cols-[minmax(0,1fr)] gap-4 pt-1">
      <div className="flex items-center gap-3">
        <AssetAvatar asset={asset} className="size-12" />
        <div className="min-w-0">
          <p className="truncate font-medium">{asset.name}</p>
          <p className="truncate text-xs text-text-muted">
            {[ASSET_TYPE_LABELS[asset.type], asset.isin, `${SOURCE_LABELS[asset.priceSource]}${asset.priceSourceId ? ` · ${asset.priceSourceId}` : ""}`]
              .filter(Boolean)
              .join(" · ")}
          </p>
        </div>
      </div>
      <ShareButton
        title={`Compartir ${asset.ticker ?? asset.name}`}
        fileName={`cumulo-${(asset.ticker ?? "posicion").toLowerCase()}`}
        build={(o) => buildPositionCard(data, assetId, o)}
        label="Compartir posición"
        className="justify-self-start"
      />

      <AssetPriceChart
        asset={asset}
        transactions={assetTransactions}
        currentPrice={valuation?.price ?? null}
        averageCost={position.quantity.gt(0) ? position.averageCost : null}
      />

      <dl className="divide-y divide-border rounded-2xl bg-surface-2 px-4">
        {rows.map(([label, value]) => (
          <div key={label} className="flex items-center justify-between gap-4 py-3 text-sm">
            <dt className="text-text-muted">{label}</dt>
            <dd className="text-right font-medium tabular-nums">{value}</dd>
          </div>
        ))}
      </dl>

      {cached && (
        <p className="text-xs text-text-muted">
          Precio del {formatDate(cached.updatedAt.slice(0, 10))} a las {formatTime(cached.updatedAt)}.
        </p>
      )}

      {position.quantity.gt(0) && (
        <WhatIfBuy
          quantity={position.quantity}
          cost={position.cost}
          averageCost={position.averageCost}
          marketPrice={valuation?.price ?? null}
          otherValue={data.valuation.marketValue.minus(valuation?.marketValue ?? new Decimal(0))}
        />
      )}

      <section aria-labelledby="asset-operations">
        <h3 id="asset-operations" className="mb-2 text-sm font-medium">
          Tus operaciones · {assetTransactions.length}
        </h3>
        <ul className="grid gap-2">
          {[...assetTransactions].reverse().map((t) => (
            <li key={t.id}>
              <details className="group rounded-2xl border border-border">
                <summary className="flex cursor-pointer list-none items-center gap-3 rounded-2xl px-3.5 py-3 text-sm outline-none focus-visible:ring-3 focus-visible:ring-accent/40 [&::-webkit-details-marker]:hidden">
                  <span className={cn("size-2.5 shrink-0 rounded-full", t.type === "sell" ? "bg-series-2" : "bg-accent")} aria-hidden />
                  <span className="min-w-0 flex-1">
                    <span className="block font-medium">
                      {TRANSACTION_TYPE_LABELS[t.type]} · {formatDate(t.date)}
                    </span>
                    <span className="block truncate text-xs text-text-muted tabular-nums">
                      {formatQuantity(t.quantity)} ×{" "}
                      {formatCurrency(t.price)}
                    </span>
                  </span>
                  <OperationBadge transaction={t} data={data} price={valuation?.price ?? null} />
                  <ChevronDown className="size-4 shrink-0 text-text-muted transition-transform group-open:rotate-180" aria-hidden />
                </summary>
                <div className="px-2 pb-2">
                  <OperationDetail transaction={t} state={data.state} price={valuation?.price ?? null} />
                  {(t.type === "buy" || t.type === "sell") && (
                    <ShareButton
                      title="Compartir operación"
                      fileName={`cumulo-${t.type === "buy" ? "compra" : "venta"}-${t.date.slice(0, 10)}`}
                      build={(o) => buildOperationCard(data, t, o)}
                      label="Compartir operación"
                      variant="ghost"
                      className="mt-2"
                    />
                  )}
                </div>
              </details>
            </li>
          ))}
        </ul>
      </section>

      {asset.priceSource === "manual" && <ManualPriceForm assetId={assetId} current={cached?.price} />}

      {position.quantity.gt(0) && <PriceAlerts assetId={assetId} currentPrice={cached?.price ?? null} />}
    </div>
  );
}

/** Variación de una compra (lo que queda de ella) o de una venta, para la lista. */
function OperationBadge({ transaction: t, data, price }: { transaction: Transaction; data: PortfolioData; price: Decimal | null }) {
  if (t.type === "buy") {
    const d = buyDetail(data.state, t, price, todayIso());
    return d.remainingQuantity.isZero() ? <span className="text-xs text-text-muted">Vendida</span> : <VariationBadge ratio={d.gainPct} />;
  }
  if (t.type === "sell") return <VariationBadge ratio={sellDetail(data.state, t)?.gainPct ?? null} />;
  return null;
}

function ManualPriceForm({ assetId, current }: { assetId: string; current?: string }) {
  const [value, setValue] = useState(current ? current.replace(".", ",") : "");
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    const price = parseDecimal(value);
    if (!price || price.isNegative()) {
      setError("Introduce un precio de 0 o más.");
      return;
    }
    setError(null);
    await setManualPrice(getRepositories(), assetId, new Decimal(price));
    setSaved(true);
  }

  return (
    <form onSubmit={onSubmit} className="grid gap-3 rounded-2xl border border-border p-4">
      <DecimalField
        label="Precio manual por unidad"
        suffix="€"
        value={value}
        onValueChange={(v) => {
          setValue(v);
          setSaved(false);
        }}
        error={error}
        hint={saved ? "Precio guardado." : "Este activo no tiene fuente de precios automática."}
      />
      <Button type="submit" variant="secondary">
        Guardar precio
      </Button>
    </form>
  );
}
