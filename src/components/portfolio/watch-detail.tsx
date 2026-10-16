"use client";

import Decimal from "decimal.js";
import { EyeOff } from "lucide-react";
import { AssetAvatar } from "@/components/asset-avatar";
import { Button } from "@/components/ui/button";
import { VariationBadge } from "@/components/variation-badge";
import { getRepositories } from "@/data/repositories";
import type { PortfolioData } from "@/hooks/use-portfolio";
import { formatCurrency, formatDate, formatTime } from "@/lib/format";
import { ASSET_TYPE_LABELS } from "@/lib/labels";
import { changeSinceWatched, unwatch } from "@/services/watchlist";
import { AssetPriceChart } from "./asset-price-chart";
import { PriceAlerts } from "./price-alerts";

/** Ficha de un activo seguido: gráfica, variación desde que lo sigues y alertas. */
export function WatchDetail({ data, assetId, onUnwatched }: { data: PortfolioData; assetId: string; onUnwatched: () => void }) {
  const asset = data.assets.get(assetId);
  const item = data.watchlist.find((w) => w.assetId === assetId);
  if (!asset || !item) return <p className="text-sm text-text-muted">Ya no sigues este activo.</p>;

  const cached = data.prices.get(assetId);
  const price = cached ? new Decimal(cached.price) : null;
  const change = changeSinceWatched(item, price);
  const held = (data.state.positions.get(assetId)?.quantity ?? new Decimal(0)).gt(0);
  // El precio de un activo es público: no se oculta en modo privado.
  const money = (v: Decimal | string) => formatCurrency(v, { reveal: true });

  return (
    <div className="grid grid-cols-[minmax(0,1fr)] gap-4 pt-1">
      <div className="flex items-center gap-3">
        <AssetAvatar asset={asset} className="size-12" />
        <div className="min-w-0">
          <p className="truncate font-medium">{asset.name}</p>
          <p className="truncate text-xs text-text-muted">
            {[ASSET_TYPE_LABELS[asset.type], asset.isin, asset.priceSourceId].filter(Boolean).join(" · ")}
          </p>
        </div>
      </div>

      <AssetPriceChart asset={asset} transactions={[]} currentPrice={price} currentAt={cached?.updatedAt} averageCost={null} />

      <dl className="divide-y divide-border rounded-2xl bg-surface-2 px-4">
        <Row label="Precio actual" value={price ? money(price) : "—"} />
        <Row label="Lo sigues desde" value={formatDate(item.addedAt.slice(0, 10))} />
        <Row label="Precio entonces" value={item.addedPrice ? money(item.addedPrice) : "—"} />
        <Row label="Desde que lo sigues" value={change ? <VariationBadge ratio={change} /> : "—"} />
      </dl>
      {cached && (
        <p className="text-xs text-text-muted">
          Precio del {formatDate(cached.updatedAt.slice(0, 10))} a las {formatTime(cached.updatedAt)}.
          {held && " También lo tienes en cartera."}
        </p>
      )}

      <PriceAlerts assetId={assetId} currentPrice={cached?.price ?? null} />

      <Button
        variant="ghost"
        onClick={async () => {
          await unwatch(getRepositories(), assetId);
          onUnwatched();
        }}
      >
        <EyeOff aria-hidden />
        Dejar de seguir
      </Button>
    </div>
  );
}

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-4 py-3 text-sm">
      <dt className="text-text-muted">{label}</dt>
      <dd className="text-right font-medium tabular-nums">{value}</dd>
    </div>
  );
}
