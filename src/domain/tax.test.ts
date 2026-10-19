import Decimal from "decimal.js";
import { describe, expect, it } from "vitest";
import type { AssetType, Transaction } from "./models";
import { addMonths, savingsTax, taxReport, taxYears, treatyRate } from "./tax";

let n = 0;
const tx = (t: Partial<Transaction> & Pick<Transaction, "type" | "date">): Transaction => ({
  id: `t${++n}`,
  quantity: "1",
  price: "0",
  fee: "0",
  tax: "0",
  origin: "manual",
  ...t,
});
const assets: Record<string, { type: AssetType; isin?: string }> = {
  X: { type: "stock" },
  C: { type: "crypto" },
  E: { type: "etf" },
  US: { type: "stock", isin: "US0378331005" },
  CH: { type: "stock", isin: "CH0038863350" },
};
const typeOf = (id: string) => assets[id];
const s = (d: Decimal) => d.toString();

describe("savingsTax (escala del ahorro desde 2025)", () => {
  it("aplica los tramos 19/21/23/27/30 %", () => {
    expect(s(savingsTax(new Decimal(0)))).toBe("0");
    expect(s(savingsTax(new Decimal(-50)))).toBe("0");
    // 5.000 × 19 % = 950
    expect(s(savingsTax(new Decimal(5_000)))).toBe("950");
    // 6.000 × 19 % + 4.000 × 21 % = 1.140 + 840
    expect(s(savingsTax(new Decimal(10_000)))).toBe("1980");
    // 1.140 + 44.000 × 21 % (9.240) + 10.000 × 23 % (2.300)
    expect(s(savingsTax(new Decimal(60_000)))).toBe("12680");
    // 1.140 + 9.240 + 34.500 + 27.000 + 50.000 × 30 % (15.000)
    expect(s(savingsTax(new Decimal(350_000)))).toBe("86880");
  });
});

describe("addMonths", () => {
  it("ajusta al último día del mes", () => {
    expect(addMonths("2026-03-01", 2)).toBe("2026-05-01");
    expect(addMonths("2026-12-31", 2)).toBe("2027-02-28");
    expect(addMonths("2026-03-31", -1)).toBe("2026-02-28");
    expect(addMonths("2026-01-15", -2)).toBe("2025-11-15");
  });
});

