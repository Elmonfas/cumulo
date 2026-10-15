import { describe, expect, it } from "vitest";
import type { Transaction } from "./models";
import { buildPortfolio, cashEffect, checkTransactions, InvalidTransactionError, openPositions, OversellError } from "./portfolio";

let seq = 0;
const tx = (t: Partial<Transaction> & Pick<Transaction, "type" | "date">): Transaction => ({
  id: `t${++seq}`,
  quantity: "1",
  price: "0",
  fee: "0",
  tax: "0",
  origin: "manual",
  ...t,
});
const buy = (date: string, quantity: string, price: string, fee = "0", assetId = "A") =>
  tx({ type: "buy", date, quantity, price, fee, assetId });
const sell = (date: string, quantity: string, price: string, fee = "0", assetId = "A") =>
  tx({ type: "sell", date, quantity, price, fee, assetId });
const cash = (type: "deposit" | "withdrawal" | "dividend" | "fee", date: string, amount: string, tax = "0") =>
  tx({ type, date, price: amount, tax });

describe("buildPortfolio — compras y coste medio", () => {
  it("suma las comisiones al coste y pondera el coste medio", () => {
    // 10 × 100 + 1 = 1.001; 5 × 130 + 1 = 651 → 15 uds, coste 1.652, medio 110,1333…
    const state = buildPortfolio([buy("2026-01-10", "10", "100", "1"), buy("2026-02-10", "5", "130", "1")]);
    const p = state.positions.get("A")!;
    expect(p.quantity.toString()).toBe("15");
    expect(p.cost.toString()).toBe("1652");
    expect(p.averageCost.toFixed(4)).toBe("110.1333");
    expect(state.cash.toString()).toBe("-1652");
  });

  it("admite cantidades fraccionarias sin perder precisión", () => {
    const state = buildPortfolio([buy("2026-01-01", "0.1", "0.3"), buy("2026-01-02", "0.2", "0.3")]);
    expect(state.positions.get("A")!.quantity.toString()).toBe("0.3");
    expect(state.positions.get("A")!.cost.toString()).toBe("0.09");
  });
});

describe("buildPortfolio — ventas FIFO", () => {
  it("consume primero el lote más antiguo, incluido un lote parcial", () => {
    // Lote 1: 10 @ 100 (+1) = 1.001. Lote 2: 10 @ 120 (+1) = 1.201.
    // Venta 15 @ 150 (−2) → neto 2.248. Coste FIFO = 1.001 + 1.201 × 5/10 = 1.601,5.
    // Ganancia = 2.248 − 1.601,5 = 646,5. Queda: 5 uds del lote 2 con coste 600,5.
    const state = buildPortfolio([
      buy("2026-01-01", "10", "100", "1"),
      buy("2026-02-01", "10", "120", "1"),
      sell("2026-03-01", "15", "150", "2"),
    ]);
    const p = state.positions.get("A")!;
    expect(p.realizedGain.toString()).toBe("646.5");
    expect(p.quantity.toString()).toBe("5");
    expect(p.cost.toString()).toBe("600.5");
    expect(p.averageCost.toString()).toBe("120.1");
    expect(p.lots).toHaveLength(1);
    expect(state.realizedGain.toString()).toBe("646.5");
  });

  it("registra pérdidas como ganancia negativa", () => {
    const state = buildPortfolio([buy("2026-01-01", "4", "50"), sell("2026-01-05", "4", "40", "1")]);
    expect(state.realizedGain.toString()).toBe("-41");
    expect(openPositions(state)).toHaveLength(0);
    expect(state.positions.get("A")!.averageCost.toString()).toBe("0");
  });

  it("el impuesto de la venta reduce el importe neto", () => {
    const state = buildPortfolio([
      buy("2026-01-01", "1", "100"),
      tx({ type: "sell", date: "2026-01-02", quantity: "1", price: "110", tax: "1.5", assetId: "A" }),
    ]);
    expect(state.realizedGain.toString()).toBe("8.5");
  });

  it("separa las posiciones por activo", () => {
    const state = buildPortfolio([
      buy("2026-01-01", "1", "10", "0", "A"),
      buy("2026-01-01", "2", "20", "0", "B"),
      sell("2026-01-02", "1", "30", "0", "B"),
    ]);
    expect(state.positions.get("A")!.quantity.toString()).toBe("1");
    expect(state.positions.get("B")!.quantity.toString()).toBe("1");
    expect(state.positions.get("B")!.realizedGain.toString()).toBe("10");
  });
});

