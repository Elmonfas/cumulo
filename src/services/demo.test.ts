import { describe, expect, it } from "vitest";
import { parseBackup } from "@/domain/backup";
import { buildPortfolio, checkTransactions } from "@/domain/portfolio";
import { buildDemoData } from "./demo";

describe("cartera de ejemplo", () => {
  const data = buildDemoData(new Date("2026-11-05T10:00:00Z"));

  it("es un backup válido y coherente", () => {
    expect(parseBackup(JSON.parse(JSON.stringify(data)))).toBeTruthy();
    expect(checkTransactions(data.transactions)).toBeNull();
  });

  it("aporta 150 € al mes durante dos años al ETF", () => {
    const vwce = data.transactions.filter((t) => t.assetId === "demo-vwce");
    expect(vwce).toHaveLength(24);
    expect([vwce[0].date, vwce.at(-1)!.date]).toEqual(["2024-11-05", "2026-10-05"]);
    // Primera: (150 − 1) / 118 = 1,26271… → 1,2627 participaciones.
    expect([vwce[0].quantity, vwce[0].price]).toEqual(["1.2627", "118"]);
    expect(vwce.at(-1)!.price).toBe("168");
  });

  it("deja abiertas todas las posiciones, con la venta parcial de Apple", () => {
    const positions = buildPortfolio(data.transactions).positions;
    expect(positions.get("demo-aapl")!.quantity.toString()).toBe("3");
    expect(positions.get("demo-btc")!.quantity.toString()).toBe("0.015");
    expect([...positions.values()].filter((p) => p.quantity.gt(0))).toHaveLength(5);
  });
});
