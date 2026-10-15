import Decimal from "decimal.js";
import type { ClosePoint, HistoryPoint } from "./history";
import type { Transaction } from "./models";
import { sortTransactions, transactionTotal } from "./portfolio";

/**
 * "¿Le gano al índice?": la misma historia de dinero aplicada a un índice.
 *
 * - Cada compra mete su importe (comisiones incluidas) en el índice al
 *   cierre de ese día (o el siguiente con cotización).
 * - Cada venta saca su importe del índice; si el índice vale menos, solo se
 *   puede sacar lo que hay.
 * - Así ambos parten del mismo dinero y del mismo calendario: la diferencia
 *   es solo lo que has elegido comprar y vender.
 */

const day = (iso: string) => iso.slice(0, 10);

export function benchmarkHistory(
  transactions: readonly Transaction[],
  closes: readonly ClosePoint[],
  dates: readonly string[],
  currentPrice?: Decimal,
): HistoryPoint[] {
  const series = [...closes].sort((a, b) => (a.date < b.date ? -1 : 1));
  const trades = sortTransactions(transactions.filter((t) => t.type === "buy" || t.type === "sell"));
  if (series.length === 0) return [];

  /** Cierre del día de la operación o del siguiente con cotización. */
  const tradePrice = (date: string) => (series.find((p) => p.date >= date) ?? series[series.length - 1]).close;

  let units = new Decimal(0);
  let bought = new Decimal(0);
  let proceeds = new Decimal(0);
  let next = 0;
  let cursor = 0;
  let lastClose: Decimal | undefined;

  return dates.map((date, index) => {
    while (next < trades.length && day(trades[next].date) <= date) {
      const t = trades[next++];
      const price = tradePrice(day(t.date));
      const amount = transactionTotal(t);
      if (t.type === "buy") {
        units = units.plus(amount.div(price));
        bought = bought.plus(amount);
      } else {
        const sold = Decimal.min(units, amount.div(price));
        units = units.minus(sold);
        proceeds = proceeds.plus(sold.times(price));
      }
    }
    while (cursor < series.length && series[cursor].date <= date) lastClose = series[cursor++].close;
    const isLast = index === dates.length - 1;
    const price = (isLast && currentPrice) || lastClose || series[0].close;
    return { date, value: units.times(price), invested: new Decimal(0), bought, proceeds };
  });
}

/** Rentabilidad acumulada de cada punto: (valor + cobrado − comprado) / comprado. */
export function cumulativeReturn(point: HistoryPoint): Decimal | null {
  return point.bought.gt(0) ? point.value.plus(point.proceeds).minus(point.bought).div(point.bought) : null;
}

export const BENCHMARKS = [
  { id: "EUNL.DE", label: "MSCI World", name: "iShares Core MSCI World (EUNL)" },
  { id: "SXR8.DE", label: "S&P 500", name: "iShares Core S&P 500 (SXR8)" },
  { id: "VWCE.DE", label: "All-World", name: "Vanguard FTSE All-World (VWCE)" },
] as const;

export type BenchmarkId = (typeof BENCHMARKS)[number]["id"];
