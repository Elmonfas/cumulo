import Decimal from "decimal.js";
import { describe, expect, it } from "vitest";
import { allocationByAsset, allocationByType } from "./allocation";
import type { AssetType, Transaction } from "./models";
import { buildPortfolio } from "./portfolio";
import { valuePortfolio } from "./valuation";

const buy = (assetId: string, price: string): Transaction => ({
  id: assetId,
  type: "buy",
  date: "2026-01-01",
  assetId,
  quantity: "1",
  price,
  fee: "0",
  tax: "0",
  origin: "manual",
});

const assets = ["A", "B", "C", "D", "E", "F", "G"];
const values: Record<string, string> = { A: "400", B: "200", C: "150", D: "100", E: "80", F: "50", G: "20" };
const types: Record<string, AssetType> = { A: "etf", B: "etf", C: "stock", D: "stock", E: "crypto", F: "stock", G: "other" };
const valuation = valuePortfolio(
  buildPortfolio(assets.map((a) => buy(a, values[a]))),
  new Map(assets.map((a) => [a, new Decimal(values[a])])),
);

describe("distribución", () => {
  it("agrupa por tipo y ordena de mayor a menor", () => {
    const slices = allocationByType(valuation, (id) => types[id]);
    expect(slices.map((s) => `${s.key} ${s.value} ${s.share}`)).toEqual([
      "etf 600 0.6",
      "stock 300 0.3",
      "crypto 80 0.08",
      "other 20 0.02",
    ]);
  });

  it("agrupa la cola de activos en «other» y las partes suman 1", () => {
    const slices = allocationByAsset(valuation, 4);
    expect(slices.map((s) => s.key)).toEqual(["A", "B", "C", "other"]);
    expect(slices.at(-1)!.value.toString()).toBe("250");
    expect(slices.reduce((sum, s) => sum.plus(s.share), new Decimal(0)).toString()).toBe("1");
  });

  it("vacía si no hay valor", () => {
    expect(allocationByAsset(valuePortfolio(buildPortfolio([]), new Map()))).toEqual([]);
  });
});
