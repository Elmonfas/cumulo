import Decimal from "decimal.js";
import { describe, expect, it } from "vitest";
import { averageMonthlyContribution, futureValue, goalProgress, monthsUntil, requiredMonthly, type Goal } from "./goals";
import type { Transaction } from "./models";

const d = (v: number | string) => new Decimal(v);
let n = 0;
const tx = (t: Partial<Transaction> & Pick<Transaction, "type" | "date" | "price">): Transaction => ({
  id: `t${++n}`,
  assetId: "A",
  quantity: "1",
  fee: "0",
  tax: "0",
  origin: "manual",
  ...t,
});

describe("monthsUntil", () => {
  it("cuenta meses de calendario completos", () => {
    expect(monthsUntil("2026-10-19", "2030-10-19")).toBe(48);
    expect(monthsUntil("2026-10-19", "2030-10-18")).toBe(47);
    expect(monthsUntil("2026-10-19", "2026-11-30")).toBe(1);
    expect(monthsUntil("2026-10-19", "2026-01-01")).toBe(0);
  });
});

describe("futureValue y requiredMonthly", () => {
  it("sin rentabilidad es una suma", () => {
    expect(futureValue(d(1000), d(100), d(0), 12).toString()).toBe("2200");
    expect(requiredMonthly(d(1000), d(7000), d(0), 24)!.toString()).toBe("250");
  });

  it("al 1 % mensual: 10.000 € en 12 meses desde 0 piden 788,49 €/mes", () => {
    // 10.000 × 0,01 / (1,01^12 − 1) = 100 / 0,12682503 = 788,4879
    const pmt = requiredMonthly(d(0), d(10_000), d("0.01"), 12)!;
    expect(pmt.toString()).toBe("788.49");
    expect(futureValue(d(0), pmt, d("0.01"), 12).toDecimalPlaces(2).toString()).toBe("10000.03");
  });

  it("si lo que hay ya llega solo, la cuota es 0; sin meses, no hay cuota", () => {
    // 9.000 × 1,01^12 = 10.141,43 ≥ 10.000
    expect(requiredMonthly(d(9000), d(10_000), d("0.01"), 12)!.toString()).toBe("0");
    expect(requiredMonthly(d(0), d(10_000), d("0.01"), 0)).toBeNull();
  });
});

describe("averageMonthlyContribution", () => {
  it("compras − ventas de los últimos 6 meses (incluido el actual), entre 6", () => {
    const transactions = [
      tx({ type: "buy", date: "2026-03-10", price: "999" }), // primera compra, fuera de la ventana
      tx({ type: "buy", date: "2026-04-30", price: "999" }), // fuera: la ventana empieza en mayo
      tx({ type: "buy", date: "2026-05-10", price: "600" }),
      tx({ type: "sell", date: "2026-06-02", price: "300" }),
      tx({ type: "dividend", date: "2026-07-01", price: "50" }), // no es aportación
      tx({ type: "buy", date: "2026-09-30", price: "600" }),
      tx({ type: "buy", date: "2026-10-01", price: "300" }),
    ];
    // (600 − 300 + 600 + 300) / 6
    expect(averageMonthlyContribution(transactions, "2026-10-19").toString()).toBe("200");
  });

  it("si empezaste hace poco, solo cuentan los meses desde la primera compra", () => {
    const transactions = [tx({ type: "buy", date: "2026-10-14", price: "49.95" }), tx({ type: "buy", date: "2026-10-15", price: "110.30" })];
    expect(averageMonthlyContribution(transactions, "2026-10-19").toString()).toBe("160.25");
    const twoMonths = [tx({ type: "buy", date: "2026-09-02", price: "100" }), tx({ type: "buy", date: "2026-10-02", price: "100" })];
    expect(averageMonthlyContribution(twoMonths, "2026-10-19").toString()).toBe("100");
  });

  it("nunca es negativa", () => {
    const transactions = [tx({ type: "buy", date: "2026-01-01", price: "100" }), tx({ type: "sell", date: "2026-08-01", price: "500" })];
    expect(averageMonthlyContribution(transactions, "2026-10-19").toString()).toBe("0");
  });
});

describe("goalProgress", () => {
  const goal: Goal = { id: "g", name: "Entrada del piso", target: "10000", targetDate: "2027-10-19", expectedReturn: "0", createdAt: "2026-10-19" };
  const transactions = [tx({ type: "buy", date: "2026-05-01", price: "900" })];

  it("progreso, cuota necesaria, proyección al ritmo actual y fecha estimada", () => {
    const p = goalProgress(goal, d(4000), transactions, "2026-10-19");
    expect(p.progress.toString()).toBe("0.4");
    expect(p.monthsLeft).toBe(12);
    // (10.000 − 4.000) / 12
    expect(p.requiredMonthly!.toString()).toBe("500");
    // 900 / 6 = 150 €/mes → 4.000 + 12 × 150
    expect(p.currentMonthly.toString()).toBe("150");
    expect(p.projected.toString()).toBe("5800");
    expect(p.onTrack).toBe(false);
    // Faltan 6.000 € a 150 €/mes = 40 meses desde octubre de 2026
    expect(p.reachMonth).toBe("2030-02");
  });

  it("objetivo cumplido", () => {
    const p = goalProgress(goal, d(12_000), transactions, "2026-10-19");
    expect(p).toMatchObject({ reached: true, onTrack: true, reachMonth: "2026-10" });
    expect(p.progress.toString()).toBe("1");
    expect(p.requiredMonthly!.toString()).toBe("0");
  });

  it("sin aportaciones ni rentabilidad no se llega nunca", () => {
    expect(goalProgress(goal, d(1000), [], "2026-10-19").reachMonth).toBeNull();
  });
});
