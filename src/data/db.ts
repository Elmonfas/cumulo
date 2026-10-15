import Dexie, { type EntityTable } from "dexie";
import type { Asset, PriceAlert, PriceCacheEntry, Settings, Transaction } from "@/domain/models";

/** Fila única de ajustes; la clave fija permite un get/put sencillo. */
export interface SettingsRow extends Settings {
  id: "app";
}

export type CumuloDB = Dexie & {
  assets: EntityTable<Asset, "id">;
  transactions: EntityTable<Transaction, "id">;
  priceCache: EntityTable<PriceCacheEntry, "assetId">;
  settings: EntityTable<SettingsRow, "id">;
  alerts: EntityTable<PriceAlert, "id">;
};

export function createDatabase(name = "cumulo"): CumuloDB {
  const db = new Dexie(name) as CumuloDB;
  db.version(1).stores({
    assets: "id, type, ticker, isin",
    transactions: "id, assetId, type, date, importHash",
    priceCache: "assetId",
    settings: "id",
  });
  // v2: alertas de precio.
  db.version(2).stores({ alerts: "id, assetId" });
  return db;
}
