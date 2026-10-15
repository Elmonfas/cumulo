import Decimal from "decimal.js";
import { describe, expect, it } from "vitest";
import { simulateDca } from "./dca";

const c = (date: string, close: string) => ({ date, close: new Decimal(close) });

describe("simulateDca", () => {
  // Precios: 100 en enero, 50 en febrero, 100 en marzo (el 1 de febrero es domingo → se compra el lunes 2).
  const closes = [c("2026-01-02", "100"), c("2026-01-15", "90"), c("2026-02-02", "50"), c("2026-03-02", "100"), c("2026-03-10", "110")];

  it("compra cada mes el primer día con cotización y promedia el precio", () => {
    const r = simulateDca({ closes, monthlyAmount: new Decimal(100), startDate: "2026-01-01" })!;
    expect(r.buys.map((b) => [b.date, b.price.toString(), b.quantity.toString()])).toEqual([
      ["2026-01-02", "100", "1"],
      ["2026-02-02", "50", "2"],
      ["2026-03-02", "100", "1"],
    ]);
    // 300 € por 4 participaciones → precio medio 75 €; valen 4 × 110 = 440.
    expect(r.invested.toString()).toBe("300");
    expect(r.averagePrice.toString()).toBe("75");
    expect(r.value.toString()).toBe("440");
    expect(r.gain.toString()).toBe("140");
    expect(r.gainPct!.toFixed(4)).toBe("0.4667");
    // De golpe: 300 € a 100 → 3 × 110 = 330.
    expect(r.lumpSumValue.toString()).toBe("330");
    // Menos de un año: sin anualizar.
    expect(r.annualized).toBeNull();
  });

  it("la evolución acumula lo aportado y valora cada día", () => {
    const r = simulateDca({ closes, monthlyAmount: new Decimal(100), startDate: "2026-01-01" })!;
    expect(r.timeline.map((p) => `${p.date} ${p.invested} ${p.value}`)).toEqual([
      "2026-01-02 100 100",
      "2026-01-15 100 90",
      "2026-02-02 200 150",
      "2026-03-02 300 400",
      "2026-03-10 300 440",
    ]);
  });

  it("descuenta la comisión de cada compra y usa el precio actual si se da", () => {
    const r = simulateDca({ closes, monthlyAmount: new Decimal(101), fee: new Decimal(1), startDate: "2026-01-01", currentPrice: new Decimal(120) })!;
    expect(r.quantity.toString()).toBe("4");
    expect(r.invested.toString()).toBe("303");
    expect(r.value.toString()).toBe("480");
  });

  it("el día 31 se ajusta al último día de los meses cortos", () => {
    const daily = [c("2026-01-30", "10"), c("2026-02-27", "10"), c("2026-03-31", "10")];
    const r = simulateDca({ closes: daily, monthlyAmount: new Decimal(10), startDate: "2026-01-31" })!;
    // Enero: el 31 no cotiza → no hay punto ≥ 31 ene antes del 27 feb, se compra el 27 feb;
    // febrero (28) → 31 mar; marzo (31) → 31 mar ya usado, no se repite.
    expect(r.buys.map((b) => b.date)).toEqual(["2026-02-27", "2026-03-31"]);
  });

  it("anualiza con más de un año de compras", () => {
    const monthly = Array.from({ length: 25 }, (_, i) => {
      const date = new Date(Date.UTC(2023, i, 1)).toISOString().slice(0, 10);
      return c(date, String(100 + i * 2));
    });
    const r = simulateDca({ closes: monthly, monthlyAmount: new Decimal(100), startDate: "2023-01-01" })!;
    expect(r.buys).toHaveLength(25);
    expect(r.annualized!.isPositive()).toBe(true);
  });

  it("sin datos o con aportación menor que la comisión no simula", () => {
    expect(simulateDca({ closes: [], monthlyAmount: new Decimal(100), startDate: "2026-01-01" })).toBeNull();
    expect(simulateDca({ closes, monthlyAmount: new Decimal(1), fee: new Decimal(1), startDate: "2026-01-01" })).toBeNull();
  });
});
