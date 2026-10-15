import Decimal from "decimal.js";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createDatabase, type CumuloDB } from "@/data/db";
import type { Repositories } from "@/data/repositories";
import { createDexieRepositories } from "@/data/repositories/dexie";
import type { Asset } from "@/domain/models";
import { refreshPrices, setManualPrice, type FetchPrices } from "./prices";

const NOW = Date.parse("2026-10-15T12:00:00Z");

describe("refreshPrices", () => {
  let db: CumuloDB;
  let repos: Repositories;
  let etf: Asset;
  let coin: Asset;
  let manual: Asset;

  beforeEach(async () => {
    db = createDatabase(`prices-${crypto.randomUUID()}`);
    repos = createDexieRepositories(db);
    etf = await repos.assets.add({ name: "VWCE", type: "etf", priceSource: "yahoo", priceSourceId: "VWCE.DE" });
    coin = await repos.assets.add({ name: "Bitcoin", type: "crypto", priceSource: "coingecko", priceSourceId: "bitcoin" });
    manual = await repos.assets.add({ name: "Piso", type: "other", priceSource: "manual", priceSourceId: "" });
  });
  afterEach(async () => {
    await db.delete();
  });

  const ok = vi.fn<FetchPrices>(async (keys) => ({
    quotes: Object.fromEntries(
      keys
        .filter((k) => k !== "coingecko:bitcoin")
        .map((k) => [k, { price: "170.94", currency: "EUR" as const, sourceCurrency: "EUR", sourcePrice: "170.94", asOf: "2026-10-15T11:59:00Z" }]),
    ),
    errors: { "coingecko:bitcoin": "Sin cotización." },
  }));

  it("guarda los precios recibidos y marca los que fallan", async () => {
    const assets = await repos.assets.list();
    const result = await refreshPrices(repos, assets, { fetchPrices: ok, now: NOW });
    expect(result).toEqual({ updated: 1, failed: [coin.id] });
    expect(await repos.priceCache.get(etf.id)).toMatchObject({ price: "170.94", updatedAt: "2026-10-15T11:59:00Z" });
    expect(ok.mock.calls[0][0].toSorted()).toEqual(["coingecko:bitcoin", "yahoo:VWCE.DE"]);
  });

  it("no vuelve a pedir un precio fresco y sí uno caducado", async () => {
    const assets = await repos.assets.list();
    await refreshPrices(repos, assets, { fetchPrices: ok, now: NOW });
    const second = vi.fn(ok);
    await refreshPrices(repos, assets, { fetchPrices: second, now: NOW + 10_000 });
    expect(second).toHaveBeenCalledWith(["coingecko:bitcoin"]);
    await refreshPrices(repos, assets, { fetchPrices: second, now: NOW + 120_000 });
    expect(second.mock.lastCall![0].toSorted()).toEqual(["coingecko:bitcoin", "yahoo:VWCE.DE"]);
  });

  it("si la fuente cae conserva el último precio", async () => {
    const assets = await repos.assets.list();
    await refreshPrices(repos, assets, { fetchPrices: ok, now: NOW });
    const down: FetchPrices = async () => {
      throw new Error("503");
    };
    const result = await refreshPrices(repos, assets, { fetchPrices: down, now: NOW + 120_000, force: true });
    expect(result.updated).toBe(0);
    expect(result.failed).toHaveLength(2);
    expect((await repos.priceCache.get(etf.id))?.price).toBe("170.94");
  });

  it("los activos manuales no se piden y admiten precio a mano", async () => {
    const spy = vi.fn(ok);
    await refreshPrices(repos, [manual], { fetchPrices: spy, now: NOW });
    expect(spy).not.toHaveBeenCalled();
    await setManualPrice(repos, manual.id, new Decimal("250000"), new Date(NOW));
    expect(await repos.priceCache.get(manual.id)).toMatchObject({ price: "250000", updatedAt: "2026-10-15T12:00:00.000Z" });
  });
});
