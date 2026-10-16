import Decimal from "decimal.js";
import { describe, expect, it } from "vitest";
import { intradayDates, periodChange, periodDates, portfolioHistory, type ClosePoint, type HistoryPoint } from "./history";
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
const str = (points: HistoryPoint[]) =>
  points.map((p) => `${p.date} v${p.value} i${p.invested} b${p.bought} p${p.proceeds}`);

describe("portfolioHistory", () => {
  const history = [
    tx({ type: "buy", date: "2026-01-02", assetId: "A", quantity: "10", price: "50" }),
    tx({ type: "sell", date: "2026-01-05", assetId: "A", quantity: "4", price: "60" }),
  ];
  const series = new Map([
    ["A", closes([["2026-01-02", "52"], ["2026-01-03", "55"], ["2026-01-05", "60"]])],
  ]);
  const dates = ["2026-01-01", "2026-01-02", "2026-01-03", "2026-01-04", "2026-01-05", "2026-01-06"];

  it("valor = posiciones a cierre; invertido = coste abierto; sin efectivo", () => {
    const points = portfolioHistory(history, series, dates, { currentPrices: new Map([["A", new Decimal("61")]]) });
    expect(str(points)).toEqual([
      "2026-01-01 v0 i0 b0 p0",
      "2026-01-02 v520 i500 b500 p0",
      "2026-01-03 v550 i500 b500 p0",
      // fin de semana: se mantiene el último cierre
      "2026-01-04 v550 i500 b500 p0",
      // venta de 4 × 60 = 240 cobrados; quedan 6 con coste 300
      "2026-01-05 v360 i300 b500 p240",
      // último día con el precio actual
      "2026-01-06 v366 i300 b500 p240",
    ]);
  });

  it("los depósitos importados no cuentan", () => {
    const withDeposit = [tx({ type: "deposit", date: "2026-01-01", price: "1000" }), ...history];
    const points = portfolioHistory(withDeposit, series, dates, { currentPrices: new Map([["A", new Decimal("61")]]) });
    expect(points[0].value.toString()).toBe("0");
  });

  it("el último punto coincide con la valoración de la cartera", () => {
    const current = new Map([["A", new Decimal("61")]]);
    const points = portfolioHistory(history, series, dates, { currentPrices: current });
    expect(points.at(-1)!.value.toString()).toBe(valuePortfolio(buildPortfolio(history), current).totalValue.toString());
  });

  it("sin histórico usa el precio actual y sin precio no suma", () => {
    const buys = [
      tx({ type: "buy", date: "2026-01-02", assetId: "M", quantity: "2", price: "100" }),
      tx({ type: "buy", date: "2026-01-02", assetId: "X", quantity: "1", price: "10" }),
    ];
    const points = portfolioHistory(buys, new Map(), ["2026-01-03"], { currentPrices: new Map([["M", new Decimal("120")]]) });
    expect(points[0].value.toString()).toBe("240");
  });
});

describe("periodChange", () => {
  const p = (value: string, bought: string, proceeds: string): HistoryPoint => ({
    date: "",
    value: new Decimal(value),
    invested: new Decimal(0),
    bought: new Decimal(bought),
    proceeds: new Decimal(proceeds),
  });

  it("desde el inicio = no realizado + realizado sobre lo comprado", () => {
    // Del ejemplo anterior: 366 + 240 − 500 = 106 → 21,2 %.
    const change = periodChange([p("0", "0", "0"), p("366", "500", "240")])!;
    expect(change.gain.toString()).toBe("106");
    expect(change.pct!.toString()).toBe("0.212");
  });

  it("vender no cuenta como pérdida", () => {
    // Antes de vender valía 550; tras vender 4 a 60 vale 360 y se cobraron 240.
    const change = periodChange([p("550", "500", "0"), p("360", "500", "240")])!;
    expect(change.gain.toString()).toBe("50");
    expect(change.pct!.toFixed(4)).toBe("0.0909");
  });

  it("comprar no cuenta como ganancia", () => {
    const change = periodChange([p("1000", "1000", "0"), p("1600", "1500", "0")])!;
    expect(change.gain.toString()).toBe("100");
    expect(change.bought.toString()).toBe("500");
    expect(change.pct!.toFixed(6)).toBe("0.066667");
  });

  it("sin base no hay porcentaje", () => {
    expect(periodChange([p("0", "0", "0"), p("0", "0", "0")])!.pct).toBeNull();
    expect(periodChange([p("1", "1", "0")])).toBeNull();
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

describe("portfolioHistory — años pasados", () => {
  it("sin currentOnLastDay el último día usa su cierre, no el precio de hoy", () => {
    const history = [tx({ type: "buy", date: "2025-06-02", assetId: "A", quantity: "2", price: "50" })];
    const closes = new Map([["A", [{ date: "2025-12-31", close: new Decimal("60") }]]]);
    const current = new Map([["A", new Decimal("100")]]);
    const [p] = portfolioHistory(history, closes, ["2025-12-31"], { currentPrices: current, currentOnLastDay: false });
    expect(p.value.toString()).toBe("120");
  });
});

describe("intradayDates", () => {
  const p = (date: string) => ({ date, close: new Decimal(1) });
  const now = new Date("2026-10-16T08:00:00Z");

  it("24 h hacia atrás uniendo las series y sin pasar de ahora", () => {
    const crypto = [p("2026-10-15T07:00:00.000Z"), p("2026-10-15T09:00:00.000Z"), p("2026-10-16T07:55:00.000Z"), p("2026-10-16T09:00:00.000Z")];
    const stock = [p("2026-10-15T09:00:00.000Z"), p("2026-10-15T15:30:00.000Z")];
    const many = Array.from({ length: 20 }, (_, i) => p(new Date(Date.parse("2026-10-15T10:00:00Z") + i * 600_000).toISOString()));
    const dates = intradayDates([crypto, stock, many], "1D", now);
    // Empieza en el último dato anterior a las 24 h (07:00) y sigue con los de dentro.
    expect(dates[0]).toBe("2026-10-15T07:00:00.000Z");
    expect(dates[1]).toBe("2026-10-15T09:00:00.000Z");
    expect(dates.at(-1)).toBe("2026-10-16T07:55:00.000Z");
    expect(dates).toContain("2026-10-15T15:30:00.000Z");
  });

  it("con la bolsa cerrada, la última sesión", () => {
    const sunday = new Date("2026-10-18T12:00:00Z");
    const friday = Array.from({ length: 30 }, (_, i) => p(new Date(Date.parse("2026-10-16T07:00:00Z") + i * 900_000).toISOString()));
    const thursday = [p("2026-10-15T15:00:00.000Z")];
    const dates = intradayDates([[...thursday, ...friday]], "1D", sunday);
    // El cierre del jueves y la sesión del viernes.
    expect(dates).toHaveLength(31);
    expect(dates[0]).toBe("2026-10-15T15:00:00.000Z");
    expect(dates.slice(1).every((d) => d.startsWith("2026-10-16"))).toBe(true);
  });

  it("submuestrea conservando el último punto", () => {
    const series = Array.from({ length: 1000 }, (_, i) => p(new Date(Date.parse("2026-10-10T00:00:00Z") + i * 300_000).toISOString()));
    const dates = intradayDates([series], "1W", new Date("2026-10-16T00:00:00Z"), 100);
    expect(dates.length).toBeLessThanOrEqual(101);
    expect(dates.at(-1)).toBe(series.at(-1)!.date);
  });
});
