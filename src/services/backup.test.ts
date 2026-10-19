import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { createDatabase, type CumuloDB } from "@/data/db";
import type { Repositories } from "@/data/repositories";
import { createDexieRepositories } from "@/data/repositories/dexie";
import { InvalidBackupError } from "@/domain/backup";
import { exportBackup, readBackup, restoreBackup, wipeAllData } from "./backup";
import { ensureAsset, saveTransaction } from "./transactions";

describe("backup", () => {
  let source: CumuloDB;
  let target: CumuloDB;
  let from: Repositories;
  let to: Repositories;

  beforeEach(async () => {
    source = createDatabase(`bk-src-${crypto.randomUUID()}`);
    target = createDatabase(`bk-dst-${crypto.randomUUID()}`);
    from = createDexieRepositories(source);
    to = createDexieRepositories(target);

    const asset = await ensureAsset(from, { name: "VWCE", type: "etf", priceSource: "yahoo", priceSourceId: "VWCE.DE", isin: "IE00BK5BQT80" });
    await saveTransaction(from, { type: "deposit", date: "2026-01-01", quantity: "1", price: "1000", fee: "0", tax: "0" });
    await saveTransaction(from, { type: "buy", assetId: asset.id, date: "2026-01-02", quantity: "0.123456789", price: "100.5", fee: "1", tax: "0" });
    await from.priceCache.put({ assetId: asset.id, price: "170.94", currency: "EUR", updatedAt: "2026-10-15T15:35:52.000Z" });
    await from.settings.update({ profileName: "Pedro", defaultPeriod: "YTD" });
  });

  afterEach(async () => {
    await Promise.all([source.delete(), target.delete()]);
  });

  it("se restaura idéntico en otra base de datos (otro navegador)", async () => {
    // Datos previos en el destino que deben desaparecer.
    await to.settings.update({ profileName: "Otro" });
    const { fileName, json } = await exportBackup(from);
    expect(fileName).toMatch(/^cumulo-backup-\d{4}-\d{2}-\d{2}\.json$/);

    const summary = readBackup(json);
    expect(summary).toMatchObject({ assets: 1, transactions: 2 });
    await restoreBackup(to, summary.data);

    const [a, b] = await Promise.all([from.backup.exportAll(), to.backup.exportAll()]);
    expect({ ...b, exportedAt: "" }).toEqual({ ...a, exportedAt: "" });
    expect((await to.transactions.list())[1].quantity).toBe("0.123456789");
  });

  it("rechaza archivos que no son backups", () => {
    expect(() => readBackup("no es json")).toThrow(/JSON válido/);
    expect(() => readBackup(JSON.stringify({ hola: 1 }))).toThrow(InvalidBackupError);
  });

  it("rechaza backups manipulados", async () => {
    const { json } = await exportBackup(from);
    const data = JSON.parse(json);
    data.transactions[1].quantity = "1,5";
    expect(() => readBackup(JSON.stringify(data))).toThrow(/operación 2/);

    const orphan = JSON.parse(json);
    orphan.transactions[1].assetId = "no-existe";
    expect(() => readBackup(JSON.stringify(orphan))).toThrow(InvalidBackupError);
  });

  it("borra todos los datos", async () => {
    await wipeAllData(from);
    const data = await from.backup.exportAll();
    expect(data.assets).toEqual([]);
    expect(data.transactions).toEqual([]);
    expect(data.settings).toEqual({ profileName: "", defaultPeriod: "1M" });
  });

  it("los objetivos viajan en el backup y se validan", async () => {
    await from.goals.add({ name: "Entrada del piso", target: "30000", targetDate: "2030-06-30", expectedReturn: "0.06" });
    const { json } = await exportBackup(from);
    await restoreBackup(to, readBackup(json).data);
    expect(await to.goals.list()).toMatchObject([{ name: "Entrada del piso", target: "30000", targetDate: "2030-06-30" }]);

    const broken = JSON.parse(json);
    broken.goals[0].target = "treinta mil";
    expect(() => readBackup(JSON.stringify(broken))).toThrow(/objetivo 1/);
  });
});
