import Decimal from "decimal.js";
import type { Repositories } from "@/data/repositories";
import type { Asset, PriceCacheEntry } from "@/domain/models";
import { priceKey, type PricesResponse } from "@/prices/types";

/** Un precio se considera fresco 25 s: el refresco de cada 30 s siempre trae uno nuevo. */
export const PRICE_TTL_MS = 25_000;
const CHUNK = 50;

export type FetchPrices = (keys: string[]) => Promise<PricesResponse>;

export const fetchPricesViaApi: FetchPrices = async (keys) => {
  const response = await fetch(`/api/prices?keys=${keys.map(encodeURIComponent).join(",")}`);
  if (!response.ok) throw new Error(`Precios no disponibles (${response.status})`);
  return response.json() as Promise<PricesResponse>;
};

export const isStale = (entry: PriceCacheEntry | undefined, now = Date.now()) =>
  !entry?.fetchedAt || now - new Date(entry.fetchedAt).getTime() > PRICE_TTL_MS;

export interface RefreshResult {
  updated: number;
  failed: string[];
}

/**
 * Pide precios de los activos con fuente remota cuyo precio está caducado
 * (o todos con `force`). Si una fuente falla, se conserva el último precio
 * guardado: un precio nunca rompe la app.
 */
export async function refreshPrices(
  repositories: Repositories,
  assets: Asset[],
  { force = false, fetchPrices = fetchPricesViaApi, now = Date.now() } = {},
): Promise<RefreshResult> {
  const cache = new Map((await repositories.priceCache.list()).map((e) => [e.assetId, e]));
  const due = assets.filter((a) => a.priceSource !== "manual" && a.priceSourceId && (force || isStale(cache.get(a.id), now)));
  if (due.length === 0) return { updated: 0, failed: [] };

  const byKey = new Map(due.map((a) => [priceKey(a.priceSource as "yahoo" | "coingecko", a.priceSourceId), a]));
  const keys = [...byKey.keys()];
  const entries: PriceCacheEntry[] = [];
  const failed: string[] = [];
  const fetchedAt = new Date(now).toISOString();

  for (let i = 0; i < keys.length; i += CHUNK) {
    const chunk = keys.slice(i, i + CHUNK);
    try {
      const { quotes } = await fetchPrices(chunk);
      for (const key of chunk) {
        const asset = byKey.get(key)!;
        const quote = quotes[key];
        if (quote) entries.push({ assetId: asset.id, price: quote.price, currency: "EUR", updatedAt: quote.asOf, fetchedAt });
        else failed.push(asset.id);
      }
    } catch {
      failed.push(...chunk.map((key) => byKey.get(key)!.id));
    }
  }

  if (entries.length > 0) await repositories.priceCache.bulkPut(entries);
  return { updated: entries.length, failed };
}

export async function setManualPrice(repositories: Repositories, assetId: string, price: Decimal, now = new Date()) {
  if (price.isNegative()) throw new RangeError("El precio no puede ser negativo.");
  await repositories.priceCache.put({
    assetId,
    price: price.toString(),
    currency: "EUR",
    updatedAt: now.toISOString(),
    fetchedAt: now.toISOString(),
  });
}
