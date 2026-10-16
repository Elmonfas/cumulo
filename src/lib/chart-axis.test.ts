import { afterEach, describe, expect, it } from "vitest";
import { currencyAxisFormatter, formatPointDate, niceScale, timeAxisTicks } from "./chart-axis";
import { MASK } from "./format";

const NBSP = " ";
const strip = (s: string) => s.replaceAll(NBSP, " ");

describe("currencyAxisFormatter", () => {
  it("no repite etiquetas en rangos estrechos de miles (BTC en una semana)", () => {
    const f = currencyAxisFormatter([71_000, 75_500]);
    const labels = [71_000, 72_000, 73_000, 73_500, 74_000, 74_500, 75_000].map((v) => strip(f(v)));
    expect(labels).toEqual(["71 mil €", "72 mil €", "73 mil €", "73,5 mil €", "74 mil €", "74,5 mil €", "75 mil €"]);
    expect(new Set(labels).size).toBe(labels.length);
  });

  it("usa decimales cuando el rango es de céntimos", () => {
    const f = currencyAxisFormatter([201.1, 201.9]);
    expect(strip(f(201.2))).toBe("201,2 €");
    expect(strip(f(201.25))).toBe("201,25 €");
  });

  it("millones y modo privado", () => {
    expect(strip(currencyAxisFormatter([1_000_000, 2_000_000])(1_500_000))).toBe("1,5 M€");
    expect(currencyAxisFormatter([1, 2], { hidden: true })(1)).toBe(MASK);
  });

  it("cifras medianas con separador de miles", () => {
    const f = currencyAxisFormatter([6_000, 7_600]);
    expect(strip(f(7_200))).toBe("7.200 €");
  });
});

describe("timeAxisTicks", () => {
  const original = process.env.TZ;
  afterEach(() => {
    process.env.TZ = original;
  });

  it("series diarias: sin marcas fijas", () => {
    expect(timeAxisTicks(["2026-10-01", "2026-10-02"])).toBeUndefined();
  });

  it("un día cada 5 min: horas redondas, como mucho 5", () => {
    const start = Date.parse("2026-10-15T07:00:00Z");
    const dates = Array.from({ length: 288 }, (_, i) => new Date(start + i * 300_000).toISOString());
    const ticks = timeAxisTicks(dates)!;
    expect(ticks.length).toBeGreaterThan(2);
    expect(ticks.length).toBeLessThanOrEqual(5);
    for (const t of ticks) expect(new Date(t).getMinutes()).toBe(0);
  });

  it("una semana horaria: primer punto de cada día", () => {
    const start = Date.parse("2026-10-09T12:00:00Z");
    const dates = Array.from({ length: 7 * 24 }, (_, i) => new Date(start + i * 3_600_000).toISOString());
    const ticks = timeAxisTicks(dates, 7)!;
    expect(ticks).toHaveLength(7);
    expect(new Set(ticks.map((t) => new Date(t).getDate())).size).toBe(7);
  });
});

describe("formatPointDate", () => {
  it("añade la hora solo si la hay", () => {
    expect(formatPointDate("2026-10-15")).toBe("15 oct 2026");
    expect(formatPointDate("2026-10-15T12:00:00.000Z")).toMatch(/^1[56] oct 2026, \d{2}:\d{2}$/);
  });
});

describe("niceScale", () => {
  it("BTC en una semana: pasos de 1.000 y extremos que envuelven los datos", () => {
    const { domain, ticks } = niceScale([71_400, 75_600]);
    expect(ticks).toEqual([71_000, 72_000, 73_000, 74_000, 75_000, 76_000]);
    expect(domain).toEqual([71_000, 76_000]);
  });

  it("pasos de 2,5 y decimales sin ruido de coma flotante", () => {
    expect(niceScale([0.1, 0.9]).ticks).toEqual([0, 0.2, 0.4, 0.6, 0.8, 1]);
    expect(niceScale([201.1, 201.9]).ticks).toEqual([201, 201.2, 201.4, 201.6, 201.8, 202]);
    expect(niceScale([6_100, 7_550]).ticks).toEqual([6_000, 6_500, 7_000, 7_500, 8_000]);
  });

  it("serie plana", () => {
    const { ticks } = niceScale([100, 100]);
    expect(ticks[0]).toBeLessThan(100);
    expect(ticks.at(-1)).toBeGreaterThan(100);
  });
});
