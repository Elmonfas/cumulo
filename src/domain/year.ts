import Decimal from "decimal.js";
import { addDays, periodChange, type HistoryPoint } from "./history";
import type { Transaction } from "./models";
import { buyDetail } from "./performance";
import { transactionTotal, type PortfolioState } from "./portfolio";

/**
 * "Tu año en cúmulo": resumen de un año natural, sin adornos.
 */

/** Fechas de corte: 31 dic del año anterior y el último día de cada mes (sin pasar de hoy). */
export function yearCutoffs(year: number, today: string): string[] {
  const dates = [`${year - 1}-12-31`];
  for (let month = 1; month <= 12; month++) {
    const end = new Date(Date.UTC(year, month, 0)).toISOString().slice(0, 10);
    if (end >= today) {
      if (today > dates[dates.length - 1]) dates.push(today);
      break;
    }
    dates.push(end);
  }
  return dates;
}

export interface MonthResult {
  /** 1–12 */
  month: number;
  gain: Decimal;
  pct: Decimal | null;
}

export interface YearSummary {
  year: number;
  bought: Decimal;
  buys: number;
  proceeds: Decimal;
  sells: number;
  /** Meses (1–12) con al menos una compra. */
  activeMonths: number[];
  /** Racha más larga de meses seguidos con compras. */
  longestStreak: number;
  months: MonthResult[];
  bestMonth: MonthResult | null;
  worstMonth: MonthResult | null;
  /** Variación del año (o lo que va de año). */
  change: ReturnType<typeof periodChange>;
  /** Compra del año que mejor va hoy. */
  bestBuy: { transaction: Transaction; gainPct: Decimal } | null;
  /** Ventas del año: lo que valdría hoy lo vendido frente a lo cobrado. */
  sold: { valueToday: Decimal; proceeds: Decimal; difference: Decimal } | null;
  /** Activo en el que más dinero metiste ese año. */
  topAssetId: string | null;
}

export function summarizeYear(input: {
  year: number;
  transactions: readonly Transaction[];
  /** portfolioHistory en las fechas de yearCutoffs. */
  history: readonly HistoryPoint[];
  state: PortfolioState;
  currentPrices: ReadonlyMap<string, Decimal>;
  today: string;
}): YearSummary {
  const { year, transactions, history, state, currentPrices, today } = input;
  const inYear = transactions.filter((t) => t.date.slice(0, 4) === String(year));
  const buys = inYear.filter((t) => t.type === "buy");
  const sells = inYear.filter((t) => t.type === "sell");

  const bought = buys.reduce((s, t) => s.plus(transactionTotal(t)), new Decimal(0));
  const proceeds = sells.reduce((s, t) => s.plus(transactionTotal(t)), new Decimal(0));

  const activeMonths = [...new Set(buys.map((t) => Number(t.date.slice(5, 7))))].sort((a, b) => a - b);
  let longestStreak = 0;
  let streak = 0;
  for (let m = 1; m <= 12; m++) {
    streak = activeMonths.includes(m) ? streak + 1 : 0;
    longestStreak = Math.max(longestStreak, streak);
  }

  const months: MonthResult[] = [];
  for (let i = 1; i < history.length; i++) {
    const change = periodChange([history[i - 1], history[i]]);
    if (!change) continue;
    months.push({ month: Number(history[i].date.slice(5, 7)), gain: change.gain, pct: change.pct });
  }
  const ranked = months.filter((m) => m.pct).sort((a, b) => b.pct!.comparedTo(a.pct!));

  let bestBuy: YearSummary["bestBuy"] = null;
  for (const t of buys) {
    const price = t.assetId ? currentPrices.get(t.assetId) ?? null : null;
    const d = buyDetail(state, t, price, today);
    const pct = d.gainPct ?? (price ? price.div(t.price).minus(1) : null);
    if (pct && (!bestBuy || pct.gt(bestBuy.gainPct))) bestBuy = { transaction: t, gainPct: pct };
  }

  let sold: YearSummary["sold"] = null;
  if (sells.length) {
    let valueToday = new Decimal(0);
    let soldProceeds = new Decimal(0);
    for (const t of sells) {
      const price = t.assetId ? currentPrices.get(t.assetId) : undefined;
      if (!price) continue;
      valueToday = valueToday.plus(new Decimal(t.quantity).times(price));
      soldProceeds = soldProceeds.plus(transactionTotal(t));
    }
    if (soldProceeds.gt(0)) sold = { valueToday, proceeds: soldProceeds, difference: valueToday.minus(soldProceeds) };
  }

  const byAsset = new Map<string, Decimal>();
  for (const t of buys) if (t.assetId) byAsset.set(t.assetId, (byAsset.get(t.assetId) ?? new Decimal(0)).plus(transactionTotal(t)));
  const topAssetId = [...byAsset].sort((a, b) => b[1].comparedTo(a[1]))[0]?.[0] ?? null;

  return {
    year,
    bought,
    buys: buys.length,
    proceeds,
    sells: sells.length,
    activeMonths,
    longestStreak,
    months,
    bestMonth: ranked[0] ?? null,
    worstMonth: ranked.length > 1 ? ranked[ranked.length - 1] : null,
    change: periodChange(history),
    bestBuy,
    sold,
    topAssetId,
  };
}

/** Años con operaciones, del más reciente al más antiguo. */
export function yearsWithActivity(transactions: readonly Transaction[], today: string): number[] {
  const years = new Set(transactions.filter((t) => t.type === "buy" || t.type === "sell").map((t) => Number(t.date.slice(0, 4))));
  years.add(Number(today.slice(0, 4)));
  return [...years].sort((a, b) => b - a);
}

export { addDays };
