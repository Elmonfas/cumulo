import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createDatabase, type CumuloDB } from "@/data/db";
import { createDexieRepositories } from "@/data/repositories/dexie";
import type { Repositories } from "@/data/repositories";
import { importHash, occurrenceCounter } from "@/importers/hash";
import type { ImportedTransaction, ParsedImport } from "@/importers/types";
import { commitImport, prepareImport, type SearchFn } from "./import";

const VWCE = { name: "Vanguard FTSE All-World", isin: "IE00BK5BQT80" };

async function row(t: Omit<ImportedTransaction, "importHash" | "line">, line: number, next: (key: string) => number) {
  const key = [t.date, t.type, t.asset?.isin, t.quantity, t.price].join("|");
  return { ...t, line, importHash: await importHash(key.split("|"), next(key)) };
}

async function sampleFile(): Promise<ParsedImport> {
  const next = occurrenceCounter();
  return {
    source: "csv-tr",
    skipped: [],
    transactions: [
      await row({ type: "deposit", date: "2026-01-02", quantity: "1", price: "1000", fee: "0", tax: "0" }, 2, next),
      await row({ type: "buy", date: "2026-01-03", quantity: "2", price: "100", fee: "1", tax: "0", asset: VWCE }, 3, next),
      // Dos compras idénticas el mismo día: deben contar como dos.
      await row({ type: "buy", date: "2026-01-03", quantity: "2", price: "100", fee: "1", tax: "0", asset: VWCE }, 4, next),
      await row({ type: "sell", date: "2026-02-01", quantity: "1", price: "120", fee: "1", tax: "0", asset: VWCE }, 5, next),
    ],
  };
}

const search: SearchFn = vi.fn(async () => ({
  securities: [{ name: "Vanguard FTSE All-World UCITS ETF", ticker: "VWCE", type: "etf" as const, priceSource: "yahoo" as const, priceSourceId: "VWCE.DE" }],
  crypto: [],
}));

describe("importación", () => {
  let db: CumuloDB;
  let repos: Repositories;

  beforeEach(() => {
    db = createDatabase(`imp-${crypto.randomUUID()}`);
    repos = createDexieRepositories(db);
  });
  afterEach(async () => {
    await db.delete();
  });

  it("calcula totales y efectivo de la vista previa", async () => {
    const preview = await prepareImport(repos, await sampleFile());
    expect(preview.newCount).toBe(4);
    expect(preview.duplicateCount).toBe(0);
    expect(preview.totals.buy).toMatchObject({ count: 2 });
    expect(preview.totals.buy!.amount.toString()).toBe("402");
    // 1.000 − 201 − 201 + 119 = 717
    expect(preview.cashChange.toString()).toBe("717");
    expect(preview.problem).toBeNull();
  });

  it("importa, crea el activo por ISIN y reimportar no duplica nada", async () => {
    const file = await sampleFile();
    expect(await commitImport(repos, await prepareImport(repos, file), search)).toEqual({ imported: 4 });

    const assets = await repos.assets.list();
    expect(assets).toHaveLength(1);
    expect(assets[0]).toMatchObject({ isin: "IE00BK5BQT80", priceSource: "yahoo", priceSourceId: "VWCE.DE" });
    const stored = await repos.transactions.list();
    expect(stored).toHaveLength(4);
    expect(stored.every((t) => t.origin === "csv-tr" && t.importHash)).toBe(true);

    const again = await prepareImport(repos, await sampleFile());
    expect(again.newCount).toBe(0);
    expect(again.duplicateCount).toBe(4);
    expect(await commitImport(repos, again, search)).toEqual({ imported: 0 });
    expect(await repos.transactions.list()).toHaveLength(4);
  });

  it("detecta ventas sin respaldo antes de importar", async () => {
    const file = await sampleFile();
    file.transactions = file.transactions.filter((t) => t.type !== "buy");
    const preview = await prepareImport(repos, file);
    expect(preview.problem).toMatch(/No se puede vender.*línea 5/);
    await expect(commitImport(repos, preview, search)).rejects.toThrow();
    expect(await repos.transactions.list()).toHaveLength(0);
  });

  it("crea un activo manual si la búsqueda falla", async () => {
    const failing: SearchFn = async () => {
      throw new Error("offline");
    };
    await commitImport(repos, await prepareImport(repos, await sampleFile()), failing);
    const [asset] = await repos.assets.list();
    expect(asset).toMatchObject({ name: "Vanguard FTSE All-World", priceSource: "manual", isin: "IE00BK5BQT80" });
  });
});

describe("importHash", () => {
  it("es estable y distingue apariciones", async () => {
    expect(await importHash(["a", "b"], 1)).toBe(await importHash([" A", "b "], 1));
    expect(await importHash(["a", "b"], 1)).not.toBe(await importHash(["a", "b"], 2));
  });
});
