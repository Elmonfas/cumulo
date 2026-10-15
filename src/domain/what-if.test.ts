import Decimal from "decimal.js";
import { describe, expect, it } from "vitest";
import { simulateBuy } from "./what-if";

const d = (v: string) => new Decimal(v);

describe("simulateBuy", () => {
  // Tienes 10 a 120 de media (coste 1.200); vale 100 hoy; el resto de la cartera vale 3.000.
  const base = { quantity: d("10"), cost: d("1200"), otherValue: d("3000"), marketPrice: d("100"), price: d("100"), fee: d("1") };

  it("por cantidad: baja el precio medio y sube el peso", () => {
    const r = simulateBuy({ ...base, buy: { quantity: d("10") } })!;
    // 1.200 + 10 × 100 + 1 = 2.201 por 20 → 110,05
    expect(r.spent.toString()).toBe("1001");
    expect(r.cost.toString()).toBe("2201");
    expect(r.averageCost.toString()).toBe("110.05");
    expect(r.averageChange!.toFixed(6)).toBe("-0.082917");
    // Peso: 1.000 / 4.000 = 25 % → 2.000 / 5.000 = 40 %
    expect(r.weightBefore!.toString()).toBe("0.25");
    expect(r.weightAfter!.toString()).toBe("0.4");
    expect(r.unrealizedAfter.toString()).toBe("-201");
  });

  it("por importe: la comisión sale de lo que gastas", () => {
    const r = simulateBuy({ ...base, buy: { amount: d("501") } })!;
    expect(r.addedQuantity.toString()).toBe("5");
    expect(r.quantity.toString()).toBe("15");
    expect(r.cost.toString()).toBe("1701");
  });

  it("sin posición previa no hay variación del precio medio", () => {
    const r = simulateBuy({ ...base, quantity: d("0"), cost: d("0"), buy: { quantity: d("2") } })!;
    expect(r.averageChange).toBeNull();
    expect(r.averageCost.toString()).toBe("100.5");
    expect(r.weightBefore!.toString()).toBe("0");
  });

  it("rechaza entradas sin sentido", () => {
    expect(simulateBuy({ ...base, buy: { amount: d("1") } })).toBeNull();
    expect(simulateBuy({ ...base, buy: { quantity: d("0") } })).toBeNull();
    expect(simulateBuy({ ...base, price: d("0"), buy: { quantity: d("1") } })).toBeNull();
  });
});
