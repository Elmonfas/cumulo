import Decimal from "decimal.js";
import type { PeriodKey, Transaction } from "./models";
import { applyTransaction, createPortfolioState, sortTransactions } from "./portfolio";

/**
 * Evolución de la cartera y variación por periodo (rentabilidad simple, V1).
 *
 * - Valor de un día = Σ cantidad × cierre del activo ese día (o el último
 *   cierre anterior). Sin efectivo: solo las posiciones abiertas.
 * - Sin histórico para un activo se usa su precio actual; sin ningún precio,
 *   no suma (igual que en la valoración de la cartera).
 * - El último día usa los precios actuales, así el final de la gráfica
 *   coincide con el valor de la pantalla de cartera.
 * - Invertido = coste de las posiciones abiertas ese día.
 */

export interface ClosePoint {
  date: string;
  close: Decimal;
}

export interface HistoryPoint {
  date: string;
  /** Valor de mercado de las posiciones abiertas. */
  value: Decimal;
  /** Coste de las posiciones abiertas. */
  invested: Decimal;
  /** Acumulado de lo pagado en compras hasta ese día. */
  bought: Decimal;
  /** Acumulado de lo cobrado en ventas hasta ese día. */
  proceeds: Decimal;
}

export interface HistoryOptions {
  /** Precio actual por activo (caché/manual); se usa el último día y como respaldo. */
  currentPrices: ReadonlyMap<string, Decimal>;
}

const day = (iso: string) => iso.slice(0, 10);

export function portfolioHistory(
  transactions: readonly Transaction[],
  closes: ReadonlyMap<string, readonly ClosePoint[]>,
  dates: readonly string[],
  { currentPrices }: HistoryOptions,
): HistoryPoint[] {
  const sorted = sortTransactions(transactions);
  const state = createPortfolioState();
  const cursors = new Map<string, number>();
  const lastClose = new Map<string, Decimal>();
  let next = 0;

  return dates.map((date, index) => {
    while (next < sorted.length && day(sorted[next].date) <= date) applyTransaction(state, sorted[next++]);

    const isLast = index === dates.length - 1;
    let value = new Decimal(0);
    let invested = new Decimal(0);

    for (const position of state.positions.values()) {
      if (position.quantity.isZero()) continue;
      invested = invested.plus(position.cost);

      const series = closes.get(position.assetId) ?? [];
      let cursor = cursors.get(position.assetId) ?? 0;
      while (cursor < series.length && series[cursor].date <= date) lastClose.set(position.assetId, series[cursor++].close);
      cursors.set(position.assetId, cursor);

      const price = (isLast && currentPrices.get(position.assetId)) || lastClose.get(position.assetId) || currentPrices.get(position.assetId);
      if (price) value = value.plus(position.quantity.times(price));
    }

    return { date, value, invested, bought: state.bought, proceeds: state.saleProceeds };
  });
}

export interface PeriodChange {
  /** Ganancia del periodo: Δ(valor + cobrado en ventas) − comprado en el periodo. */
  gain: Decimal;
  /** gain / (valor inicial + comprado en el periodo); null si no hay base. */
  pct: Decimal | null;
  /** Lo comprado en el periodo. */
  bought: Decimal;
}

/**
 * Variación de un periodo. Vender no es perder: lo cobrado cuenta como
 * resultado, y comprar no es ganar: lo comprado se descuenta.
 */
export function periodChange(points: readonly HistoryPoint[]): PeriodChange | null {
  if (points.length < 2) return null;
  const start = points[0];
  const end = points[points.length - 1];
  const bought = end.bought.minus(start.bought);
  const gain = end.value.plus(end.proceeds).minus(start.value.plus(start.proceeds)).minus(bought);
  const base = start.value.plus(bought);
  return { gain, bought, pct: base.gt(0) ? gain.div(base) : null };
}

export const addDays = (iso: string, days: number) => {
  const date = new Date(`${iso}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
};

/** Primer día del periodo (excluido "ALL", que depende de la primera operación). */
export function periodStart(period: PeriodKey, today: string, firstTransactionDate: string | null): string {
  switch (period) {
    case "1D":
      return addDays(today, -1);
    case "1W":
      return addDays(today, -7);
    case "1M":
      return addDays(today, -30);
    case "YTD":
      return addDays(`${today.slice(0, 4)}-01-01`, -1);
    case "1Y":
      return addDays(today, -365);
    case "ALL":
      return firstTransactionDate ? addDays(day(firstTransactionDate), -1) : addDays(today, -30);
  }
}

/** Fechas del periodo, de la inicial a hoy. Los periodos largos se muestrean por semanas. */
export function periodDates(period: PeriodKey, today: string, firstTransactionDate: string | null): string[] {
  const start = periodStart(period, today, firstTransactionDate);
  const total = Math.round((Date.parse(`${today}T00:00:00Z`) - Date.parse(`${start}T00:00:00Z`)) / 86_400_000);
  const step = total > 730 ? 7 : 1;
  const dates: string[] = [];
  for (let offset = 0; offset < total; offset += step) dates.push(addDays(start, offset));
  dates.push(today);
  return dates;
}
