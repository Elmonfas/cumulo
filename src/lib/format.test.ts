import Decimal from "decimal.js";
import { describe, expect, it } from "vitest";
import { formatAxisDate, formatAxisPercent, formatCompactCurrency, formatCurrency, formatDate, formatNumber, formatPercent, isLongRange } from "./format";

// Los símbolos van tras un espacio duro (U+00A0).
const nb = (s: string) => s.replace(/ /g, " ");

describe("formatCurrency", () => {
  it.each([
    ["1234.56", "1.234,56 €"],
    ["0", "0,00 €"],
    ["5", "5,00 €"],
    ["999.999", "1.000,00 €"],
    ["1234567.891", "1.234.567,89 €"],
    ["-1234.5", "-1.234,50 €"],
    ["0.005", "0,01 €"],
    ["-0.004", "0,00 €"],
  ])("%s → %s", (input, expected) => {
    expect(formatCurrency(input)).toBe(nb(expected));
  });

  it("acepta Decimal sin perder precisión", () => {
    expect(formatCurrency(new Decimal("0.1").plus("0.2"))).toBe(nb("0,30 €"));
    expect(formatCurrency(new Decimal("12345678901234567.125"))).toBe(nb("12.345.678.901.234.567,13 €"));
  });

  it("añade el signo + cuando se pide", () => {
    expect(formatCurrency("12.3", { signed: true })).toBe(nb("+12,30 €"));
    expect(formatCurrency("-12.3", { signed: true })).toBe(nb("-12,30 €"));
    expect(formatCurrency("0", { signed: true })).toBe(nb("0,00 €"));
  });
});

describe("formatCompactCurrency", () => {
  it.each([
    ["0", "0 €"],
    ["850.4", "850 €"],
    ["1500", "1,5 mil €"],
    ["2000", "2 mil €"],
    ["12499", "12 mil €"],
    ["999999", "1 M€"],
    ["1234567", "1,2 M€"],
    ["3000000", "3 M€"],
    ["-2500", "-2,5 mil €"],
  ])("%s → %s", (input, expected) => {
    expect(formatCompactCurrency(input)).toBe(nb(expected));
  });
});

describe("formatPercent", () => {
  it.each([
    ["0.032", "+3,2 %"],
    ["-0.024", "-2,4 %"],
    ["0", "0,0 %"],
    ["12.3456", "+1.234,6 %"],
    ["0.00049", "0,0 %"],
  ])("%s → %s", (input, expected) => {
    expect(formatPercent(input)).toBe(nb(expected));
  });

  it("admite decimales y sin signo", () => {
    expect(formatPercent("0.07", { decimals: 2, signed: false })).toBe(nb("7,00 %"));
  });
});

describe("formatNumber", () => {
  it("sin decimales no deja coma", () => {
    expect(formatNumber("1234.5", 0)).toBe("1.235");
    expect(formatNumber("0.12345678", 8)).toBe("0,12345678");
  });
});

describe("formatDate", () => {
  it.each([
    ["2026-10-15", "15 oct 2026"],
    ["2026-01-01", "1 ene 2026"],
    ["2026-09-30", "30 sept 2026"],
    ["2026-12-31", "31 dic 2026"],
  ])("%s → %s", (input, expected) => {
    expect(formatDate(input)).toBe(expected);
  });

  it("formatea fechas con hora en la zona local", () => {
    expect(formatDate(new Date(2026, 4, 7, 23, 59))).toBe("7 may 2026");
  });

  it("rechaza fechas no válidas", () => {
    expect(() => formatDate("no-es-fecha")).toThrow(RangeError);
  });
});

describe("modo privado", () => {
  it("oculta euros y cantidades pero no porcentajes, salvo con reveal", async () => {
    const { setAmountsHidden, formatQuantity } = await import("./format");
    setAmountsHidden(true);
    try {
      expect(formatCurrency("1234.5")).toBe(nb("••• €"));
      expect(formatCurrency("1234.5", { reveal: true })).toBe(nb("1.234,50 €"));
      expect(formatCompactCurrency("12000")).toBe("•••");
      expect(formatQuantity("0.0215")).toBe("•••");
      expect(formatPercent("0.032")).toBe(nb("+3,2 %"));
    } finally {
      setAmountsHidden(false);
    }
    expect(formatQuantity("0.0215")).toBe("0,0215");
    expect(formatQuantity("12")).toBe("12");
  });
});

describe("ejes de gráficas", () => {
  it("porcentaje con signo menos tipográfico y espacio fino", () => {
    expect(formatAxisPercent(25)).toBe("25 %");
    expect(formatAxisPercent(-7.4)).toBe("−7 %");
    expect(formatAxisPercent(-0.2)).toBe("0 %");
  });

  it("fechas con año solo cuando hace falta", () => {
    expect(formatAxisDate("2026-01-22", false)).toBe("22 ene");
    expect(formatAxisDate("2026-09-03", true)).toBe("sept 26");
    expect(isLongRange("2026-01-01", "2026-10-16")).toBe(false);
    expect(isLongRange("2025-11-03", "2026-10-16")).toBe(true);
    expect(isLongRange("2025-12-20", "2026-01-15")).toBe(false);
    expect(isLongRange("2024-01-01", "2025-06-01")).toBe(true);
  });
});
