/**
 * Modelos de dominio persistidos. Importes, cantidades y precios son strings
 * decimales (p. ej. "1234.56") y se operan siempre con decimal.js.
 */
export type DecimalString = string;

/** Fecha u hora ISO 8601 (p. ej. "2026-10-15" o "2026-10-15T09:30:00.000Z"). */
export type IsoDateString = string;

export type AssetType = "stock" | "etf" | "crypto" | "other";
export type PriceSource = "coingecko" | "yahoo" | "manual";

export interface Asset {
  id: string;
  name: string;
  ticker?: string;
  isin?: string;
  type: AssetType;
  priceSource: PriceSource;
  priceSourceId: string;
}

export type TransactionType = "buy" | "sell" | "dividend" | "fee" | "deposit" | "withdrawal";
export type TransactionOrigin = "manual" | "csv-tr";

export interface Transaction {
  id: string;
  assetId?: string;
  type: TransactionType;
  date: IsoDateString;
  quantity: DecimalString;
  price: DecimalString;
  fee: DecimalString;
  tax: DecimalString;
  origin: TransactionOrigin;
  importHash?: string;
}

export interface PriceCacheEntry {
  assetId: string;
  /** Precio en EUR. */
  price: DecimalString;
  currency: "EUR";
  /** Hora de la cotización según la fuente (o del ajuste manual). */
  updatedAt: IsoDateString;
  /** Cuándo se pidió a la fuente; decide si hay que refrescar. */
  fetchedAt?: IsoDateString;
}

/** Aviso cuando un activo cruza un precio (en EUR). Se dispara una sola vez. */
export interface PriceAlert {
  id: string;
  assetId: string;
  direction: "above" | "below";
  price: DecimalString;
  createdAt: IsoDateString;
  /** Cuándo se cumplió; mientras falte, la alerta está activa. */
  triggeredAt?: IsoDateString;
  /** Precio que la disparó. */
  triggeredPrice?: DecimalString;
}

/** Activo que sigues sin tenerlo en cartera. */
export interface WatchItem {
  assetId: string;
  addedAt: IsoDateString;
  /** Precio cuando empezaste a seguirlo; se rellena con el primer precio conocido. */
  addedPrice?: DecimalString;
}

export type PeriodKey = "1D" | "1W" | "1M" | "YTD" | "1Y" | "ALL";

export const PERIODS: { key: PeriodKey; label: string }[] = [
  { key: "1D", label: "1D" },
  { key: "1W", label: "1S" },
  { key: "1M", label: "1M" },
  { key: "YTD", label: "YTD" },
  { key: "1Y", label: "1A" },
  { key: "ALL", label: "Todo" },
];

/**
 * Ajustes de perfil. El tema no vive aquí: se guarda en localStorage porque
 * hay que leerlo de forma síncrona antes del primer pintado (ver lib/theme.ts).
 */
export interface Settings {
  profileName: string;
  avatar?: string;
  defaultPeriod: PeriodKey;
}

export const DEFAULT_SETTINGS: Settings = {
  profileName: "",
  defaultPeriod: "1M",
};
