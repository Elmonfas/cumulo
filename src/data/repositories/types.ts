import type { BackupData } from "@/domain/backup";
import type { Asset, PriceAlert, PriceCacheEntry, PriceSource, Settings, Transaction } from "@/domain/models";

/**
 * Contratos de acceso a datos. La UI solo conoce estas interfaces; hoy las
 * implementa Dexie y mañana podría hacerlo otro backend sin tocar la UI.
 */
export interface AssetRepository {
  list(): Promise<Asset[]>;
  get(id: string): Promise<Asset | undefined>;
  findBySource(priceSource: PriceSource, priceSourceId: string): Promise<Asset | undefined>;
  add(asset: Omit<Asset, "id">): Promise<Asset>;
  update(id: string, changes: Partial<Omit<Asset, "id">>): Promise<void>;
  remove(id: string): Promise<void>;
}

export interface TransactionRepository {
  /** Ordenadas por fecha ascendente. */
  list(): Promise<Transaction[]>;
  listByAsset(assetId: string): Promise<Transaction[]>;
  get(id: string): Promise<Transaction | undefined>;
  add(transaction: Omit<Transaction, "id">): Promise<Transaction>;
  bulkAdd(transactions: Omit<Transaction, "id">[]): Promise<Transaction[]>;
  update(id: string, changes: Partial<Omit<Transaction, "id">>): Promise<void>;
  remove(id: string): Promise<void>;
  /** Devuelve los hashes de importación que ya existen de entre los dados. */
  existingImportHashes(hashes: string[]): Promise<Set<string>>;
}

export interface PriceCacheRepository {
  list(): Promise<PriceCacheEntry[]>;
  get(assetId: string): Promise<PriceCacheEntry | undefined>;
  put(entry: PriceCacheEntry): Promise<void>;
  bulkPut(entries: PriceCacheEntry[]): Promise<void>;
}

export interface SettingsRepository {
  get(): Promise<Settings>;
  update(changes: Partial<Settings>): Promise<Settings>;
}

export interface AlertRepository {
  list(): Promise<PriceAlert[]>;
  listByAsset(assetId: string): Promise<PriceAlert[]>;
  add(alert: Omit<PriceAlert, "id" | "createdAt">): Promise<PriceAlert>;
  markTriggered(id: string, price: string, at: string): Promise<void>;
  remove(id: string): Promise<void>;
}

export interface BackupRepository {
  exportAll(): Promise<BackupData>;
  /** Sustituye todos los datos por los del backup, de forma atómica. */
  importAll(data: BackupData): Promise<void>;
}

export interface Repositories {
  assets: AssetRepository;
  transactions: TransactionRepository;
  priceCache: PriceCacheRepository;
  settings: SettingsRepository;
  alerts: AlertRepository;
  backup: BackupRepository;
}
