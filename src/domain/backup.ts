import type { Goal } from "./goals";
import type { Asset, PriceAlert, PriceCacheEntry, Settings, Transaction, WatchItem } from "./models";

export const BACKUP_FORMAT = "cumulo-backup";
export const BACKUP_VERSION = 1;

export interface BackupData {
  format: typeof BACKUP_FORMAT;
  version: typeof BACKUP_VERSION;
  exportedAt: string;
  assets: Asset[];
  transactions: Transaction[];
  priceCache: PriceCacheEntry[];
  settings: Settings;
  /** Desde la versión con alertas; los backups anteriores no lo traen. */
  alerts?: PriceAlert[];
  watchlist?: WatchItem[];
  /** Desde la versión con objetivos. */
  goals?: Goal[];
}

export class InvalidBackupError extends Error {
  constructor(reason: string) {
    super(`El archivo no es un backup válido de cúmulo: ${reason}`);
    this.name = "InvalidBackupError";
  }
}

const isObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);
const isDecimalString = (value: unknown) => typeof value === "string" && /^-?\d+(\.\d+)?$/.test(value);
const isString = (value: unknown, max = 500) => typeof value === "string" && value.length > 0 && value.length <= max;
/** "2026-10-15" o ISO con hora, y que sea una fecha real. */
const isIsoDate = (value: unknown) =>
  typeof value === "string" &&
  /^\d{4}-\d{2}-\d{2}(T[\d:.]+(Z|[+-]\d{2}:\d{2})?)?$/.test(value) &&
  !Number.isNaN(Date.parse(value.length === 10 ? `${value}T00:00:00Z` : value));
const isOptionalString = (value: unknown, max = 64) => value === undefined || (typeof value === "string" && value.length <= max);
/** El avatar solo puede ser una imagen embebida: nunca una URL externa (filtraría la IP al abrir la app). */
const AVATAR = /^data:image\/(png|jpeg|webp);base64,[A-Za-z0-9+/]+=*$/;
const MAX_AVATAR_LENGTH = 400_000;

const ASSET_TYPES = new Set(["stock", "etf", "crypto", "other"]);
const PRICE_SOURCES = new Set(["coingecko", "yahoo", "manual"]);
const TRANSACTION_TYPES = new Set(["buy", "sell", "dividend", "interest", "fee", "deposit", "withdrawal"]);
const ORIGINS = new Set(["manual", "csv-tr"]);
const PERIODS = new Set(["1D", "1W", "1M", "YTD", "1Y", "ALL"]);

/** Valida la forma de un backup leído de un archivo y lo devuelve tipado. */
export function parseBackup(raw: unknown): BackupData {
  if (!isObject(raw) || raw.format !== BACKUP_FORMAT) throw new InvalidBackupError("falta la cabecera.");
  if (raw.version !== BACKUP_VERSION) throw new InvalidBackupError(`versión ${String(raw.version)} no soportada.`);
  const { assets, transactions, priceCache, settings } = raw;
  if (!Array.isArray(assets) || !Array.isArray(transactions) || !Array.isArray(priceCache) || !isObject(settings)) {
    throw new InvalidBackupError("faltan secciones.");
  }

  assets.forEach((a, i) => {
    if (
      !isObject(a) ||
      !isString(a.id) ||
      !isString(a.name, 200) ||
      !isOptionalString(a.ticker) ||
      !isOptionalString(a.isin) ||
      !ASSET_TYPES.has(a.type as string) ||
      !PRICE_SOURCES.has(a.priceSource as string) ||
      typeof a.priceSourceId !== "string" ||
      a.priceSourceId.length > 64
    ) {
      throw new InvalidBackupError(`activo ${i + 1} incorrecto.`);
    }
  });
  const assetIds = new Set(assets.map((a) => (a as Asset).id));

  transactions.forEach((t, i) => {
    if (
      !isObject(t) ||
      !isString(t.id) ||
      !TRANSACTION_TYPES.has(t.type as string) ||
      !isIsoDate(t.date) ||
      !ORIGINS.has(t.origin as string) ||
      ![t.quantity, t.price, t.fee, t.tax].every(isDecimalString) ||
      (t.assetId !== undefined && !assetIds.has(t.assetId as string)) ||
      (t.withholdingCountry !== undefined && !(typeof t.withholdingCountry === "string" && /^[A-Z]{2}$/.test(t.withholdingCountry)))
    ) {
      throw new InvalidBackupError(`operación ${i + 1} incorrecta.`);
    }
  });

  priceCache.forEach((p, i) => {
    if (!isObject(p) || !assetIds.has(p.assetId as string) || !isDecimalString(p.price) || !isIsoDate(p.updatedAt)) {
      throw new InvalidBackupError(`precio ${i + 1} incorrecto.`);
    }
  });

  const alerts = raw.alerts ?? [];
  if (!Array.isArray(alerts)) throw new InvalidBackupError("alertas incorrectas.");
  alerts.forEach((a, i) => {
    if (
      !isObject(a) ||
      !isString(a.id) ||
      !assetIds.has(a.assetId as string) ||
      (a.direction !== "above" && a.direction !== "below") ||
      !isDecimalString(a.price)
    ) {
      throw new InvalidBackupError(`alerta ${i + 1} incorrecta.`);
    }
  });

  const watchlist = raw.watchlist ?? [];
  if (!Array.isArray(watchlist)) throw new InvalidBackupError("lista de seguimiento incorrecta.");
  watchlist.forEach((w, i) => {
    if (!isObject(w) || !assetIds.has(w.assetId as string) || !isIsoDate(w.addedAt)) {
      throw new InvalidBackupError(`activo seguido ${i + 1} incorrecto.`);
    }
  });

  const goals = raw.goals ?? [];
  if (!Array.isArray(goals)) throw new InvalidBackupError("objetivos incorrectos.");
  goals.forEach((g, i) => {
    if (
      !isObject(g) ||
      !isString(g.id) ||
      !isString(g.name, 120) ||
      !isDecimalString(g.target) ||
      !isDecimalString(g.expectedReturn) ||
      !isIsoDate(g.targetDate) ||
      !isIsoDate(g.createdAt)
    ) {
      throw new InvalidBackupError(`objetivo ${i + 1} incorrecto.`);
    }
  });

  if (
    typeof settings.profileName !== "string" ||
    settings.profileName.length > 80 ||
    !PERIODS.has(settings.defaultPeriod as string) ||
    (settings.avatar !== undefined &&
      (typeof settings.avatar !== "string" || settings.avatar.length > MAX_AVATAR_LENGTH || !AVATAR.test(settings.avatar)))
  ) {
    throw new InvalidBackupError("ajustes incorrectos.");
  }

  return raw as unknown as BackupData;
}
