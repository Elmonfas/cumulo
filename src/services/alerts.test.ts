import Decimal from "decimal.js";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createDatabase, type CumuloDB } from "@/data/db";
import type { Repositories } from "@/data/repositories";
import { createDexieRepositories } from "@/data/repositories/dexie";
import { checkAlerts, createAlert, shortAssetName } from "./alerts";
import { exportBackup, readBackup, restoreBackup } from "./backup";

describe("alertas", () => {
  let db: CumuloDB;
  let repos: Repositories;
  let assetId: string;

  beforeEach(async () => {
    db = createDatabase(`alerts-${crypto.randomUUID()}`);
    repos = createDexieRepositories(db);
    assetId = (await repos.assets.add({ name: "VWCE", type: "etf", priceSource: "yahoo", priceSourceId: "VWCE.DE" })).id;
    await repos.priceCache.put({ assetId, price: "170.94", currency: "EUR", updatedAt: "2026-10-15T15:35:52Z" });
  });
  afterEach(async () => {
    await db.delete();
  });

  it("se disparan una sola vez y avisan con nombre y precio", async () => {
    await createAlert(repos, assetId, "above", new Decimal("170"));
    await createAlert(repos, assetId, "below", new Decimal("150"));
    const notify = vi.fn();

    const first = await checkAlerts(repos, notify, new Date("2026-10-15T16:00:00Z"));
    expect(first).toHaveLength(1);
    expect(notify).toHaveBeenCalledWith(
      "VWCE ha subido de 170,00\u00a0€",
      "",
      expect.stringMatching(/^alert-/),
    );
    const stored = await repos.alerts.listByAsset(assetId);
    expect(stored.find((a) => a.direction === "above")).toMatchObject({ triggeredAt: "2026-10-15T16:00:00.000Z", triggeredPrice: "170.94" });

    expect(await checkAlerts(repos, notify)).toHaveLength(0);
    expect(notify).toHaveBeenCalledTimes(1);
  });

  it("acorta los nombres largos para que la notificación quepa", () => {
    expect(shortAssetName("Bitcoin")).toBe("Bitcoin");
    expect(shortAssetName("Vanguard FTSE All-World UCITS ETF USD Accumulation")).toBe("Vanguard FTSE All-World");
    expect(shortAssetName("iShares Core MSCI World UCITS ETF USD (Acc)")).toBe("iShares Core MSCI World");
    expect(shortAssetName("Apple Inc.")).toBe("Apple Inc.");
    expect(shortAssetName("Xtrackers MSCI Emerging Markets UCITS ETF 1C")).toBe("Xtrackers MSCI Emerging…");
    expect(shortAssetName("Amundi Index Solutions - Amundi Prime Global")).toBe("Amundi Index Solutions…");
  });

  it("rechaza precios no positivos", async () => {
    await expect(createAlert(repos, assetId, "above", new Decimal(0))).rejects.toThrow(RangeError);
  });

  it("se borran con el activo y viajan en el backup", async () => {
    await createAlert(repos, assetId, "below", new Decimal("150"));
    const { json } = await exportBackup(repos);
    const other = createDatabase(`alerts-dst-${crypto.randomUUID()}`);
    const target = createDexieRepositories(other);
    await restoreBackup(target, readBackup(json).data);
    expect(await target.alerts.list()).toHaveLength(1);
    await other.delete();

    await repos.assets.remove(assetId);
    expect(await repos.alerts.list()).toEqual([]);
  });
});
