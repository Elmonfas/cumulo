"use client";

import Decimal from "decimal.js";
import { ChevronRight, Eye, Plus } from "lucide-react";
import dynamic from "next/dynamic";
import { useState } from "react";
import { AssetAvatar } from "@/components/asset-avatar";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Sheet } from "@/components/ui/sheet";
import { VariationBadge } from "@/components/variation-badge";
import { getRepositories } from "@/data/repositories";
import type { PortfolioData } from "@/hooks/use-portfolio";
import { formatCurrency } from "@/lib/format";
import { ASSET_TYPE_LABELS } from "@/lib/labels";
import { changeSinceWatched } from "@/services/watchlist";

const AssetPicker = dynamic(() => import("@/components/transactions/asset-picker").then((m) => m.AssetPicker), { ssr: false });
const WatchDetail = dynamic(() => import("./watch-detail").then((m) => m.WatchDetail), { ssr: false });

/** Activos que sigues sin tenerlos: precio y variación desde que los sigues. */
export function WatchlistSection({ data }: { data: PortfolioData }) {
  const [adding, setAdding] = useState(false);
  const [selected, setSelected] = useState<string | null>(null);
  const items = data.watchlist.filter((w) => data.assets.has(w.assetId));

  return (
    <section aria-labelledby="watchlist">
      <div className="mb-2 flex items-center justify-between gap-3 px-1">
        <h2 id="watchlist" className="text-sm font-medium text-text-muted">
          Siguiendo · {items.length}
        </h2>
        <Button variant="ghost" size="sm" onClick={() => setAdding(true)}>
          <Plus aria-hidden />
          Seguir activo
        </Button>
      </div>

      {items.length === 0 ? (
        <Card className="flex items-center gap-4 p-4 md:p-5">
          <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-accent/15 text-accent">
            <Eye className="size-5" aria-hidden />
          </span>
          <p className="text-sm text-pretty text-text-muted">
            Sigue activos que te interesan sin comprarlos: verás su gráfica, cuánto han variado desde que los sigues y podrás
            ponerles alertas.
          </p>
        </Card>
      ) : (
        <Card className="p-1.5 md:p-2">
          <ul>
            {items.map((item) => {
              const asset = data.assets.get(item.assetId)!;
              const cached = data.prices.get(item.assetId);
              const price = cached ? new Decimal(cached.price) : null;
              return (
                <li key={item.assetId}>
                  <button
                    type="button"
                    onClick={() => setSelected(item.assetId)}
                    className="flex w-full items-center gap-3 rounded-2xl px-2.5 py-2.5 text-left transition-colors outline-none hover:bg-surface-2 focus-visible:bg-surface-2 focus-visible:ring-3 focus-visible:ring-accent/40"
                  >
                    <AssetAvatar asset={asset} />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-medium">{asset.name}</span>
                      <span className="block truncate text-xs text-text-muted">
                        {[ASSET_TYPE_LABELS[asset.type], asset.priceSourceId.toUpperCase()].filter(Boolean).join(" · ")}
                      </span>
                    </span>
                    <span className="flex shrink-0 flex-col items-end gap-1">
                      <span className="text-sm font-medium tabular-nums">
                        {price ? formatCurrency(price, { reveal: true }) : <span className="text-text-muted">Sin precio</span>}
                      </span>
                      <VariationBadge ratio={changeSinceWatched(item, price)} />
                    </span>
                    <ChevronRight className="size-4 shrink-0 text-text-muted" aria-hidden />
                  </button>
                </li>
              );
            })}
          </ul>
        </Card>
      )}

      <Sheet open={adding} onOpenChange={setAdding} title="Seguir un activo" description="No se añade a tu cartera.">
        {adding && (
          <div className="pt-1">
            <AssetPicker
              value={null}
              onChange={async (asset) => {
                if (!asset) return;
                await getRepositories().watchlist.add(asset.id);
                setAdding(false);
                setSelected(asset.id);
              }}
            />
          </div>
        )}
      </Sheet>

      <Sheet open={selected !== null} onOpenChange={(open) => !open && setSelected(null)} title="Siguiendo">
        {selected && <WatchDetail data={data} assetId={selected} onUnwatched={() => setSelected(null)} />}
      </Sheet>
    </section>
  );
}
