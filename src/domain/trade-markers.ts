import Decimal from "decimal.js";
import type { ClosePoint } from "./history";
import type { Transaction } from "./models";
import { applyTransaction, createPortfolioState, sortTransactions } from "./portfolio";

export interface TradeMarker {
  transactionId: string;
  type: "buy" | "sell";
  /** Día de la serie en el que se dibuja (el de la operación o el siguiente con cotización). */
  date: string;
  tradeDate: string;
  quantity: Decimal;
  /** Precio al que se operó. */
  price: Decimal;
  /** Cierre del día en que se dibuja: el punto va sobre la curva. */
  close: Decimal;
}

const day = (iso: string) => iso.slice(0, 10);

/**
 * Serie de precios de un activo con sus compras y ventas encima. Si se pasa
 * el precio actual, se añade (o sustituye) el punto de hoy. Con `from`, la
 * serie empieza ese día y se omiten las operaciones anteriores.
 */
export function priceSeriesWithTrades(
  closes: readonly ClosePoint[],
  transactions: readonly Transaction[],
  current?: { date: string; price: Decimal },
  from?: string,
): { points: ClosePoint[]; markers: TradeMarker[] } {
  const points = [...closes]
    .filter((p) => !from || p.date >= from)
    .sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));
  if (current) {
    if (points.at(-1)?.date === current.date) points[points.length - 1] = { date: current.date, close: current.price };
    else if (!points.length || points.at(-1)!.date < current.date) points.push({ date: current.date, close: current.price });
  }

  const markers: TradeMarker[] = [];
  if (points.length === 0) return { points, markers };
  for (const t of transactions) {
    if (t.type !== "buy" && t.type !== "sell") continue;
    const tradeDate = day(t.date);
    if (from && tradeDate < from) continue;
    const snapped = points.find((p) => p.date >= tradeDate) ?? points[points.length - 1];
    markers.push({
      transactionId: t.id,
      type: t.type,
      date: snapped.date,
      tradeDate,
      quantity: new Decimal(t.quantity),
      price: new Decimal(t.price),
      close: snapped.close,
    });
  }
  return { points, markers };
}

/**
 * Precio medio de compra de la posición abierta en cada fecha (coste ÷
 * cantidad, con comisiones), o null si ese día no había posición. Así la línea
 * del precio medio sube o baja con cada compra en vez de ser la de hoy.
 */
export function averageCostSeries(transactions: readonly Transaction[], dates: readonly string[]): (Decimal | null)[] {
  const sorted = sortTransactions(transactions);
  const state = createPortfolioState();
  let next = 0;
  return dates.map((date) => {
    while (next < sorted.length && day(sorted[next].date) <= date) applyTransaction(state, sorted[next++]);
    let quantity = new Decimal(0);
    let cost = new Decimal(0);
    for (const position of state.positions.values()) {
      quantity = quantity.plus(position.quantity);
      cost = cost.plus(position.cost);
    }
    return quantity.gt(0) ? cost.div(quantity) : null;
  });
}
