import Decimal from "decimal.js";
import { describe, expect, it } from "vitest";
import { benchmarkHistory, cumulativeReturn } from "./benchmark";
import type { Transaction } from "./models";

const c = (date: string, close: string) => ({ date, close: new Decimal(close) });
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

describe("benchmarkHistory", () => {
  // Índice: 100 → 110 → 121. El 3 es sábado: la compra de ese día va al lunes 5.
  const index = [c("2026-01-02", "100"), c("2026-01-05", "110"), c("2026-01-06", "121")];
  const dates = ["2026-01-01", "2026-01-02", "2026-01-03", "2026-01-05", "2026-01-06"];

  it("mete cada compra en el índice al cierre de su día", () => {
    // Compra de 1.000 (999 + 1 de comisión) el 2 → 10 uds del índice.
    const points = benchmarkHistory([t("b", "buy", "2026-01-02", "1", "999", "1")], index, dates);
    expect(points.map((p) => `${p.date} ${p.value} ${p.bought}`)).toEqual([
      "2026-01-01 0 0",
      "2026-01-02 1000 1000",
      "2026-01-03 1000 1000",
      "2026-01-05 1100 1000",
      "2026-01-06 1210 1000",
    ]);
    expect(cumulativeReturn(points.at(-1)!)!.toString()).toBe("0.21");
  });

  it("una compra en fin de semana usa el siguiente cierre", () => {
    const points = benchmarkHistory([t("b", "buy", "2026-01-03", "1", "1100")], index, dates);
    // 1.100 al cierre del lunes (110) → 10 uds → 1.210 el martes.
    expect(points.at(-1)!.value.toString()).toBe("1210");
  });

  it("las ventas sacan su importe del índice", () => {
    const points = benchmarkHistory(
      [t("b", "buy", "2026-01-02", "1", "1000"), t("s", "sell", "2026-01-05", "1", "550")],
      index,
      dates,
    );
    // Se venden 550 / 110 = 5 uds; quedan 5 → 605 el martes. Cobrado 550.
    const last = points.at(-1)!;
    expect([last.value.toString(), last.proceeds.toString()]).toEqual(["605", "550"]);
    expect(cumulativeReturn(last)!.toString()).toBe("0.155");
  });

  it("no se puede sacar más de lo que vale el índice", () => {
    const points = benchmarkHistory(
      [t("b", "buy", "2026-01-02", "1", "100"), t("s", "sell", "2026-01-05", "1", "500")],
      index,
      dates,
    );
    expect(points.at(-1)!.value.isZero()).toBe(true);
    expect(points.at(-1)!.proceeds.toString()).toBe("110");
  });

  it("el último día usa el precio actual si se da", () => {
    const points = benchmarkHistory([t("b", "buy", "2026-01-02", "1", "1000")], index, dates, new Decimal("130"));
    expect(points.at(-1)!.value.toString()).toBe("1300");
  });

  it("sin compras no hay rentabilidad", () => {
    expect(cumulativeReturn(benchmarkHistory([], index, dates)[0])).toBeNull();
    expect(benchmarkHistory([], [], dates)).toEqual([]);
  });
});
