import Decimal from "decimal.js";
import type { ClosePoint } from "./history";
import { xirr, type CashFlow } from "./returns";

/**
 * Simulador de aportaciones periódicas (DCA) con precios históricos reales.
 *
 * - Cada mes, desde `startDate`, se compra el primer día con cotización a
 *   partir del mismo día del mes (si el mes no tiene ese día, el último).
 * - Se invierte la aportación menos la comisión; se admiten fracciones.
 * - El valor final usa el último precio (o el actual si se pasa).
 * - Comparación honesta: invertir lo mismo de golpe el primer día.
 */

export interface DcaInput {
  closes: readonly ClosePoint[];
  monthlyAmount: Decimal;
  /** YYYY-MM-DD */
  startDate: string;
  /** Comisión por compra. */
  fee?: Decimal;
  /** Precio actual; si falta, el último cierre. */
  currentPrice?: Decimal;
}

export interface DcaBuy {
  date: string;
  price: Decimal;
  quantity: Decimal;
}

export interface DcaPoint {
  date: string;
  invested: Decimal;
  value: Decimal;
}

export interface DcaResult {
  buys: DcaBuy[];
  timeline: DcaPoint[];
  invested: Decimal;
  quantity: Decimal;
  averagePrice: Decimal;
  finalPrice: Decimal;
  value: Decimal;
  gain: Decimal;
  gainPct: Decimal | null;
  /** TIR anual; null por debajo de un año. */
  annualized: Decimal | null;
  /** Mismo total invertido de golpe en la primera compra. */
  lumpSumValue: Decimal;
}

const QUANTITY_DP = 10;

function monthTargets(startDate: string, endDate: string): string[] {
  const [y, m, d] = startDate.split("-").map(Number);
  const targets: string[] = [];
  for (let i = 0; ; i++) {
    const year = y + Math.floor((m - 1 + i) / 12);
    const month = ((m - 1 + i) % 12) + 1;
    const lastDay = new Date(Date.UTC(year, month, 0)).getUTCDate();
    const target = `${year}-${String(month).padStart(2, "0")}-${String(Math.min(d, lastDay)).padStart(2, "0")}`;
    if (target > endDate) break;
    targets.push(target);
  }
  return targets;
}

export function simulateDca({ closes, monthlyAmount, startDate, fee = new Decimal(0), currentPrice }: DcaInput): DcaResult | null {
  const series = [...closes].sort((a, b) => (a.date < b.date ? -1 : 1));
  if (series.length === 0 || !monthlyAmount.gt(fee)) return null;
  const lastDate = series[series.length - 1].date;

  const buys: DcaBuy[] = [];
  let cursor = 0;
  for (const target of monthTargets(startDate, lastDate)) {
    while (cursor < series.length && series[cursor].date < target) cursor++;
    if (cursor >= series.length) break;
    const point = series[cursor];
    // Si ese mes no hubo cotización (hueco en la serie), no se compra dos veces el mismo día.
    if (buys.at(-1)?.date === point.date) continue;
    const quantity = monthlyAmount.minus(fee).div(point.close).toDecimalPlaces(QUANTITY_DP, Decimal.ROUND_DOWN);
    buys.push({ date: point.date, price: point.close, quantity });
  }
  if (buys.length === 0) return null;

  const timeline: DcaPoint[] = [];
  let next = 0;
  let quantity = new Decimal(0);
  let invested = new Decimal(0);
  for (const point of series) {
    if (point.date < buys[0].date) continue;
    while (next < buys.length && buys[next].date <= point.date) {
      quantity = quantity.plus(buys[next].quantity);
      invested = invested.plus(monthlyAmount);
      next++;
    }
    timeline.push({ date: point.date, invested, value: quantity.times(point.close) });
  }

  const finalPrice = currentPrice ?? series[series.length - 1].close;
  const value = quantity.times(finalPrice);
  if (timeline.length) timeline[timeline.length - 1] = { ...timeline[timeline.length - 1], value };
  const gain = value.minus(invested);
  const flows: CashFlow[] = [
    ...buys.map((b) => ({ date: b.date, amount: monthlyAmount.negated() })),
    { date: lastDate, amount: value },
  ];
  const lumpQuantity = invested.minus(fee).div(buys[0].price);

  return {
    buys,
    timeline,
    invested,
    quantity,
    averagePrice: quantity.isZero() ? new Decimal(0) : invested.div(quantity),
    finalPrice,
    value,
    gain,
    gainPct: invested.gt(0) ? gain.div(invested) : null,
    annualized: xirr(flows),
    lumpSumValue: lumpQuantity.times(finalPrice),
  };
}
