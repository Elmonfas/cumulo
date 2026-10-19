import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { UnrecognizedFormatError } from "../types";
import { parseTradeRepublicCsv } from "./index";

const fixture = readFileSync(join(__dirname, "fixtures/exportacion-2026.csv"), "utf8");
const HEADER = fixture.split("\n")[0];

describe("parseTradeRepublicCsv (exportación real, anonimizada)", () => {
  it("lee las 3 compras y omite efectivo y traspasos internos", async () => {
    const parsed = await parseTradeRepublicCsv(fixture);
    expect(parsed.source).toBe("csv-tr");
    expect(parsed.transactions).toHaveLength(3);
    expect(parsed.skipped).toEqual([
      { line: 2, reason: "Movimiento de efectivo" },
      { line: 4, reason: "Movimiento de efectivo" },
      { line: 5, reason: "Traspaso interno de Trade Republic" },
      { line: 6, reason: "Traspaso interno de Trade Republic" },
      { line: 8, reason: "Movimiento de efectivo" },
    ]);
  });

  it("cada compra cuadra al céntimo con el efectivo de TR", async () => {
    const [btc, vwce, amzn] = (await parseTradeRepublicCsv(fixture)).transactions;

    expect(btc).toMatchObject({ type: "buy", date: "2026-10-14", quantity: "0.000665", fee: "1", tax: "0", line: 3 });
    expect(btc.asset).toEqual({ name: "Bitcoin", isin: undefined, ticker: "BTC", type: "crypto" });
    // 48,95 / 0,000665
    expect(btc.price).toBe("73609.022556391");

    expect(vwce).toMatchObject({ type: "buy", date: "2026-10-15", quantity: "0.5196", fee: "1" });
    expect(vwce.asset).toMatchObject({ isin: "IE00BK5BQT80", type: "etf" });

    // TR cobró 20,00 € aunque 0,089706 × 223 = 20,0044: manda el importe.
    expect(amzn.asset).toMatchObject({ isin: "US0231351067", type: "stock", name: "Amazon.com" });
    const cost = (t: typeof amzn) => Number(t.quantity) * Number(t.price) + Number(t.fee);
    expect(cost(amzn).toFixed(2)).toBe("21.00");
    expect(cost(vwce).toFixed(2)).toBe("89.30");
    expect(cost(btc).toFixed(2)).toBe("49.95");
  });

  it("el hash sale del transaction_id: estable al reimportar y distinto por fila", async () => {
    const a = await parseTradeRepublicCsv(fixture);
    const b = await parseTradeRepublicCsv(fixture);
    expect(a.transactions.map((t) => t.importHash)).toEqual(b.transactions.map((t) => t.importHash));
    expect(new Set(a.transactions.map((t) => t.importHash)).size).toBe(3);
  });

  it("no guarda datos de la contrapartida", async () => {
    const parsed = await parseTradeRepublicCsv(fixture);
    expect(JSON.stringify(parsed)).not.toMatch(/TITULAR|ES0000/);
  });

  it("ventas como reflejo de las compras; tipos desconocidos se omiten con su tipo", async () => {
    const csv = [
      HEADER,
      '"2026-11-02T10:00:00Z","2026-11-02","DEFAULT","TRADING","SELL","STOCK","Amazon.com","US0231351067","-0.05","230","11.50","-1.00","-0.20","EUR","","","","Sell trade","id-sell","","","",""',
      '"2026-11-03T10:00:00Z","2026-11-03","DEFAULT","DIVIDEND","DIVIDEND","STOCK","Amazon.com","US0231351067","","","0.40","","","EUR","","","","Dividend","id-div","","","",""',
    ].join("\n");
    const parsed = await parseTradeRepublicCsv(csv);
    expect(parsed.transactions).toHaveLength(1);
    expect(parsed.transactions[0]).toMatchObject({ type: "sell", quantity: "0.05", price: "230", fee: "1", tax: "0.2" });
    expect(parsed.skipped).toEqual([{ line: 3, reason: "Tipo no soportado todavía (DIVIDEND/DIVIDEND)" }]);
  });

  it("rechaza otros CSV indicando las columnas que faltan", async () => {
    await expect(parseTradeRepublicCsv("fecha;importe\n2026-01-01;3")).rejects.toThrow(UnrecognizedFormatError);
    await expect(parseTradeRepublicCsv('"date","amount"\n"2026-01-01","3"')).rejects.toThrow(/faltan las columnas/);
  });
});
