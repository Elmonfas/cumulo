import Decimal from "decimal.js";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { createDatabase, type CumuloDB } from "@/data/db";
import type { Repositories } from "@/data/repositories";
import { createDexieRepositories } from "@/data/repositories/dexie";
import { exportBackup, readBackup, restoreBackup } from "./backup";
import { saveTransaction } from "./transactions";
import { changeSinceWatched, fillWatchBaselines, unwatch } from "./watchlist";

describe("lista de seguimiento", () => {
  let db: CumuloDB;
  let repos: Repositories;
  let assetId: string;

  beforeEach(async () => {
    db = createDatabase(`watch-${crypto.randomUUID()}`);
    repos = createDexieRepositories(db);
    assetId = (await repos.assets.add({ name: "Apple", type: "stock", priceSource: "yahoo", priceSourceId: "AAPL" })).id;
  });
  afterEach(async () => {
    await db.delete();
  });

  it("no duplica y guarda el primer precio conocido como referencia", async () => {
    await repos.watchlist.add(assetId);
    await repos.watchlist.add(assetId);
    expect(await repos.watchlist.list()).toHaveLength(1);
    expect(await fillWatchBaselines(repos)).toBe(0);

    await repos.priceCache.put({ assetId, price: "200", currency: "EUR", updatedAt: "2026-10-15T10:00:00Z" });
    expect(await fillWatchBaselines(repos)).toBe(1);
    await repos.priceCache.put({ assetId, price: "250", currency: "EUR", updatedAt: "2026-10-16T10:00:00Z" });
    expect(await fillWatchBaselines(repos)).toBe(0);

    const [item] = await repos.watchlist.list();
    expect(item.addedPrice).toBe("200");
    expect(changeSinceWatched(item, new Decimal("250"))!.toString()).toBe("0.25");
    expect(changeSinceWatched({ ...item, addedPrice: undefined }, new Decimal("250"))).toBeNull();
  });

  it("al dejar de seguir borra el activo si no tiene operaciones", async () => {
    await repos.watchlist.add(assetId);
    await unwatch(repos, assetId);
    expect(await repos.assets.get(assetId)).toBeUndefined();

    const held = (await repos.assets.add({ name: "VWCE", type: "etf", priceSource: "yahoo", priceSourceId: "VWCE.DE" })).id;
    await saveTransaction(repos, { type: "buy", assetId: held, date: "2026-01-02", quantity: "1", price: "100", fee: "0", tax: "0" });
    await repos.watchlist.add(held);
    await unwatch(repos, held);
    expect(await repos.assets.get(held)).toBeDefined();
    expect(await repos.watchlist.list()).toEqual([]);
  });

  it("viaja en el backup", async () => {
    await repos.watchlist.add(assetId);
    const other = createDatabase(`watch-dst-${crypto.randomUUID()}`);
    const target = createDexieRepositories(other);
    await restoreBackup(target, readBackup((await exportBackup(repos)).json).data);
    expect(await target.watchlist.list()).toHaveLength(1);
    await other.delete();
  });
});