describe("taxReport", () => {
  it("ganancia FIFO con lotes, dividendos y cuota estimada", () => {
    const transactions = [
      tx({ type: "buy", assetId: "X", date: "2025-01-10", quantity: "10", price: "100", fee: "1" }),
      tx({ type: "buy", assetId: "X", date: "2025-03-01", quantity: "10", price: "120", fee: "1" }),
      tx({ type: "sell", assetId: "X", date: "2026-02-01", quantity: "15", price: "130", fee: "1" }),
      tx({ type: "dividend", assetId: "X", date: "2026-06-01", price: "100", tax: "19" }),
    ];
    const r = taxReport(transactions, 2026, typeOf);
    expect(r.sales).toHaveLength(1);
    const [sale] = r.sales;
    // 15 × 130 − 1 = 1.949; coste 1.001 + 5/10 × 1.201 = 1.601,5
    expect(s(sale.proceeds)).toBe("1949");
    expect(s(sale.cost)).toBe("1601.5");
    expect(s(sale.gain)).toBe("347.5");
    expect(sale.lots.map((l) => [l.date, s(l.quantity), s(l.cost)])).toEqual([
      ["2025-01-10", "10", "1001"],
      ["2025-03-01", "5", "600.5"],
    ]);
    expect(s(r.gains)).toBe("347.5");
    expect(s(r.losses)).toBe("0");
    expect(s(r.dividendsGross)).toBe("100");
    // Sin ISIN, la retención se toma como española.
    expect(s(r.spanishWithholding)).toBe("19");
    expect(s(r.doubleTaxDeduction)).toBe("0");
    // Base 447,5 × 19 % = 85,025 → 85,03; menos 19 retenidos = 66,03
    expect(s(r.savingsBase)).toBe("447.5");
    expect(s(r.estimatedTax)).toBe("85.03");
    expect(s(r.estimatedResult)).toBe("66.03");
    expect(taxReport(transactions, 2025, typeOf).sales).toHaveLength(0);
  });

  it("regla de los dos meses: difiere la pérdida en proporción a lo recomprado", () => {
    const transactions = [
      tx({ type: "buy", assetId: "X", date: "2026-01-05", quantity: "10", price: "100" }),
      tx({ type: "sell", assetId: "X", date: "2026-03-01", quantity: "10", price: "80" }),
      tx({ type: "buy", assetId: "X", date: "2026-04-15", quantity: "4", price: "82" }),
      // Fuera de plazo: el 1 may es el último día.
      tx({ type: "buy", assetId: "X", date: "2026-05-02", quantity: "3", price: "82" }),
    ];
    const r = taxReport(transactions, 2026, typeOf);
    const [sale] = r.sales;
    expect(s(sale.gain)).toBe("-200");
    // −200 × 4/10
    expect(s(sale.deferredLoss)).toBe("-80");
    expect(sale.repurchases.map((p) => p.date)).toEqual(["2026-04-15"]);
    expect(s(r.losses)).toBe("-120");
    expect(s(r.netGains)).toBe("-120");
    expect(s(r.savingsBase)).toBe("0");
    expect(s(r.lossCarryForward)).toBe("120");
    expect(s(r.estimatedTax)).toBe("0");
  });

  it("la recompra cuenta también si fue antes de la venta, pero no los lotes vendidos", () => {
    const transactions = [
      tx({ type: "buy", assetId: "E", date: "2026-01-02", quantity: "5", price: "100" }),
      tx({ type: "buy", assetId: "E", date: "2026-02-01", quantity: "5", price: "100" }),
      tx({ type: "sell", assetId: "E", date: "2026-02-20", quantity: "5", price: "90" }),
    ];
    // Vende el lote de enero; el de febrero (dentro de los 2 meses previos) sigue en cartera.
    const [sale] = taxReport(transactions, 2026, typeOf).sales;
    expect(s(sale.deferredLoss)).toBe("-50");
  });

  it("a la cripto no se le aplica la regla", () => {
    const transactions = [
      tx({ type: "buy", assetId: "C", date: "2026-01-05", quantity: "1", price: "100" }),
      tx({ type: "sell", assetId: "C", date: "2026-03-01", quantity: "1", price: "80" }),
      tx({ type: "buy", assetId: "C", date: "2026-03-02", quantity: "1", price: "81" }),
    ];
    const r = taxReport(transactions, 2026, typeOf);
    expect(s(r.sales[0].deferredLoss)).toBe("0");
    expect(s(r.losses)).toBe("-20");
  });

  it("compensa pérdidas con dividendos hasta el 25 %", () => {
    const transactions = [
      tx({ type: "buy", assetId: "C", date: "2025-01-05", quantity: "1", price: "3000" }),
      tx({ type: "sell", assetId: "C", date: "2026-03-01", quantity: "1", price: "2000" }),
      tx({ type: "dividend", date: "2026-05-01", price: "400", tax: "76" }),
    ];
    const r = taxReport(transactions, 2026, typeOf);
    expect(s(r.netGains)).toBe("-1000");
    // Compensa 25 % de 400 = 100 → base 300 × 19 % = 57; 57 − 76 = −19
    expect(s(r.savingsBase)).toBe("300");
    expect(s(r.lossCarryForward)).toBe("900");
    expect(s(r.estimatedTax)).toBe("57");
    expect(s(r.estimatedResult)).toBe("-19");
  });

  it("taxYears lista los años con ventas o dividendos", () => {
    const transactions = [
      tx({ type: "buy", assetId: "X", date: "2024-01-05", quantity: "2", price: "10" }),
      tx({ type: "sell", assetId: "X", date: "2025-03-01", quantity: "1", price: "12" }),
      tx({ type: "dividend", date: "2026-05-01", price: "4" }),
    ];
    expect(taxYears(transactions)).toEqual([2026, 2025]);
  });
});

