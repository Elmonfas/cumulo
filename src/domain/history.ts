import Decimal from "decimal.js";
import type { PeriodKey, Transaction } from "./models";
import { applyTransaction, createPortfolioState, sortTransactions } from "./portfolio";

/**
 * Evolución del patrimonio y variación por periodo (rentabilidad simple, V1).
 *
 * - Valor de un día = Σ cantidad × cierre del activo ese día (o el último
 *   cierre anterior), más el efectivo si se registran depósitos.
 * - Sin histórico para un activo se usa su precio actual; sin ningún precio,
 *   no suma (igual que en la valoración de la cartera).
 * - El último día usa los precios actuales, así el final de la gráfica
 *   coincide con el patrimonio de la pantalla de cartera.
 * - Aportado = depósitos netos (si se registran) o coste de lo invertido.
 */

export interface ClosePoint {
  date: string;
  close: Decimal;
}

export interface HistoryPoint {
  date: string;
  value: Decimal;
  invested: Decimal;
}

export interface HistoryOptions {
  tracksCash: boolean;
  /** Precio actual por activo (caché/manual); se usa el último día y como respaldo. */
  currentPrices: ReadonlyMap<string, Decimal>;
}

const day = (iso: string) => iso.slice(0, 10);

export function portfolioHistory(
  transactions: readonly Transaction[],
  closes: ReadonlyMap<string, readonly ClosePoint[]>,
  dates: readonly string[],
  { tracksCash, currentPrices }: HistoryOptions,
): HistoryPoint[] {
  const sorted = sortTransactions(transactions);
  const state = createPortfolioState();
  const cursors = new Map<string, number>();
  const lastClose = new Map<string, Decimal>();
  let next = 0;

  return dates.map((date, index) => {
    while (next < sorted.length && day(sorted[next].date) <= date) applyTransaction(state, sorted[next++]);

    const isLast = index === dates.length - 1;
    let value = tracksCash ? state.cash : new Decimal(0);
    let openCost = new Decimal(0);

    for (const position of state.positions.values()) {
      if (position.quantity.isZero()) continue;
      openCost = openCost.plus(position.cost);

      const series = closes.get(position.assetId) ?? [];
      let cursor = cursors.get(position.assetId) ?? 0;
      while (cursor < series.length && series[cursor].date <= date) lastClose.set(position.assetId, series[cursor++].close);
      cursors.set(position.assetId, cursor);

      const price = (isLast && currentPrices.get(position.assetId)) || lastClose.get(position.assetId) || currentPrices.get(position.assetId);
      if (price) value = value.plus(position.quantity.times(price));
    }

    return { date, value, invested: tracksCash ? state.netDeposits : openCost };
  });
}

export interface PeriodChange {
  /** Variación descontando lo aportado o retirado en el periodo. */
  gain: Decimal;
  /** gain / (valor inicial + aportaciones del periodo); null si no hay base. */
  pct: Decimal | null;
  flows: Decimal;
}

export function periodChange(points: readonly HistoryPoint[]): PeriodChange | null {
  if (points.length < 2) return null;
  const start = points[0];
  const end = points[points.length - 1];
  const flows = end.invested.minus(start.invested);
  const gain = end.value.minus(start.value).minus(flows);
  const base = start.value.plus(Decimal.max(flows, 0));
  return { gain, flows, pct: base.gt(0) ? gain.div(base) : null };
}

const addDays = (iso: string, days: number) => {
  const date = new Date(`${iso}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
};

/** Fechas del periodo, de la inicial a hoy. Los periodos largos se muestrean por semanas. */
export function periodDates(period: PeriodKey, today: string, firstTransactionDate: string | null): string[] {
  let start: string;
  switch (period) {
    case "1D":
      start = addDays(today, -1);
      break;
    case "1W":
      start = addDays(today, -7);
      break;
    case "1M":
      start = addDays(today, -30);
      break;
    case "YTD":
      start = addDays(`${today.slice(0, 4)}-01-01`, -1);
      break;
    case "1Y":
      start = addDays(today, -365);
      break;
    case "ALL":
      start = firstTransactionDate ? addDays(day(firstTransactionDate), -1) : addDays(today, -30);
      break;
  }

  const total = Math.round((Date.parse(`${today}T00:00:00Z`) - Date.parse(`${start}T00:00:00Z`)) / 86_400_000);
  const step = total > 730 ? 7 : 1;
  const dates: string[] = [];
  for (let offset = 0; offset < total; offset += step) dates.push(addDays(start, offset));
  dates.push(today);
  return dates;
}
