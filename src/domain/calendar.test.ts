import Decimal from "decimal.js";
import { describe, expect, it } from "vitest";
import { activityByDay, intensity, intensityThresholds, monthGrid } from "./calendar";
import type { Transaction } from "./models";

let n = 0;
const tx = (t: Partial<Transaction> & Pick<Transaction, "type" | "date">): Transaction => ({
  id: `t${++n}`,
  assetId: "A",
  quantity: "1",
  price: "0",
  fee: "0",
  tax: "0",
  origin: "manual",
  ...t,
});
const d = (v: number) => new Decimal(v);

describe("activityByDay", () => {
  it("suma compras (con comisión) y ventas (sin ella) por día e ignora el resto", () => {
    const days = activityByDay([
      tx({ type: "buy", date: "2026-10-01", quantity: "2", price: "50", fee: "1" }),
      tx({ type: "buy", date: "2026-10-01T15:00:00Z", quantity: "1", price: "20" }),
      tx({ type: "sell", date: "2026-10-01", quantity: "1", price: "30", fee: "1" }),
      tx({ type: "dividend", date: "2026-10-02", price: "5" }),
    ]);
    expect([...days.keys()]).toEqual(["2026-10-01"]);
    const day = days.get("2026-10-01")!;
    // 2 × 50 + 1 + 20 = 121; venta 30 − 1 = 29
    expect(day.bought.toString()).toBe("121");
    expect(day.sold.toString()).toBe("29");
    expect([day.buys, day.sells, day.transactions.length]).toEqual([2, 1, 3]);
  });
});

describe("intensidad", () => {
  const thresholds = intensityThresholds([d(100), d(200), d(300), d(400), d(0)]);

  it("cuartiles de los importes con actividad", () => {
    expect(thresholds.map(String)).toEqual(["200", "300", "400"]);
  });

  it("nivel 1–4 según los cortes y 0 sin importe", () => {
    expect(intensity(d(0), thresholds)).toBe(0);
    expect(intensity(d(100), thresholds)).toBe(1);
    expect(intensity(d(200), thresholds)).toBe(1);
    expect(intensity(d(250), thresholds)).toBe(2);
    expect(intensity(d(350), thresholds)).toBe(3);
    expect(intensity(d(1000), thresholds)).toBe(4);
  });

  it("con importes iguales, tono medio", () => {
    expect(intensity(d(50), intensityThresholds([d(50)]))).toBe(3);
    expect(intensity(d(50), [])).toBe(4);
  });
});

describe("monthGrid", () => {
  it("octubre de 2026 empieza en jueves y tiene 5 semanas", () => {
    const weeks = monthGrid(2026, 10);
    expect(weeks).toHaveLength(5);
    expect(weeks[0]).toEqual([null, null, null, "2026-10-01", "2026-10-02", "2026-10-03", "2026-10-04"]);
    expect(weeks[4]).toEqual(["2026-10-26", "2026-10-27", "2026-10-28", "2026-10-29", "2026-10-30", "2026-10-31", null]);
  });

  it("febrero de 2027 empieza en lunes y cabe en 4 semanas", () => {
    const weeks = monthGrid(2027, 2);
    expect(weeks).toHaveLength(4);
    expect(weeks[0][0]).toBe("2027-02-01");
    expect(weeks[3][6]).toBe("2027-02-28");
  });
});
