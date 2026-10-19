import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { parseTradeRepublicCsv } from "./index";

// Integración con un archivo sintético que reproduce cada tipo documentado
// (fuentes de cada línea en fixtures/FUENTES.md y docs/trade-republic-csv.md).
const read = (name: string) => readFileSync(join(__dirname, "fixtures", name), "utf8");
const HEADER = read("sintetico-todos-los-tipos.csv").split("\n")[0];

describe("parseTradeRepublicCsv: todos los tipos documentados", () => {
  it("cada fila se importa o se omite con su motivo", async () => {
    const parsed = await parseTradeRepublicCsv(read("sintetico-todos-los-tipos.csv"));
    const imported = parsed.transactions.map((t) => [t.line, t.type, t.asset?.isin ?? t.asset?.ticker ?? null]);
    expect(imported).toEqual([
      [4, "buy", "US0378331005"],
      [5, "buy", "IE00BK5BQT80"], // plan de inversión
      [6, "buy", "IE00BK5BQT80"],
      [8, "buy", "IE00BK5BQT80"], // compra del Saveback
      [9, "buy", "IE00B8GKDB10"],
      [10, "buy", "ES0144580Y14"],
      [11, "buy", "ETH"],
      [12, "buy", "ETH"], // staking: compra a valor de mercado…
      [12, "interest", "ETH"], // …e ingreso por ese valor
      [15, "dividend", "US0378331005"],
      [16, "dividend", "IE00B8GKDB10"],
      [17, "dividend", "ES0144580Y14"],
      [20, "dividend", "US0378331005"], // el corregido
      [21, "interest", null],
      [22, "sell", "US0378331005"],
      [23, "buy", "DE0001141794"],
      [24, "interest", "DE0001141794"], // cupón
      [26, "sell", "DE0001141794"], // amortización
      [34, "buy", "LU1234567890"],
    ]);
    expect(parsed.skipped).toEqual([
      { line: 2, reason: "Movimiento de efectivo" },
      { line: 3, reason: "Movimiento de efectivo" },
      { line: 7, reason: "Saveback en efectivo (su compra llega aparte)" },
      { line: 13, reason: "Traspaso interno de Trade Republic" },
      { line: 14, reason: "Traspaso interno de Trade Republic" },
      { line: 18, reason: "Dividendo anulado por una corrección del mismo archivo" },
      { line: 19, reason: "Corrección de un dividendo del mismo archivo" },
      { line: 25, reason: "Acción corporativa informativa (el importe llega en otra fila)" },
      { line: 27, reason: "Desdoblamiento (split): no soportado todavía" },
      { line: 28, reason: "Devolución de capital: no soportada todavía" },
      { line: 29, reason: "Fiscalidad alemana (no aplica en España)" },
      { line: 30, reason: "Fiscalidad alemana (no aplica en España)" },
      { line: 31, reason: "Movimiento de efectivo" },
      { line: 32, reason: "Movimiento de efectivo" },
      { line: 33, reason: "Movimiento de efectivo" },
      { line: 35, reason: "Cuenta junior (es de otra persona)" },
      { line: 36, reason: "Tipo no soportado todavía (CASH/STOCKPERK)" },
    ]);
    expect(parsed.problems).toEqual([]);
    expect(parsed.corrections).toEqual([]);
  });

  it("signos e importes: compra, venta, dividendo, interés, staking y amortización", async () => {
    const t = (await parseTradeRepublicCsv(read("sintetico-todos-los-tipos.csv"))).transactions;
    const at = (line: number, type: string) => t.find((x) => x.line === line && x.type === type)!;
    // Compra: 1.500 € + 1 € de comisión.
    expect(at(4, "buy")).toMatchObject({ quantity: "10", price: "150", fee: "1", tax: "0", date: "2025-01-07" });
    // Plan sin comisión.
    expect(at(5, "buy")).toMatchObject({ quantity: "0.5812", fee: "0" });
    // Venta: shares negativo en el archivo, cantidad positiva aquí.
    expect(at(22, "sell")).toMatchObject({ quantity: "4", price: "180", fee: "1" });
    // Dividendo: bruto 2,40, retención 0,36, retenido en EE. UU.
    expect(at(15, "dividend")).toMatchObject({ quantity: "1", price: "2.4", tax: "0.36", withholdingCountry: "US" });
    expect(at(17, "dividend")).toMatchObject({ price: "11", tax: "2.09", withholdingCountry: "ES" });
    expect(at(16, "dividend")).toMatchObject({ price: "5.4", tax: "0", withholdingCountry: "IE" });
    // Intereses de la cuenta: retención española; cupón: país del bono.
    expect(at(21, "interest")).toMatchObject({ price: "3.1", tax: "0.59", withholdingCountry: "ES" });
    expect(at(24, "interest")).toMatchObject({ price: "0.28", tax: "0.07", withholdingCountry: "DE" });
    // Staking: 0,0005 × 2.800 = 1,40 € de coste y de renta.
    expect(at(12, "buy")).toMatchObject({ quantity: "0.0005", price: "2800", fee: "0" });
    expect(at(12, "interest")).toMatchObject({ price: "1.4", tax: "0" });
    // Amortización: las 20 participaciones salen por los 20 € cobrados.
    expect(at(26, "sell")).toMatchObject({ quantity: "20", price: "1" });
    // El hash sale del transaction_id y es único por fila (el staking lleva dos).
    expect(new Set(t.map((x) => x.importHash)).size).toBe(t.length);
  });

  it("acepta la variante con ';', sin comillas y con value_date", async () => {
    const parsed = await parseTradeRepublicCsv(read("sintetico-separador-punto-y-coma.csv"));
    expect(parsed.transactions.map((t) => [t.type, t.quantity])).toEqual([["buy", "10"], ["buy", "0.5812"]]);
  });

  it("un traspaso interno sin su pareja impide importar", async () => {
    const csv = [
      HEADER,
      '"2025-05-01T01:00:00.000Z","2025-05-01","DEFAULT","DELIVERY","MIGRATION","CRYPTO","Ethereum","ETH","-0.2005000000","2600","","","","EUR","","","","MIGRATION ETH","id-1","","","",""',
    ].join("\n");
    const parsed = await parseTradeRepublicCsv(csv);
    expect(parsed.problems).toEqual([{ line: 2, reason: "Traspaso interno de Trade Republic sin su pareja: revisa el archivo." }]);
  });

  it("una corrección sin su dividendo en el archivo queda pendiente para lo ya importado", async () => {
    const csv = [
      HEADER,
      '"2025-08-16T12:00:00.000Z","2025-08-16","DEFAULT","CASH","DIVIDEND","STOCK","Apple","US0378331005","10","","-2.500000","","0.38","EUR","","","","Cash Dividend corrected","id-c","","","",""',
    ].join("\n");
    const parsed = await parseTradeRepublicCsv(csv);
    expect(parsed.transactions).toEqual([]);
    expect(parsed.corrections).toEqual([
      { line: 2, asset: { name: "Apple", isin: "US0378331005", ticker: undefined, type: "stock" }, gross: "2.5", tax: "0.38" },
    ]);
  });
});
