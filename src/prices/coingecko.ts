import "server-only";
import Decimal from "decimal.js";
import type { AssetCandidate, IntradayRange, PriceHistoryPoint, PriceQuote } from "./types";

/**
 * Cliente de CoinGecko. Con COINGECKO_DEMO_API_KEY usa la clave demo
 * (límite más alto); sin ella, la API pública con límites más bajos.
 */
const BASE_URL = "https://api.coingecko.com/api/v3";

async function get<T>(path: string, revalidate: number): Promise<T> {
  const key = process.env.COINGECKO_DEMO_API_KEY;
  const response = await fetch(`${BASE_URL}${path}`, {
    headers: { accept: "application/json", ...(key ? { "x-cg-demo-api-key": key } : {}) },
    next: { revalidate },
    signal: AbortSignal.timeout(8_000),
  });
  if (!response.ok) throw new Error(`CoinGecko respondió ${response.status}`);
  return response.json() as Promise<T>;
}

interface SearchResult {
  coins: { id: string; name: string; symbol: string; market_cap_rank: number | null }[];
}

export async function searchCoinGecko(query: string): Promise<AssetCandidate[]> {
  const result = await get<SearchResult>(`/search?query=${encodeURIComponent(query)}`, 3600);
  return result.coins.slice(0, 6).map((coin) => ({
    name: coin.name,
    ticker: coin.symbol.toUpperCase(),
    type: "crypto",
    priceSource: "coingecko",
    priceSourceId: coin.id,
    currency: "EUR",
  }));
}

type SimplePrice = Record<string, { eur?: number; last_updated_at?: number }>;

export async function quoteCoinGecko(ids: string[]): Promise<Map<string, PriceQuote>> {
  const map = new Map<string, PriceQuote>();
  if (ids.length === 0) return map;
  const result = await get<SimplePrice>(
    `/simple/price?ids=${ids.map(encodeURIComponent).join(",")}&vs_currencies=eur&include_last_updated_at=true&precision=full`,
    20,
  );
  for (const id of ids) {
    const entry = result[id];
    if (typeof entry?.eur !== "number") continue;
    const price = new Decimal(String(entry.eur)).toString();
    map.set(id, {
      price,
      currency: "EUR",
      sourceCurrency: "EUR",
      sourcePrice: price,
      asOf: new Date((entry.last_updated_at ?? Date.now() / 1000) * 1000).toISOString(),
    });
  }
  return map;
}

interface MarketChart {
  prices: [number, number][];
}

/** Símbolo de una cripto ("bitcoin" → "BTC"), para buscar su histórico largo en otra fuente. */
export async function coinSymbol(id: string): Promise<string | null> {
  const result = await get<SearchResult>(`/search?query=${encodeURIComponent(id)}`, 604_800);
  const coin = result.coins.find((c) => c.id === id);
  return coin && /^[A-Za-z0-9]{1,15}$/.test(coin.symbol) ? coin.symbol.toUpperCase() : null;
}

/** Cierres diarios en EUR (la API gratuita cubre como mucho 365 días). */
export async function historyCoinGecko(id: string, from: Date): Promise<PriceHistoryPoint[]> {
  const days = Math.min(365, Math.max(1, Math.ceil((Date.now() - from.getTime()) / 86_400_000) + 1));
  const result = await get<MarketChart>(
    `/coins/${encodeURIComponent(id)}/market_chart?vs_currency=eur&days=${days}&interval=daily&precision=full`,
    21_600,
  );
  const byDay = new Map<string, string>();
  for (const [timestamp, price] of result.prices) {
    byDay.set(new Date(timestamp).toISOString().slice(0, 10), new Decimal(String(price)).toString());
  }
  return [...byDay].map(([date, close]) => ({ date, close }));
}

const INTRADAY_DAYS: Record<IntradayRange, number> = { "1D": 1, "1W": 8, "1M": 31 };
const INTRADAY_CACHE: Record<IntradayRange, number> = { "1D": 60, "1W": 300, "1M": 900 };

/**
 * Precios intradía en EUR con su hora. Sin `interval`, CoinGecko elige la
 * granularidad: 5 min para 1 día y horaria de 2 a 90 días.
 */
export async function intradayCoinGecko(id: string, range: IntradayRange): Promise<PriceHistoryPoint[]> {
  const chart = await get<MarketChart>(
    `/coins/${encodeURIComponent(id)}/market_chart?vs_currency=eur&days=${INTRADAY_DAYS[range]}&precision=full`,
    INTRADAY_CACHE[range],
  );
  return chart.prices.map(([timestamp, price]) => ({ date: new Date(timestamp).toISOString(), close: new Decimal(String(price)).toString() }));
}
