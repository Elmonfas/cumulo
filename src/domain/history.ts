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
  /** Valorar el último día con el precio actual (por defecto). Para años pasados, false. */
  currentOnLastDay?: boolean;
}

const day = (iso: string) => iso.slice(0, 10);

export function portfolioHistory(
  transactions: readonly Transaction[],
  closes: ReadonlyMap<string, readonly ClosePoint[]>,
  dates: readonly string[],
  { currentPrices, currentOnLastDay = true }: HistoryOptions,
): HistoryPoint[] {
  const sorted = sortTransactions(transactions);
  const state = createPortfolioState();
  const cursors = new Map<string, number>();
  const lastClose = new Map<string, Decimal>();
  let next = 0;

  return dates.map((date, index) => {
    while (next < sorted.length && day(sorted[next].date) <= date) applyTransaction(state, sorted[next++]);

    const isLast = currentOnLastDay && index === dates.length - 1;
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

/** Duración de cada periodo intradía. */
const INTRADAY_SPAN_MS: Partial<Record<PeriodKey, number>> = {
  "1D": 86_400_000,
  "1W": 7 * 86_400_000,
  "1M": 30 * 86_400_000,
};

export const isIntradayPeriod = (period: PeriodKey) => period in INTRADAY_SPAN_MS;

/** Tamaño de cubo para unificar series de distinta frecuencia (acciones cada 30 min, cripto cada hora…). */
const INTRADAY_BUCKET_MS: Partial<Record<PeriodKey, number>> = {
  "1D": 5 * 60_000,
  "1W": 3_600_000,
  "1M": 3_600_000,
};

/**
 * Instantes de una gráfica intradía: todos los de las series dentro del
 * periodo (hasta `now`), ordenados. Si en 1D apenas hay datos (bolsa cerrada,
 * fin de semana), se muestra la última sesión completa, como hacen los brókers.
 * Los instantes se agrupan en cubos regulares (un punto por cubo, el último),
 * así el eje avanza al mismo ritmo con cripto (24/7) y se comprime de noche
 * si solo hay acciones. Con muchos puntos se submuestrea, conservando el último.
 */
export function intradayDates(
  series: Iterable<readonly ClosePoint[]>,
  period: PeriodKey,
  now: Date,
  maxPoints = 400,
): string[] {
  const span = INTRADAY_SPAN_MS[period] ?? INTRADAY_SPAN_MS["1D"]!;
  const all = new Set<string>();
  for (const points of series) for (const p of points) all.add(p.date);
  const bucket = INTRADAY_BUCKET_MS[period] ?? 60_000;
  const byBucket = new Map<number, string>();
  for (const d of [...all].sort()) {
    const time = Date.parse(d);
    if (time <= now.getTime()) byBucket.set(Math.floor(time / bucket), d);
  }
  const sorted = [...byBucket.values()];
  if (sorted.length === 0) return [];

  const start = new Date(now.getTime() - span).toISOString();
  let dates = sorted.filter((d) => d >= start);
  if (period === "1D" && dates.length < 12) {
    const lastSession = sorted[sorted.length - 1].slice(0, 10);
    dates = sorted.filter((d) => d.slice(0, 10) === lastSession);
  }
  // Se parte del último dato anterior (el cierre previo), como los brókers:
  // la variación del periodo se mide frente a él y no frente a la apertura.
  const previous = sorted.filter((d) => d < (dates[0] ?? start)).at(-1);
  if (previous) dates = [previous, ...dates];
  if (dates.length <= maxPoints) return dates;
  const every = Math.ceil(dates.length / maxPoints);
  const sampled = dates.filter((_, i) => i % every === 0);
  if (sampled[sampled.length - 1] !== dates[dates.length - 1]) sampled.push(dates[dates.length - 1]);
  return sampled;
}
