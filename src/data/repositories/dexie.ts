import { BACKUP_FORMAT, BACKUP_VERSION } from "@/domain/backup";
import { DEFAULT_SETTINGS, type Settings } from "@/domain/models";
import type { CumuloDB, SettingsRow } from "../db";
import type { Repositories } from "./types";

const newId = () => crypto.randomUUID();

function stripRowId({ id: _id, ...settings }: SettingsRow): Settings {
  return settings;
}

export function createDexieRepositories(db: CumuloDB): Repositories {
  const settings: Repositories["settings"] = {
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
  };

  return {
    assets: {
      list: () => db.assets.orderBy("id").toArray(),
      get: (id) => db.assets.get(id),
      findBySource: (priceSource, priceSourceId) =>
        db.assets.filter((a) => a.priceSource === priceSource && a.priceSourceId === priceSourceId).first(),
      async add(asset) {
        const row = { ...asset, id: newId() };
        await db.assets.add(row);
        return row;
      },
      async update(id, changes) {
        await db.assets.update(id, changes);
      },
      async remove(id) {
        await db.transaction("rw", db.assets, db.priceCache, db.alerts, async () => {
          await db.priceCache.delete(id);
          await db.alerts.where("assetId").equals(id).delete();
          await db.assets.delete(id);
        });
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
      list: () => db.priceCache.toArray(),
      get: (assetId) => db.priceCache.get(assetId),
      async put(entry) {
        await db.priceCache.put(entry);
      },
      async bulkPut(entries) {
        await db.priceCache.bulkPut(entries);
      },
    },

    settings,

    alerts: {
      list: () => db.alerts.toArray(),
      listByAsset: (assetId) => db.alerts.where("assetId").equals(assetId).toArray(),
      async add(alert) {
        const row = { ...alert, id: newId(), createdAt: new Date().toISOString() };
        await db.alerts.add(row);
        return row;
      },
      async markTriggered(id, price, at) {
        await db.alerts.update(id, { triggeredAt: at, triggeredPrice: price });
      },
      async remove(id) {
        await db.alerts.delete(id);
      },
    },

    backup: {
      async exportAll() {
        return db.transaction("r", [db.assets, db.transactions, db.priceCache, db.settings, db.alerts], async () => ({
          format: BACKUP_FORMAT,
          version: BACKUP_VERSION,
          exportedAt: new Date().toISOString(),
          assets: await db.assets.toArray(),
          transactions: await db.transactions.orderBy("date").toArray(),
          priceCache: await db.priceCache.toArray(),
          settings: await settings.get(),
          alerts: await db.alerts.toArray(),
        }));
      },
      async importAll(data) {
        await db.transaction("rw", [db.assets, db.transactions, db.priceCache, db.settings, db.alerts], async () => {
          await Promise.all([db.assets.clear(), db.transactions.clear(), db.priceCache.clear(), db.settings.clear(), db.alerts.clear()]);
          await db.assets.bulkAdd(data.assets);
          await db.transactions.bulkAdd(data.transactions);
          await db.priceCache.bulkAdd(data.priceCache);
          await db.settings.put({ ...DEFAULT_SETTINGS, ...data.settings, id: "app" });
          await db.alerts.bulkAdd(data.alerts ?? []);
        });
      },
    },
  };
}
