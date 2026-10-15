import Decimal from "decimal.js";
import { describe, expect, it } from "vitest";
import type { Transaction } from "./models";
import { buildPortfolio } from "./portfolio";
import { valuePortfolio } from "./valuation";

let seq = 0;
const tx = (t: Partial<Transaction> & Pick<Transaction, "type" | "date">): Transaction => ({
  id: `v${++seq}`,
  quantity: "1",
  price: "0",
  fee: "0",
  tax: "0",
  origin: "manual",
  ...t,
});

const prices = (entries: Record<string, string>) => new Map(Object.entries(entries).map(([k, v]) => [k, new Decimal(v)]));

describe("valuePortfolio", () => {
  // A: 10 @ 100 + 1 → coste 1.001. B: 2 @ 50 → coste 100. Venta de 1 B @ 70 → realizado 20.
  const history = [
    tx({ type: "buy", date: "2026-01-01", assetId: "A", quantity: "10", price: "100", fee: "1" }),
    tx({ type: "buy", date: "2026-01-02", assetId: "B", quantity: "2", price: "50" }),
    tx({ type: "sell", date: "2026-01-03", assetId: "B", quantity: "1", price: "70" }),
  ];

  it("valora a mercado, calcula el no realizado y los pesos", () => {
    const v = valuePortfolio(buildPortfolio(history), prices({ A: "110", B: "40" }));
    // A: 1.100 − 1.001 = 99. B: 40 − 50 = −10. Valor 1.140; coste 1.051.
    expect(v.marketValue.toString()).toBe("1140");
    expect(v.invested.toString()).toBe("1051");
    expect(v.unrealized.toString()).toBe("89");
    expect(v.unrealizedPct!.toFixed(6)).toBe("0.084681");
    expect(v.realized.toString()).toBe("20");
    expect(v.totalGain.toString()).toBe("109");
    expect(v.positions.map((p) => p.position.assetId)).toEqual(["A", "B"]);
    expect(v.positions[0].weight!.toFixed(4)).toBe("0.9649");
    expect(v.positions[1].unrealizedPct!.toString()).toBe("-0.2");
  });

  it("sin depósitos registrados el patrimonio es el valor de las posiciones", () => {
    const v = valuePortfolio(buildPortfolio(history), prices({ A: "110", B: "40" }));
    expect(v.tracksCash).toBe(false);
    expect(v.totalValue.toString()).toBe("1140");
  });

  it("con depósitos el patrimonio suma el efectivo", () => {
    const withCash = [tx({ type: "deposit", date: "2025-12-31", price: "2000" }), ...history];
    const v = valuePortfolio(buildPortfolio(withCash), prices({ A: "110", B: "40" }));
    // Efectivo: 2.000 − 1.001 − 100 + 70 = 969. Patrimonio 1.140 + 969.
    expect(v.cash.toString()).toBe("969");
    expect(v.totalValue.toString()).toBe("2109");
  });

  it("un activo sin precio no rompe la valoración", () => {
    const v = valuePortfolio(buildPortfolio(history), prices({ A: "110" }));
    expect(v.missingPrices).toBe(1);
    expect(v.marketValue.toString()).toBe("1100");
    expect(v.unrealized.toString()).toBe("99");
    expect(v.invested.toString()).toBe("1051");
    const b = v.positions.find((p) => p.position.assetId === "B")!;
    expect(b.marketValue).toBeNull();
    expect(b.weight).toBeNull();
  });

  it("cartera vacía", () => {
    const v = valuePortfolio(buildPortfolio([]), new Map());
    expect(v.totalValue.isZero()).toBe(true);
    expect(v.unrealizedPct).toBeNull();
    expect(v.positions).toEqual([]);
  });
});
