import { describe, expect, it } from "vitest";
import { normalizeAssetName, suggestQuickReplacements, type QuickEntry } from "./quick-replace";

const quick = (transactionId: string, asset: QuickEntry["asset"]): QuickEntry => ({ transactionId, asset });

describe("altas rápidas que sustituye un historial importado", () => {
  it("normaliza nombres de fondos", () => {
    expect(normalizeAssetName("Vanguard FTSE All-World UCITS ETF USD Acc")).toBe("vanguard ftse all world");
    expect(normalizeAssetName("Vanguard FTSE All-World U.ETF R")).toBe("vanguard ftse all world");
    expect(normalizeAssetName("Amazon.com, Inc.")).toBe("amazon com");
  });

  it("propone las del mismo ISIN, el mismo ticker cripto o el mismo nombre", () => {
    const entries = [
      quick("isin", { name: "Apple", isin: "us0378331005" }),
      quick("btc", { name: "Bitcoin", ticker: "BTC", type: "crypto" }),
      quick("nombre", { name: "Vanguard FTSE All-World UCITS ETF USD Acc", ticker: "VWCE.DE", type: "etf" }),
      quick("otro-broker", { name: "Fidelity MSCI World Index Fund", type: "etf" }),
    ];
    const file = [
      { name: "Apple Inc.", isin: "US0378331005", type: "stock" },
      { name: "Bitcoin", ticker: "btc", type: "crypto" },
      { name: "Vanguard FTSE All-World U.ETF R", isin: "IE00BK5BQT80", type: "etf" },
    ];
    expect([...suggestQuickReplacements(entries, file)].sort()).toEqual(["btc", "isin", "nombre"]);
  });

  it("no confunde activos distintos", () => {
    const entries = [
      quick("isin-distinto", { name: "Apple", isin: "US0378331005" }),
      quick("high-div", { name: "Vanguard FTSE All-World High Dividend Yield UCITS ETF" }),
      quick("eth", { name: "Ethereum", ticker: "ETH", type: "crypto" }),
    ];
    const file = [
      { name: "Apple", isin: "US5949181045" },
      { name: "Vanguard FTSE All-World U.ETF R" },
      { name: "Bitcoin", ticker: "BTC", type: "crypto" },
    ];
    expect(suggestQuickReplacements(entries, file).size).toBe(0);
  });
});
