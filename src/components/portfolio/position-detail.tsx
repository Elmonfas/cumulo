"use client";

import Decimal from "decimal.js";
import { useState, type FormEvent } from "react";
import { AssetAvatar } from "@/components/asset-avatar";
import { Button } from "@/components/ui/button";
import { DecimalField } from "@/components/ui/decimal-field";
import { VariationAmount, VariationBadge } from "@/components/variation-badge";
import { getRepositories } from "@/data/repositories";
import type { PortfolioData } from "@/hooks/use-portfolio";
import { formatCurrency, formatDate, formatNumber, formatTime } from "@/lib/format";
import { ASSET_TYPE_LABELS } from "@/lib/labels";
import { parseDecimal } from "@/lib/parse";
import { setManualPrice } from "@/services/prices";
import { AssetPriceChart } from "./asset-price-chart";

const SOURCE_LABELS = { yahoo: "Yahoo Finance", coingecko: "CoinGecko", manual: "Manual" } as const;

export function PositionDetail({ data, assetId }: { data: PortfolioData; assetId: string }) {
  const asset = data.assets.get(assetId);
  const valuation = data.valuation.positions.find((p) => p.position.assetId === assetId);
  const position = valuation?.position ?? data.state.positions.get(assetId);
  const cached = data.prices.get(assetId);
  if (!asset || !position) return <p className="text-sm text-text-muted">Esta posición ya no existe.</p>;

  const rows: [string, React.ReactNode][] = [
    ["Cantidad", formatNumber(position.quantity, Math.min(8, position.quantity.decimalPlaces()))],
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

      <AssetPriceChart
        asset={asset}
        transactions={data.transactions.filter((t) => t.assetId === assetId)}
        currentPrice={valuation?.price ?? null}
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

      {asset.priceSource === "manual" && <ManualPriceForm assetId={assetId} current={cached?.price} />}
    </div>
  );
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
