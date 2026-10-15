import Decimal from "decimal.js";
import { describe, expect, it } from "vitest";
import type { Transaction } from "./models";
import { annualReturn, buyDetail, sellDetail } from "./performance";
import { buildPortfolio } from "./portfolio";

const t = (id: string, type: "buy" | "sell", date: string, quantity: string, price: string, fee = "0"): Transaction => ({
  id,
  type,
  date,
  assetId: "A",
  quantity,
  price,
  fee,
  tax: "0",
  origin: "manual",
});

describe("detalle por operación", () => {
  // Compra 1: 10 @ 100 (+1) = 1.001. Compra 2: 10 @ 120 (+1) = 1.201. Venta: 15 @ 150 (−2) = 2.248.
  const b1 = t("b1", "buy", "2024-01-10", "10", "100", "1");
  const b2 = t("b2", "buy", "2026-02-01", "10", "120", "1");
  const s1 = t("s1", "sell", "2026-03-01", "15", "150", "2");
  const state = buildPortfolio([b1, b2, s1]);
  const price = new Decimal("160");

  it("una compra vendida del todo ya no tiene valor actual", () => {
    const d = buyDetail(state, b1, price, "2026-10-15");
    expect(d.cost.toString()).toBe("1001");
    expect(d.soldQuantity.toString()).toBe("10");
    expect(d.remainingQuantity.isZero()).toBe(true);
    expect(d.currentValue).toBeNull();
    expect(d.annualized).toBeNull();
  });

  it("una compra vendida a medias: valor y ganancia de lo que queda", () => {
    const d = buyDetail(state, b2, price, "2026-10-15");
    // Quedan 5 con coste 600,5; valen 800 → +199,5 (+33,22 %).
    expect([d.remainingQuantity.toString(), d.soldQuantity.toString(), d.remainingCost.toString()]).toEqual(["5", "5", "600.5"]);
    expect(d.currentValue!.toString()).toBe("800");
    expect(d.gain!.toString()).toBe("199.5");
    expect(d.gainPct!.toFixed(4)).toBe("0.3322");
    expect(d.daysHeld).toBe(256);
    // Menos de un año: no se anualiza.
    expect(d.annualized).toBeNull();
  });

  it("una compra de hace más de un año se anualiza", () => {
    const solo = buildPortfolio([b1]);
    const d = buyDetail(solo, b1, new Decimal("121.121"), "2026-01-09");
    // 1.211,21 − 1.001 = 210,21 → 21 % en 730 días ≈ 10 % anual.
    expect(d.gainPct!.toFixed(4)).toBe("0.2100");
    expect(d.annualized!.toFixed(3)).toBe("0.100");
  });

  it("el detalle de una venta usa el coste FIFO", () => {
    const d = sellDetail(state, s1)!;
    expect([d.proceeds.toString(), d.cost.toString(), d.gain.toString()]).toEqual(["2248", "1601.5", "646.5"]);
    expect(d.gainPct!.toFixed(4)).toBe("0.4037");
    expect(sellDetail(state, b1)).toBeNull();
  });
});

describe("annualReturn", () => {
  it("TIR con compras, venta y valor actual", () => {
    const transactions = [t("a", "buy", "2022-01-01", "10", "100"), t("b", "sell", "2023-01-01", "5", "110")];
    // −1.000; +550 a un año; +5 × 121 = 605 a dos años.
    const rate = annualReturn(transactions, new Decimal("605"), "2024-01-01")!;
    expect(rate.toFixed(4)).toBe("0.1000");
  });

  it("null con menos de un año de historia", () => {
    expect(annualReturn([t("a", "buy", "2026-06-01", "1", "100")], new Decimal("120"), "2026-10-15")).toBeNull();
  });
});