// Casos verificados a mano en docs/renta-verificacion.md.
describe("taxReport: intereses y doble imposición internacional", () => {
  it("caso 1: dividendos de EE. UU. con un 15 % de retención", () => {
    const r = taxReport([tx({ type: "dividend", assetId: "US", date: "2026-05-15", price: "200", tax: "30" })], 2026, typeOf);
    // Base 200 × 19 % = 38; deducción = mín(30, 15 % de 200 = 30, 19 % × 200 = 38) = 30
    expect(r.dividends[0].country).toBe("US");
    expect(s(r.savingsBase)).toBe("200");
    expect(s(r.estimatedTax)).toBe("38");
    expect(s(r.foreignWithholding)).toBe("30");
    expect(s(r.spanishWithholding)).toBe("0");
    expect(s(r.doubleTaxDeduction)).toBe("30");
    expect(s(r.unrecoverableWithholding)).toBe("0");
    expect(s(r.estimatedResult)).toBe("8");
  });

  it("caso 2: intereses con retención española y pérdidas que se compensan al 25 %", () => {
    const r = taxReport(
      [
        tx({ type: "buy", assetId: "C", date: "2025-02-01", quantity: "1", price: "3000" }),
        tx({ type: "sell", assetId: "C", date: "2026-03-01", quantity: "1", price: "2000" }),
        tx({ type: "interest", date: "2026-06-30", price: "1000", tax: "190" }),
      ],
      2026,
      typeOf,
    );
    // RCM 1.000; pérdidas −1.000 compensan el 25 % de 1.000 = 250 → base 750
    expect(s(r.interestGross)).toBe("1000");
    expect(s(r.netGains)).toBe("-1000");
    expect(s(r.savingsBase)).toBe("750");
    expect(s(r.lossCarryForward)).toBe("750");
    // 750 × 19 % = 142,50; menos 190 retenidos en España = −47,50 (a devolver)
    expect(s(r.estimatedTax)).toBe("142.5");
    expect(s(r.spanishWithholding)).toBe("190");
    expect(s(r.doubleTaxDeduction)).toBe("0");
    expect(s(r.estimatedResult)).toBe("-47.5");
  });

  it("caso 3: retención por encima del límite del convenio (Suiza, 35 %)", () => {
    const r = taxReport([tx({ type: "dividend", assetId: "CH", date: "2026-04-20", price: "100", tax: "35" })], 2026, typeOf);
    expect(s(treatyRate("CH"))).toBe("0.15");
    // Cuota 19; deducción = mín(35 limitado a 15, 19 % × 100 = 19) = 15; no recuperable 35 − 15 = 20
    expect(s(r.estimatedTax)).toBe("19");
    expect(s(r.doubleTaxDeduction)).toBe("15");
    expect(s(r.unrecoverableWithholding)).toBe("20");
    expect(s(r.estimatedResult)).toBe("4");
  });

  it("caso 4: con pérdidas, la deducción la limita el tipo medio sobre lo que queda en la base", () => {
    const r = taxReport(
      [
        tx({ type: "buy", assetId: "C", date: "2025-02-01", quantity: "1", price: "3000" }),
        tx({ type: "sell", assetId: "C", date: "2026-03-01", quantity: "1", price: "1000" }),
        tx({ type: "dividend", assetId: "US", date: "2026-05-15", price: "1000", tax: "150" }),
      ],
      2026,
      typeOf,
    );
    // Pérdidas −2.000 compensan 250 → base 750; cuota 142,50; tipo medio 19 %
    // Deducción = mín(150, 19 % × mín(1.000, 750) = 142,50) = 142,50; no recuperable 7,50
    expect(s(r.savingsBase)).toBe("750");
    expect(s(r.averageRate)).toBe("0.19");
    expect(s(r.doubleTaxDeduction)).toBe("142.5");
    expect(s(r.unrecoverableWithholding)).toBe("7.5");
    expect(s(r.estimatedResult)).toBe("0");
  });

  it("el país de la retención guardado manda sobre el del ISIN", () => {
    const r = taxReport([tx({ type: "dividend", assetId: "US", date: "2026-05-15", price: "100", tax: "19", withholdingCountry: "ES" })], 2026, typeOf);
    expect(s(r.spanishWithholding)).toBe("19");
    expect(s(r.foreignWithholding)).toBe("0");
  });
});
