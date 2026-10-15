import Decimal from "decimal.js";
import type { ClosePoint } from "./history";
import type { Transaction } from "./models";

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
