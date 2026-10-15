import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { createDatabase, type CumuloDB } from "@/data/db";
import { createDexieRepositories } from "@/data/repositories/dexie";
import type { Repositories } from "@/data/repositories";
import { deleteTransaction, ensureAsset, saveTransaction, type TransactionDraft } from "./transactions";

const draft = (overrides: Partial<TransactionDraft>): TransactionDraft => ({
  type: "buy",
  date: "2026-01-10",
  quantity: "1",
  price: "100",
  fee: "0",
  tax: "0",
  ...overrides,
});

describe("servicio de operaciones", () => {
  let db: CumuloDB;
  let repos: Repositories;
  let assetId: string;

  beforeEach(async () => {
    db = createDatabase(`svc-${crypto.randomUUID()}`);
    repos = createDexieRepositories(db);
    const asset = await ensureAsset(repos, {
      name: "Vanguard FTSE All-World",
      type: "etf",
      priceSource: "yahoo",
      priceSourceId: "VWCE.DE",
    });
    assetId = asset.id;
  });

  afterEach(async () => {
    await db.delete();
  });

  it("no duplica activos con la misma fuente", async () => {
    const again = await ensureAsset(repos, { name: "Otro nombre", type: "etf", priceSource: "yahoo", priceSourceId: "VWCE.DE" });
    expect(again.id).toBe(assetId);
    expect(await repos.assets.list()).toHaveLength(1);
  });

  it("guarda diez operaciones válidas", async () => {
    for (let i = 1; i <= 10; i++) {
      const result = await saveTransaction(repos, draft({ assetId, date: `2026-01-${String(i).padStart(2, "0")}` }));
      expect(result.ok).toBe(true);
    }
    expect(await repos.transactions.list()).toHaveLength(10);
  });

  it("rechaza una venta excesiva y no la guarda", async () => {
    await saveTransaction(repos, draft({ assetId, quantity: "2" }));
    const result = await saveTransaction(repos, draft({ type: "sell", assetId, quantity: "3", date: "2026-02-01" }));
    expect(result).toEqual({
      ok: false,
      message: "No puedes vender 3 de Vanguard FTSE All-World: el 1 feb 2026 solo tenías 2.",
    });
    expect(await repos.transactions.list()).toHaveLength(1);
  });

  it("rechaza editar una compra si deja una venta posterior sin respaldo", async () => {
    const buy = await saveTransaction(repos, draft({ assetId, quantity: "5" }));
    await saveTransaction(repos, draft({ type: "sell", assetId, quantity: "4", date: "2026-02-01" }));
    const id = buy.ok ? buy.transaction!.id : "";
    const result = await saveTransaction(repos, draft({ assetId, quantity: "3" }), id);
    expect(result.ok).toBe(false);
    expect((await repos.transactions.get(id))?.quantity).toBe("5");
  });

  it("no deja borrar la compra que respalda una venta", async () => {
    const buy = await saveTransaction(repos, draft({ assetId, quantity: "1" }));
    await saveTransaction(repos, draft({ type: "sell", assetId, quantity: "1", date: "2026-02-01" }));
    const result = await deleteTransaction(repos, buy.ok ? buy.transaction!.id : "");
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.message).toMatch(/^No se puede borrar/);
    expect(await repos.transactions.list()).toHaveLength(2);
  });
});
