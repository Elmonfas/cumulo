import Decimal from "decimal.js";
import { describe, expect, it } from "vitest";
import { periodChange, periodDates, portfolioHistory, type ClosePoint } from "./history";
import type { Transaction } from "./models";
import { buildPortfolio } from "./portfolio";
import { valuePortfolio } from "./valuation";

let seq = 0;
const tx = (t: Partial<Transaction> & Pick<Transaction, "type" | "date">): Transaction => ({
  id: `h${++seq}`,
  quantity: "1",
  price: "0",
  fee: "0",
  tax: "0",
  origin: "manual",
  ...t,
});
const closes = (points: [string, string][]): ClosePoint[] => points.map(([date, close]) => ({ date, close: new Decimal(close) }));
const str = (points: { date: string; value: Decimal; invested: Decimal }[]) =>
  points.map((p) => `${p.date} ${p.value.toString()} ${p.invested.toString()}`);

describe("portfolioHistory", () => {
  const history = [
    tx({ type: "deposit", date: "2026-01-01", price: "1000" }),
    tx({ type: "buy", date: "2026-01-02", assetId: "A", quantity: "10", price: "50" }),
    tx({ type: "sell", date: "2026-01-05", assetId: "A", quantity: "4", price: "60" }),
  ];
  const series = new Map([
    ["A", closes([["2026-01-02", "52"], ["2026-01-03", "55"], ["2026-01-05", "60"]])],
  ]);
  const dates = ["2025-12-31", "2026-01-01", "2026-01-02", "2026-01-03", "2026-01-04", "2026-01-05", "2026-01-06"];

  it("con efectivo: valor = posiciones a cierre + efectivo, aportado = depósitos", () => {
    const points = portfolioHistory(history, series, dates, { tracksCash: true, currentPrices: new Map([["A", new Decimal("61")]]) });
    expect(str(points)).toEqual([
      "2025-12-31 0 0",
      "2026-01-01 1000 1000",
      // 500 de efectivo + 10 × 52
      "2026-01-02 1020 1000",
      "2026-01-03 1050 1000",
      // fin de semana: se mantiene el último cierre
      "2026-01-04 1050 1000",
      // venta 4 × 60: efectivo 740 + 6 × 60
      "2026-01-05 1100 1000",
      // último día con el precio actual
      "2026-01-06 1106 1000",
    ]);
  });

  it("el último punto coincide con la valoración de la cartera", () => {
    const current = new Map([["A", new Decimal("61")]]);
    const points = portfolioHistory(history, series, dates, { tracksCash: true, currentPrices: current });
    const valuation = valuePortfolio(buildPortfolio(history), current);
    expect(points.at(-1)!.value.toString()).toBe(valuation.totalValue.toString());
  });

  it("sin efectivo: valor = posiciones, aportado = coste abierto", () => {
    const points = portfolioHistory(history.slice(1), series, dates, { tracksCash: false, currentPrices: new Map() });
    expect(str(points).slice(2, 4)).toEqual(["2026-01-02 520 500", "2026-01-03 550 500"]);
    // Tras vender 4 queda coste 300
    expect(points.at(-1)!.invested.toString()).toBe("300");
  });

  it("sin histórico usa el precio actual y sin precio no suma", () => {
    const buys = [
      tx({ type: "buy", date: "2026-01-02", assetId: "M", quantity: "2", price: "100" }),
      tx({ type: "buy", date: "2026-01-02", assetId: "X", quantity: "1", price: "10" }),
    ];
    const points = portfolioHistory(buys, new Map(), ["2026-01-03"], {
      tracksCash: false,
      currentPrices: new Map([["M", new Decimal("120")]]),
    });
    expect(points[0].value.toString()).toBe("240");
  });
});

describe("periodChange", () => {
  const p = (date: string, value: string, invested: string) => ({ date, value: new Decimal(value), invested: new Decimal(invested) });

  it("descuenta las aportaciones del periodo", () => {
    // De 1.000 a 1.600 aportando 500: ganancia 100 sobre una base de 1.500.
    const change = periodChange([p("a", "1000", "900"), p("b", "1600", "1400")])!;
    expect(change.gain.toString()).toBe("100");
    expect(change.flows.toString()).toBe("500");
    expect(change.pct!.toFixed(6)).toBe("0.066667");
  });

  it("desde cero es la rentabilidad sobre lo aportado", () => {
    const change = periodChange([p("a", "0", "0"), p("b", "1106", "1000")])!;
    expect(change.gain.toString()).toBe("106");
    expect(change.pct!.toString()).toBe("0.106");
  });

  it("las retiradas no cuentan como pérdida", () => {
    const change = periodChange([p("a", "1000", "1000"), p("b", "700", "700")])!;
    expect(change.gain.toString()).toBe("0");
    expect(change.pct!.toString()).toBe("0");
  });

  it("sin base no hay porcentaje", () => {
    expect(periodChange([p("a", "0", "0"), p("b", "0", "0")])!.pct).toBeNull();
    expect(periodChange([p("a", "1", "1")])).toBeNull();
  });
});

describe("periodDates", () => {
  it("genera los días del periodo hasta hoy", () => {
    expect(periodDates("1D", "2026-10-15", null)).toEqual(["2026-10-14", "2026-10-15"]);
    expect(periodDates("1W", "2026-10-15", null)).toHaveLength(8);
    expect(periodDates("YTD", "2026-10-15", null)[0]).toBe("2025-12-31");
    expect(periodDates("ALL", "2026-10-15", "2026-10-01T10:00:00Z")[0]).toBe("2026-09-30");
  });

  it("muestrea por semanas los periodos largos y siempre acaba hoy", () => {
    const dates = periodDates("ALL", "2026-10-15", "2020-01-01");
    expect(dates[1]).toBe("2020-01-07");
    expect(dates.at(-1)).toBe("2026-10-15");
    expect(dates.length).toBeLessThan(400);
  });
});
