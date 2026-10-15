import Decimal from "decimal.js";
import { describe, expect, it } from "vitest";
import { annualize, daysBetween, xirr } from "./returns";

const flow = (date: string, amount: string) => ({ date, amount: new Decimal(amount) });

describe("annualize", () => {
  it("un 21 % en dos años es un 10 % anual", () => {
    expect(annualize(new Decimal("0.21"), 730)!.toFixed(6)).toBe("0.100000");
  });

  it("un año exacto no cambia", () => {
    expect(annualize(new Decimal("0.07"), 365)!.toString()).toBe("0.07");
  });

  it("no anualiza por debajo de un año", () => {
    expect(annualize(new Decimal("0.05"), 14)).toBeNull();
    expect(annualize(new Decimal("0.05"), 364)).toBeNull();
  });

  it("pérdida total no se anualiza", () => {
    expect(annualize(new Decimal("-1"), 800)).toBeNull();
  });
});

describe("xirr", () => {
  it("cuadra con el ejemplo de la documentación de XIRR de Excel (37,34 %)", () => {
    const rate = xirr([
      flow("2008-01-01", "-10000"),
      flow("2008-03-01", "2750"),
      flow("2008-10-30", "4250"),
      flow("2009-02-15", "3250"),
      flow("2009-04-01", "2750"),
    ]);
    // Excel muestra 0,373362535 (su tolerancia es de 1e-8); coincidimos a 8 decimales.
    expect(rate!.toFixed(8)).toBe("0.37336253");
  });

  it("compra y valor actual a dos años", () => {
    // −1.000 y +1.210 a 730 días → 10 % anual.
    expect(xirr([flow("2024-01-01", "-1000"), flow("2025-12-31", "1210")])!.toFixed(6)).toBe("0.100000");
  });

  it("aportaciones periódicas con pérdida", () => {
    const rate = xirr([flow("2024-01-01", "-1000"), flow("2024-07-01", "-1000"), flow("2025-07-01", "1800")])!;
    expect(rate.isNegative()).toBe(true);
    // Comprobación: el valor actual neto con esa tasa es ~0.
    const npv = [
      [0, -1000],
      [daysBetween("2024-01-01", "2024-07-01"), -1000],
      [daysBetween("2024-01-01", "2025-07-01"), 1800],
    ].reduce((sum, [d, a]) => sum.plus(new Decimal(a).div(rate.plus(1).pow(new Decimal(d).div(365)))), new Decimal(0));
    expect(npv.abs().lt("0.000001")).toBe(true);
  });

  it("null con menos de un año, sin cambio de signo o con un solo flujo", () => {
    expect(xirr([flow("2026-01-01", "-1000"), flow("2026-06-01", "1100")])).toBeNull();
    expect(xirr([flow("2024-01-01", "-1000"), flow("2026-01-01", "-100")])).toBeNull();
    expect(xirr([flow("2024-01-01", "-1000")])).toBeNull();
  });
});
