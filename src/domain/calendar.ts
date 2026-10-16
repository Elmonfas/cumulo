import Decimal from "decimal.js";
import type { Transaction } from "./models";
import { transactionTotal } from "./portfolio";

/**
 * Calendario de operaciones: qué días compraste o vendiste y cuánto.
 *
 * - Importe de un día = lo pagado en compras (con comisiones) y lo cobrado en
 *   ventas (sin ellas), cada uno por separado.
 * - Intensidad (1–4) por cuartiles de los importes de todos los días con
 *   actividad: así un mes tranquilo no queda todo en el tono más fuerte y una
 *   compra grande destaca frente a las habituales.
 */

export interface DayActivity {
  /** YYYY-MM-DD */
  date: string;
  bought: Decimal;
  sold: Decimal;
  buys: number;
  sells: number;
  transactions: Transaction[];
}

export type Intensity = 0 | 1 | 2 | 3 | 4;

/** Compras y ventas agrupadas por día. */
export function activityByDay(transactions: readonly Transaction[]): Map<string, DayActivity> {
  const days = new Map<string, DayActivity>();
  for (const t of transactions) {
    if (t.type !== "buy" && t.type !== "sell") continue;
    const date = t.date.slice(0, 10);
    const day = days.get(date) ?? { date, bought: new Decimal(0), sold: new Decimal(0), buys: 0, sells: 0, transactions: [] };
    if (t.type === "buy") {
      day.bought = day.bought.plus(transactionTotal(t));
      day.buys++;
    } else {
      day.sold = day.sold.plus(transactionTotal(t));
      day.sells++;
    }
    day.transactions.push(t);
    days.set(date, day);
  }
  return days;
}

/** Cortes de los cuartiles (25, 50 y 75 %) de los importes > 0. */
export function intensityThresholds(amounts: readonly Decimal[]): Decimal[] {
  const sorted = amounts.filter((a) => a.gt(0)).sort((a, b) => a.comparedTo(b));
  if (sorted.length === 0) return [];
  const at = (q: number) => sorted[Math.min(sorted.length - 1, Math.floor(q * sorted.length))];
  return [at(0.25), at(0.5), at(0.75)];
}

/** Nivel 1–4 de un importe según los cortes; 0 sin importe. */
export function intensity(amount: Decimal, thresholds: readonly Decimal[]): Intensity {
  if (!amount.gt(0)) return 0;
  if (thresholds.length === 0) return 4;
  // Todos los días iguales: tono medio, no el más claro.
  if (thresholds[0].eq(thresholds[thresholds.length - 1])) return amount.gte(thresholds[0]) ? 3 : 1;
  const above = thresholds.filter((t) => amount.gt(t)).length;
  return (1 + above) as Intensity;
}

/** Semanas de un mes (lunes a domingo) con huecos `null` antes del día 1 y tras el último. */
export function monthGrid(year: number, month: number): (string | null)[][] {
  const days = new Date(Date.UTC(year, month, 0)).getUTCDate();
  const firstWeekday = (new Date(Date.UTC(year, month - 1, 1)).getUTCDay() + 6) % 7;
  const cells: (string | null)[] = Array.from({ length: firstWeekday }, () => null);
  for (let d = 1; d <= days; d++) cells.push(`${year}-${String(month).padStart(2, "0")}-${String(d).padStart(2, "0")}`);
  while (cells.length % 7 !== 0) cells.push(null);
  const weeks: (string | null)[][] = [];
  for (let i = 0; i < cells.length; i += 7) weeks.push(cells.slice(i, i + 7));
  return weeks;
}
