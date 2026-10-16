import type { AssetType, DecimalString } from "@/domain/models";

/** Fuentes con API. "manual" no pasa por el servidor. */
export type RemotePriceSource = "yahoo" | "coingecko";

/** "yahoo:VWCE.DE" · "coingecko:bitcoin". */
export type PriceKey = `${RemotePriceSource}:${string}`;

export const priceKey = (source: RemotePriceSource, id: string): PriceKey => `${source}:${id}`;

export function parsePriceKey(key: string): { source: RemotePriceSource; id: string } | null {
  const index = key.indexOf(":");
  if (index < 1) return null;
  const source = key.slice(0, index);
  const id = key.slice(index + 1);
  if ((source !== "yahoo" && source !== "coingecko") || !/^[A-Za-z0-9.\-=^_]{1,40}$/.test(id)) return null;
  return { source, id };
}

/** Resultado del buscador de activos. */
export interface AssetCandidate {
  name: string;
  ticker?: string;
  isin?: string;
  type: AssetType;
  priceSource: RemotePriceSource;
  priceSourceId: string;
  exchange?: string;
  /** Divisa de cotización original (los precios se convierten a EUR). */
  currency?: string;
  /** Último precio ya en EUR, si se conoce. */
  priceEur?: DecimalString;
}

export interface AssetSearchResponse {
  securities: AssetCandidate[];
  crypto: AssetCandidate[];
}

export interface PriceQuote {
  /** Precio en EUR. */
  price: DecimalString;
  currency: "EUR";
  /** Divisa y precio originales cuando hubo conversión. */
  sourceCurrency: string;
  sourcePrice: DecimalString;
  /** Hora de la cotización según la fuente (ISO). */
  asOf: string;
}

export interface PricesResponse {
  quotes: Record<string, PriceQuote>;
  errors: Record<string, string>;
}

export interface PriceHistoryPoint {
  /** YYYY-MM-DD */
  date: string;
  /** Cierre en EUR. */
  close: DecimalString;
}

/** Periodos con datos intradía: 1D (5 min), 1W (30 min) y 1M (1 h). */
export type IntradayRange = "1D" | "1W" | "1M";
export const INTRADAY_RANGES: IntradayRange[] = ["1D", "1W", "1M"];

export interface PriceHistoryResponse {
  key: string;
  points: PriceHistoryPoint[];
}
