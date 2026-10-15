import { DEFAULT_SETTINGS, type Settings } from "@/domain/models";
import type { CumuloDB, SettingsRow } from "../db";
import type { Repositories } from "./types";

const newId = () => crypto.randomUUID();

function stripRowId({ id: _id, ...settings }: SettingsRow): Settings {
  return settings;
}

export function createDexieRepositories(db: CumuloDB): Repositories {
  return {
    assets: {
      list: () => db.assets.orderBy("id").toArray(),
      get: (id) => db.assets.get(id),
      async add(asset) {
        const row = { ...asset, id: newId() };
        await db.assets.add(row);
        return row;
      },
      async update(id, changes) {
        await db.assets.update(id, changes);
      },
      async remove(id) {
        await db.assets.delete(id);
      },
    },

    transactions: {
      list: () => db.transactions.orderBy("date").toArray(),
      listByAsset: (assetId) => db.transactions.where("assetId").equals(assetId).sortBy("date"),
      get: (id) => db.transactions.get(id),
      async add(transaction) {
        const row = { ...transaction, id: newId() };
        await db.transactions.add(row);
        return row;
      },
      async bulkAdd(transactions) {
        const rows = transactions.map((t) => ({ ...t, id: newId() }));
        await db.transactions.bulkAdd(rows);
        return rows;
      },
      async update(id, changes) {
        await db.transactions.update(id, changes);
      },
      async remove(id) {
        await db.transactions.delete(id);
      },
      async existingImportHashes(hashes) {
        if (hashes.length === 0) return new Set();
        const rows = await db.transactions.where("importHash").anyOf(hashes).toArray();
        return new Set(rows.map((r) => r.importHash!));
      },
    },

    priceCache: {
      get: (assetId) => db.priceCache.get(assetId),
      async put(entry) {
        await db.priceCache.put(entry);
      },
    },

    settings: {
      async get() {
        const row = await db.settings.get("app");
        return row ? { ...DEFAULT_SETTINGS, ...stripRowId(row) } : { ...DEFAULT_SETTINGS };
      },
      async update(changes) {
        return db.transaction("rw", db.settings, async () => {
          const current = await db.settings.get("app");
          const next = { ...DEFAULT_SETTINGS, ...(current && stripRowId(current)), ...changes };
          await db.settings.put({ ...next, id: "app" });
          return next;
        });
      },
    },
  };
}
