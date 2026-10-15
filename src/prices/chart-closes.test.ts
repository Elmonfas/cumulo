import { describe, expect, it } from "vitest";
import { closesFromChart } from "./chart-closes";

const bar = (date: string, close: number | null) => ({ date: new Date(`${date}T07:00:00Z`), close });

describe("closesFromChart", () => {
  it("completa la última sesión sin cierre con el último precio de mercado", () => {
    const points = closesFromChart({
      meta: { regularMarketPrice: 170.94, regularMarketTime: new Date("2026-10-15T15:35:52Z") },
      quotes: [bar("2026-10-14", 172.48), bar("2026-10-15", null)],
    });
    expect(points.map((p) => [p.date, p.close.toString()])).toEqual([
      ["2026-10-14", "172.48"],
      ["2026-10-15", "170.94"],
    ]);
  });

  it("no duplica un día que ya tiene cierre y acepta la hora en segundos", () => {
    const points = closesFromChart({
      meta: { regularMarketPrice: 99, regularMarketTime: Date.parse("2026-10-15T15:35:52Z") / 1000 },
      quotes: [bar("2026-10-15", 100)],
    });
    expect(points.map((p) => [p.date, p.close.toString()])).toEqual([["2026-10-15", "100"]]);
  });

  it("sin precio de mercado deja la serie como viene", () => {
    expect(closesFromChart({ meta: {}, quotes: [bar("2026-10-14", 1), bar("2026-10-15", null)] })).toHaveLength(1);
  });
});
