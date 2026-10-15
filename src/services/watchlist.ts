import Decimal from "decimal.js";
import type { Repositories } from "@/data/repositories";
import type { WatchItem } from "@/domain/models";

/** Guarda como referencia el primer precio conocido de los activos seguidos. */
export async function fillWatchBaselines(repositories: Repositories): Promise<number> {
  const [items, cache] = await Promise.all([repositories.watchlist.list(), repositories.priceCache.list()]);
  const prices = new Map(cache.map((p) => [p.assetId, p.price]));
  let filled = 0;
  for (const item of items) {
    const price = prices.get(item.assetId);
    if (!item.addedPrice && price) {
      await repositories.watchlist.setBaseline(item.assetId, price);
      filled++;
    }
  }
  return filled;
}

/** Variación desde que se empezó a seguir; null sin referencia o sin precio. */
export function changeSinceWatched(item: WatchItem, price: Decimal | null): Decimal | null {
  if (!price || !item.addedPrice) return null;
  const base = new Decimal(item.addedPrice);
  return base.gt(0) ? price.div(base).minus(1) : null;
}

/** Deja de seguir y borra el activo si no tiene operaciones (ni lo necesita nada más). */
export async function unwatch(repositories: Repositories, assetId: string) {
  await repositories.watchlist.remove(assetId);
  const transactions = await repositories.transactions.listByAsset(assetId);
  if (transactions.length === 0) await repositories.assets.remove(assetId);
}
