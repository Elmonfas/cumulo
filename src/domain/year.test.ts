import Decimal from "decimal.js";
import { describe, expect, it } from "vitest";
import { portfolioHistory } from "./history";
import type { Transaction } from "./models";
import { buildPortfolio } from "./portfolio";
import { summarizeYear, yearCutoffs, yearsWithActivity } from "./year";

const t = (id: string, type: "buy" | "sell", date: string, quantity: string, price: string, assetId = "A"): Transaction => ({
  id,
  type,
  date,
  assetId,
  quantity,
  price,
  fee: "0",
  tax: "0",
  origin: "manual",
});
const c = (date: string, close: string) => ({ date, close: new Decimal(close) });

describe("yearCutoffs", () => {
  it("fin de cada mes desde el 31 de diciembre anterior hasta hoy", () => {
    expect(yearCutoffs(2026, "2026-04-15")).toEqual(["2025-12-31", "2026-01-31", "2026-02-28", "2026-03-31", "2026-04-15"]);
    expect(yearCutoffs(2025, "2026-04-15")).toHaveLength(13);
  });
});

describe("summarizeYear", () => {
  const transactions = [
    t("b1", "buy", "2026-01-10", "10", "100"),
    t("b2", "buy", "2026-02-10", "10", "100"),
    t("b3", "buy", "2026-04-10", "5", "80", "B"),
    t("s1", "sell", "2026-03-15", "5", "120"),
    t("old", "buy", "2025-06-01", "1", "50", "B"),
  ];
  // A: 100 en ene, 110 fin feb, 120 fin mar; hoy 150. B: 80 en abr; hoy 100.
  const closes = new Map([
    ["A", [c("2025-12-31", "100"), c("2026-01-31", "100"), c("2026-02-28", "110"), c("2026-03-31", "120")]],
    ["B", [c("2025-06-01", "50"), c("2025-12-31", "60"), c("2026-03-31", "80")]],
  ]);
  const prices = new Map([
    ["A", new Decimal("150")],
    ["B", new Decimal("100")],
  ]);
  const today = "2026-04-15";
  const history = portfolioHistory(transactions, closes, yearCutoffs(2026, today), { currentPrices: prices });
  const s = summarizeYear({ year: 2026, transactions, history, state: buildPortfolio(transactions), currentPrices: prices, today });

  it("cuenta lo aportado, lo cobrado y los meses aportando", () => {
    expect([s.bought.toString(), s.buys, s.proceeds.toString(), s.sells]).toEqual(["2400", 3, "600", 1]);
    expect(s.activeMonths).toEqual([1, 2, 4]);
    expect(s.longestStreak).toBe(2);
  });

  it("rentabilidad de cada mes y del año", () => {
    // Febrero: de 1.060 (10 × 100 de A + 1 × 60 de B) a 2.260 (20 × 110 + 60) comprando 1.000
    // → +200 sobre una base de 1.060 + 1.000 = 2.060 → 9,71 %.
    const feb = s.months.find((m) => m.month === 2)!;
    expect(feb.gain.toString()).toBe("200");
    expect(feb.pct!.toFixed(4)).toBe("0.0971");
    expect(s.bestMonth!.month).toBe(4);
    expect(s.worstMonth!.month).toBe(1);
    expect(s.change!.pct!.isPositive()).toBe(true);
  });

  it("mejor compra, ventas y activo principal", () => {
    // b1 y b2 a 100 → hoy 150 (b1 vendida a medias por FIFO). b3 a 80 → 100.
    expect(s.bestBuy!.gainPct.toString()).toBe("0.5");
    // Vendí 5 a 120 (600); hoy valdrían 5 × 150 = 750.
    expect(s.sold).toMatchObject({ difference: new Decimal(150) });
    expect(s.topAssetId).toBe("A");
  });

  it("años con actividad", () => {
    expect(yearsWithActivity(transactions, today)).toEqual([2026, 2025]);
  });
});
