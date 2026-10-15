import { afterEach, beforeEach, describe, expect, it } from "vitest";
import type { Transaction } from "@/domain/models";
import { createDatabase, type CumuloDB } from "../db";
import { createDexieRepositories } from "./dexie";
import type { Repositories } from "./types";

const buy = (overrides: Partial<Transaction> = {}): Omit<Transaction, "id"> => ({
  assetId: "a1",
  type: "buy",
  date: "2026-01-10",
  quantity: "1.5",
  price: "100.10",
  fee: "1",
  tax: "0",
  origin: "manual",
  ...overrides,
});

describe("repositorios Dexie", () => {
  let db: CumuloDB;
  let repos: Repositories;

  beforeEach(() => {
    db = createDatabase(`test-${crypto.randomUUID()}`);
    repos = createDexieRepositories(db);
  });

  afterEach(async () => {
    await db.delete();
  });

  it("guarda activos y devuelve el id generado", async () => {
    const asset = await repos.assets.add({
      name: "Vanguard FTSE All-World",
      isin: "IE00BK5BQT80",
      type: "etf",
      priceSource: "yahoo",
      priceSourceId: "VWCE.DE",
    });
    expect(await repos.assets.get(asset.id)).toEqual(asset);
  });

  it("conserva los decimales como strings exactos", async () => {
    const tx = await repos.transactions.add(buy({ quantity: "0.123456789012345678" }));
    const stored = await repos.transactions.get(tx.id);
    expect(stored?.quantity).toBe("0.123456789012345678");
  });

  it("lista operaciones por fecha y por activo", async () => {
    await repos.transactions.bulkAdd([
      buy({ date: "2026-03-01" }),
      buy({ date: "2026-01-01", assetId: "a2" }),
      buy({ date: "2026-02-01" }),
    ]);
    expect((await repos.transactions.list()).map((t) => t.date)).toEqual(["2026-01-01", "2026-02-01", "2026-03-01"]);
    expect((await repos.transactions.listByAsset("a1")).map((t) => t.date)).toEqual(["2026-02-01", "2026-03-01"]);
  });

  it("detecta hashes de importación ya existentes", async () => {
    await repos.transactions.bulkAdd([buy({ importHash: "h1", origin: "csv-tr" }), buy()]);
    expect(await repos.transactions.existingImportHashes(["h1", "h2"])).toEqual(new Set(["h1"]));
    expect(await repos.transactions.existingImportHashes([])).toEqual(new Set());
  });

  it("devuelve ajustes por defecto y fusiona los cambios", async () => {
    expect(await repos.settings.get()).toEqual({ profileName: "", defaultPeriod: "1M" });
    await repos.settings.update({ profileName: "Pedro" });
    await repos.settings.update({ defaultPeriod: "YTD" });
    expect(await repos.settings.get()).toEqual({ profileName: "Pedro", defaultPeriod: "YTD" });
  });
});
