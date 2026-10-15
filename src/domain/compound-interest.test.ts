import Decimal from "decimal.js";
import { describe, expect, it } from "vitest";
import { calculateCompoundInterest, monthlyRateFromAnnual, type CompoundInterestInput } from "./compound-interest";

const input = (overrides: Partial<Record<keyof CompoundInterestInput, string | number>>): CompoundInterestInput => {
  const { initialCapital = "0", monthlyContribution = "0", annualRate = "0", years = 1, annualInflation } = overrides;
  return {
    initialCapital: new Decimal(initialCapital),
    monthlyContribution: new Decimal(monthlyContribution),
    annualRate: new Decimal(annualRate),
    years: Number(years),
    annualInflation: annualInflation === undefined ? undefined : new Decimal(annualInflation),
  };
};

const yearRow = (result: ReturnType<typeof calculateCompoundInterest>, year: number) => {
  const row = result.timeline[year];
  return {
    balance: row.balance.toFixed(2),
    contributed: row.contributed.toFixed(2),
    interest: row.interest.toFixed(2),
    real: row.realBalance?.toFixed(2),
  };
};

/*
 * Los casos A, B y C están comprobados al céntimo con una hoja de cálculo
 * (docs/interes-compuesto-verificacion.xlsx): tipo mensual =(1+r)^(1/12)-1,
 * interés del mes =REDONDEAR(saldo*tipo;2), aportación al final del mes y
 * valor real =REDONDEAR(saldo/(1+inflación)^año;2).
 */
describe("calculateCompoundInterest — casos verificados con hoja de cálculo", () => {
  it("A: 10.000 € al 7 % durante 10 años, sin aportaciones", () => {
    const result = calculateCompoundInterest(input({ initialCapital: "10000", annualRate: "0.07", years: 10 }));
    expect(yearRow(result, 1)).toEqual({ balance: "10700.00", contributed: "10000.00", interest: "700.00", real: undefined });
    expect(yearRow(result, 5)).toEqual({ balance: "14025.50", contributed: "10000.00", interest: "4025.50", real: undefined });
    expect(yearRow(result, 10)).toEqual({ balance: "19671.46", contributed: "10000.00", interest: "9671.46", real: undefined });
  });

  it("B: 200 €/mes al 5 % durante 20 años con inflación del 2 %", () => {
    const result = calculateCompoundInterest(
      input({ monthlyContribution: "200", annualRate: "0.05", years: 20, annualInflation: "0.02" }),
    );
    expect(yearRow(result, 1)).toEqual({ balance: "2454.50", contributed: "2400.00", interest: "54.50", real: "2406.37" });
    expect(yearRow(result, 10)).toEqual({ balance: "30872.65", contributed: "24000.00", interest: "6872.65", real: "25326.33" });
    expect(yearRow(result, 20)).toEqual({ balance: "81160.99", contributed: "48000.00", interest: "33160.99", real: "54619.02" });
  });

  it("C: 5.000 € + 150 €/mes al 8 % durante 30 años con inflación del 2,5 %", () => {
    const result = calculateCompoundInterest(
      input({ initialCapital: "5000", monthlyContribution: "150", annualRate: "0.08", years: 30, annualInflation: "0.025" }),
    );
    expect(yearRow(result, 1)).toEqual({ balance: "7265.08", contributed: "6800.00", interest: "465.08", real: "7087.88" });
    expect(yearRow(result, 15)).toEqual({ balance: "66501.80", contributed: "32000.00", interest: "34501.80", real: "45917.20" });
    expect(yearRow(result, 30)).toEqual({ balance: "261595.78", contributed: "59000.00", interest: "202595.78", real: "124713.87" });
  });
});

describe("calculateCompoundInterest — propiedades", () => {
  it("el tipo mensual equivalente rinde exactamente el anual en 12 meses", () => {
    const result = calculateCompoundInterest(input({ initialCapital: "1000", annualRate: "0.12", years: 1 }));
    expect(result.final.balance.toFixed(2)).toBe("1120.00");
    expect(monthlyRateFromAnnual(new Decimal("0.12")).plus(1).pow(12).toDecimalPlaces(20).toString()).toBe("1.12");
  });

  it("al 0 % el saldo es la suma de lo aportado", () => {
    const result = calculateCompoundInterest(input({ initialCapital: "1000", monthlyContribution: "100", years: 3 }));
    expect(result.final.balance.toFixed(2)).toBe("4600.00");
    expect(result.final.interest.isZero()).toBe(true);
  });

  it("la fila 0 es el punto de partida y hay una fila por año", () => {
    const result = calculateCompoundInterest(input({ initialCapital: "500", monthlyContribution: "50", annualRate: "0.05", years: 4 }));
    expect(result.timeline).toHaveLength(5);
    expect(yearRow(result, 0)).toEqual({ balance: "500.00", contributed: "500.00", interest: "0.00", real: undefined });
    expect(result.final).toBe(result.timeline[4]);
  });

  it("con inflación 0 el valor real coincide con el nominal", () => {
    const result = calculateCompoundInterest(
      input({ initialCapital: "1000", annualRate: "0.06", years: 5, annualInflation: "0" }),
    );
    expect(result.final.realBalance?.toFixed(2)).toBe(result.final.balance.toFixed(2));
  });

  it("acepta rentabilidades negativas (con la deriva del redondeo mensual)", () => {
    const result = calculateCompoundInterest(input({ initialCapital: "1000", annualRate: "-0.1", years: 1 }));
    // 1.000 × 0,9 = 900,00 sin redondear; al céntimo cada mes queda en 899,99 (igual que la hoja).
    expect(result.final.balance.toFixed(2)).toBe("899.99");
  });

  it("redondea las entradas al céntimo", () => {
    const result = calculateCompoundInterest(input({ initialCapital: "100.005", monthlyContribution: "0.004", years: 1 }));
    expect(result.final.balance.toFixed(2)).toBe("100.01");
  });

  it.each([
    [{ initialCapital: "-1" }, "capital"],
    [{ monthlyContribution: "-5" }, "aportación"],
    [{ annualRate: "-1" }, "rentabilidad"],
    [{ annualInflation: "-1.5" }, "inflación"],
    [{ years: 0 }, "años"],
    [{ years: 2.5 }, "años"],
    [{ years: 101 }, "años"],
  ])("rechaza entradas no válidas (%o)", (overrides, message) => {
    expect(() => calculateCompoundInterest(input(overrides))).toThrow(new RegExp(message, "i"));
  });
});