describe("buildPortfolio — venta excesiva", () => {
  it("rechaza vender más de lo que se tiene", () => {
    const history = [buy("2026-01-01", "2", "10"), sell("2026-01-02", "3", "10")];
    expect(() => buildPortfolio(history)).toThrow(OversellError);
    const error = checkTransactions(history);
    expect(error).toBeInstanceOf(OversellError);
    expect((error as OversellError).available.toString()).toBe("2");
  });

  it("tiene en cuenta la fecha: no se puede vender antes de comprar", () => {
    expect(checkTransactions([sell("2026-01-01", "1", "10"), buy("2026-01-02", "1", "10")])).toBeInstanceOf(OversellError);
  });

  it("el mismo día procesa la compra antes que la venta", () => {
    expect(checkTransactions([sell("2026-01-01", "1", "10"), buy("2026-01-01", "1", "10")])).toBeNull();
  });

  it("rechaza vender un activo sin compras", () => {
    expect(checkTransactions([sell("2026-01-01", "1", "10", "0", "Z")])).toBeInstanceOf(OversellError);
  });
});

describe("buildPortfolio — efectivo", () => {
  it("cuadra depósitos, compras, ventas, dividendos, comisiones y retiradas", () => {
    // +1.000 − (5 × 100 + 1) + (2 × 120 − 1) + (10 − 1,5 de retención) − 2 − 300 = 444,5
    const state = buildPortfolio([
      cash("deposit", "2026-01-01", "1000"),
      buy("2026-01-02", "5", "100", "1"),
      sell("2026-02-01", "2", "120", "1"),
      tx({ type: "dividend", date: "2026-03-01", price: "10", tax: "1.5", assetId: "A" }),
      cash("fee", "2026-03-15", "2"),
      cash("withdrawal", "2026-04-01", "300"),
    ]);
    expect(state.cash.toString()).toBe("444.5");
    expect(state.netDeposits.toString()).toBe("700");
    expect(state.dividends.toString()).toBe("8.5");
    expect(state.fees.toString()).toBe("2");
    // Ganancia: (2 × 120 − 1) − 2 × 100,2 = 239 − 200,4 = 38,6
    expect(state.realizedGain.toString()).toBe("38.6");
  });
});

describe("cashEffect", () => {
  it("coincide con la variación de efectivo de buildPortfolio", () => {
    const history = [
      cash("deposit", "2026-01-01", "1000"),
      buy("2026-01-02", "5", "100", "1"),
      sell("2026-02-01", "2", "120", "1"),
      tx({ type: "dividend", date: "2026-03-01", price: "10", tax: "1.5", assetId: "A" }),
      cash("fee", "2026-03-15", "2"),
      cash("withdrawal", "2026-04-01", "300"),
    ];
    const total = history.reduce((sum, t) => sum.plus(cashEffect(t)), buildPortfolio([]).cash);
    expect(total.toString()).toBe(buildPortfolio(history).cash.toString());
    expect(cashEffect(history[1]).toString()).toBe("-501");
  });
});

describe("validación", () => {
  it.each([
    [buy("2026-01-01", "0", "10"), "cantidad"],
    [buy("2026-01-01", "-1", "10"), "cantidad"],
    [buy("2026-01-01", "1", "-10"), "precio"],
    [buy("2026-01-01", "1", "10", "-1"), "Comisión"],
    [tx({ type: "buy", date: "2026-01-01", quantity: "1", price: "1" }), "activo"],
  ])("rechaza %#", (t, message) => {
    const error = checkTransactions([t]);
    expect(error).toBeInstanceOf(InvalidTransactionError);
    expect(error!.message).toMatch(new RegExp(message, "i"));
  });
});
