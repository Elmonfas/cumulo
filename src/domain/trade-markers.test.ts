import Decimal from "decimal.js";
import { describe, expect, it } from "vitest";
import type { Transaction } from "./models";
import { priceSeriesWithTrades } from "./trade-markers";

const close = (date: string, value: string) => ({ date, close: new Decimal(value) });
const trade = (id: string, type: Transaction["type"], date: string, quantity: string, price: string): Transaction => ({
  id,
  type,
  date,
  assetId: "A",
  quantity,
  price,
  fee: "0",
  tax: "0",
  origin: "manual",
});

describe("priceSeriesWithTrades", () => {
  // Viernes 2, lunes 5 y martes 6 de octubre.
  const closes = [close("2026-10-05", "102"), close("2026-10-02", "100"), close("2026-10-06", "104")];

  it("ordena la serie y coloca cada operación en su día con su precio", () => {
    const { points, markers } = priceSeriesWithTrades(closes, [
      trade("b1", "buy", "2026-10-02", "10", "99.5"),
      trade("s1", "sell", "2026-10-06T14:30:00Z", "4", "104.2"),
    ]);
    expect(points.map((p) => p.date)).toEqual(["2026-10-02", "2026-10-05", "2026-10-06"]);
    expect(markers.map((m) => [m.transactionId, m.type, m.date, m.price.toString(), m.close.toString()])).toEqual([
      ["b1", "buy", "2026-10-02", "99.5", "100"],
      ["s1", "sell", "2026-10-06", "104.2", "104"],
    ]);
  });

  it("una operación en fin de semana se dibuja el siguiente día con cotización", () => {
    const { markers } = priceSeriesWithTrades(closes, [trade("b", "buy", "2026-10-03", "1", "101")]);
    expect(markers[0]).toMatchObject({ date: "2026-10-05", tradeDate: "2026-10-03" });
  });

  it("añade el precio actual como punto de hoy y ancla ahí las operaciones de hoy", () => {
    const { points, markers } = priceSeriesWithTrades(closes, [trade("b", "buy", "2026-10-07", "1", "105")], {
      date: "2026-10-07",
      price: new Decimal("105.5"),
    });
    expect(points.at(-1)).toEqual(close("2026-10-07", "105.5"));
    expect(markers[0].date).toBe("2026-10-07");
  });

  it("si hoy ya tiene cierre, lo sustituye por el precio actual", () => {
    const { points } = priceSeriesWithTrades(closes, [], { date: "2026-10-06", price: new Decimal("103") });
    expect(points).toHaveLength(3);
    expect(points.at(-1)!.close.toString()).toBe("103");
  });

  it("con `from` recorta la serie y omite operaciones anteriores", () => {
    const { points, markers } = priceSeriesWithTrades(
      closes,
      [trade("old", "buy", "2026-10-02", "1", "100"), trade("new", "buy", "2026-10-06", "1", "104")],
      undefined,
      "2026-10-05",
    );
    expect(points.map((p) => p.date)).toEqual(["2026-10-05", "2026-10-06"]);
    expect(markers.map((m) => m.transactionId)).toEqual(["new"]);
  });

  it("ignora operaciones que no son compra o venta y series vacías", () => {
    expect(priceSeriesWithTrades(closes, [trade("d", "dividend", "2026-10-05", "1", "3")]).markers).toEqual([]);
    expect(priceSeriesWithTrades([], [trade("b", "buy", "2026-10-05", "1", "3")])).toEqual({ points: [], markers: [] });
  });
});
