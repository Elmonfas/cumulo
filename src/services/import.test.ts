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
    // El depósito no se importa: queda como fila omitida.
    expect(preview.newCount).toBe(3);
    expect(preview.parsed.skipped).toEqual([{ line: 2, reason: "Movimiento de efectivo" }]);
    expect(preview.duplicateCount).toBe(0);
    expect(preview.totals.buy).toMatchObject({ count: 2 });
    expect(preview.totals.buy!.amount.toString()).toBe("402");
    expect(preview.totals.sell!.amount.toString()).toBe("119");
    expect(preview.totals.deposit).toBeUndefined();
    expect(preview.problem).toBeNull();
  });

  it("importa, crea el activo por ISIN y reimportar no duplica nada", async () => {
    const file = await sampleFile();
    expect(await commitImport(repos, await prepareImport(repos, file), search)).toEqual({ imported: 3 });

    const assets = await repos.assets.list();
    expect(assets).toHaveLength(1);
    expect(assets[0]).toMatchObject({ isin: "IE00BK5BQT80", priceSource: "yahoo", priceSourceId: "VWCE.DE" });
    const stored = await repos.transactions.list();
    expect(stored).toHaveLength(3);
    expect(stored.every((t) => t.origin === "csv-tr" && t.importHash)).toBe(true);

    const again = await prepareImport(repos, await sampleFile());
    expect(again.newCount).toBe(0);
    expect(again.duplicateCount).toBe(3);
    expect(await commitImport(repos, again, search)).toEqual({ imported: 0 });
    expect(await repos.transactions.list()).toHaveLength(3);
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

describe("importación del CSV real de Trade Republic", () => {
  let db: CumuloDB;
  let repos: Repositories;
  const trSearch: SearchFn = vi.fn(async (query: string) => ({
    securities:
      query === "IE00BK5BQT80"
        ? [{ name: "Vanguard FTSE All-World UCITS ETF", ticker: "VWCE", type: "etf" as const, priceSource: "yahoo" as const, priceSourceId: "VWCE.DE" }]
        : query === "US0231351067"
          ? [{ name: "Amazon.com, Inc.", ticker: "AMZN", type: "stock" as const, priceSource: "yahoo" as const, priceSourceId: "AMZN" }]
          : [],
    crypto:
      query === "BTC"
        ? [
            { name: "Bitcoin", ticker: "BTC", type: "crypto" as const, priceSource: "coingecko" as const, priceSourceId: "bitcoin" },
            { name: "Batcat", ticker: "BTC2", type: "crypto" as const, priceSource: "coingecko" as const, priceSourceId: "batcat" },
          ]
        : [],
  }));

  beforeEach(() => {
    db = createDatabase(`imp-tr-${crypto.randomUUID()}`);
    repos = createDexieRepositories(db);
  });
  afterEach(async () => {
    await db.delete();
  });

  async function file() {
    const { readFileSync } = await import("node:fs");
    const { join } = await import("node:path");
    const { parseTradeRepublicCsv } = await import("@/importers/trade-republic");
    return parseTradeRepublicCsv(readFileSync(join(process.cwd(), "src/importers/trade-republic/fixtures/exportacion-2026.csv"), "utf8"));
  }

  it("importa 3 compras con su activo (ISIN y cripto por ticker) y reimportar no duplica", async () => {
    const preview = await prepareImport(repos, await file());
    expect(preview.newCount).toBe(3);
    expect(preview.totals.buy!.amount.toDecimalPlaces(2).toString()).toBe("160.25");
    expect(await commitImport(repos, preview, trSearch)).toEqual({ imported: 3 });

    const assets = await repos.assets.list();
    expect(assets.map((a) => a.priceSourceId).sort()).toEqual(["AMZN", "VWCE.DE", "bitcoin"]);

    const again = await prepareImport(repos, await file());
    expect(again.newCount).toBe(0);
    expect(again.rows.every((r) => r.duplicateOf === "import")).toBe(true);
  });

  it("detecta las compras ya registradas a mano", async () => {
    const btc = await repos.assets.add({ name: "Bitcoin", ticker: "BTC", type: "crypto", priceSource: "coingecko", priceSourceId: "bitcoin" });
    await repos.transactions.add({ type: "buy", assetId: btc.id, date: "2026-10-14", quantity: "0.000665", price: "73616.13", fee: "1", tax: "0", origin: "manual" });

    const preview = await prepareImport(repos, await file());
    expect(preview.newCount).toBe(2);
    expect(preview.rows.find((r) => r.transaction.asset?.ticker === "BTC")).toMatchObject({ duplicate: true, duplicateOf: "manual" });
  });
});
