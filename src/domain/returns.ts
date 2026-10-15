import Decimal from "decimal.js";

/**
 * Rentabilidad anualizada.
 *
 * - `annualize`: de una rentabilidad simple a anual, (1 + r)^(365/días) − 1.
 * - `xirr`: tasa interna de retorno con fechas (igual que XIRR/TIR.NO.PER de
 *   una hoja de cálculo): Σ importe_i / (1 + tasa)^(días_i / 365) = 0.
 *
 * Sin humo: por debajo de un año no se anualiza (un +5 % en dos semanas no
 * es un +250 % anual), así que se devuelve null.
 */

const D = Decimal.clone({ precision: 30, rounding: Decimal.ROUND_HALF_UP });
export const MIN_DAYS_TO_ANNUALIZE = 365;

export const daysBetween = (from: string, to: string) =>
  Math.round((Date.parse(`${to.slice(0, 10)}T00:00:00Z`) - Date.parse(`${from.slice(0, 10)}T00:00:00Z`)) / 86_400_000);

export function annualize(totalReturn: Decimal, days: number): Decimal | null {
  if (days < MIN_DAYS_TO_ANNUALIZE || totalReturn.lte(-1)) return null;
  const result = new D(1).plus(totalReturn.toString()).pow(new D(365).div(days)).minus(1);
  return new Decimal(result.toString());
}

export interface CashFlow {
  /** YYYY-MM-DD */
  date: string;
  /** Negativo = dinero que sale (compra); positivo = dinero que entra (venta, valor actual). */
  amount: Decimal;
}

function npv(rate: Decimal, flows: { years: Decimal; amount: Decimal }[]) {
  let value = new D(0);
  let derivative = new D(0);
  const base = new D(1).plus(rate);
  for (const f of flows) {
    const discount = base.pow(f.years);
    value = value.plus(f.amount.div(discount));
    derivative = derivative.minus(f.amount.times(f.years).div(discount.times(base)));
  }
  return { value, derivative };
}

/**
 * TIR anual de unos flujos con fecha. null si no hay solución, si hay menos
 * de un año entre el primer y el último flujo o si los signos no cambian.
 */
export function xirr(cashFlows: readonly CashFlow[]): Decimal | null {
  const flows = cashFlows.filter((f) => !f.amount.isZero()).sort((a, b) => (a.date < b.date ? -1 : 1));
  if (flows.length < 2) return null;
  if (!flows.some((f) => f.amount.isNegative()) || !flows.some((f) => f.amount.isPositive())) return null;
  const span = daysBetween(flows[0].date, flows[flows.length - 1].date);
  if (span < MIN_DAYS_TO_ANNUALIZE) return null;

  const start = flows[0].date;
  const prepared = flows.map((f) => ({ years: new D(daysBetween(start, f.date)).div(365), amount: new D(f.amount.toString()) }));
  const tolerance = new D("1e-10");

  // Newton desde 10 %; si se sale de rango o no converge, bisección.
  let rate = new D("0.1");
  for (let i = 0; i < 50; i++) {
    const { value, derivative } = npv(rate, prepared);
    if (value.abs().lt(tolerance)) return new Decimal(rate.toString());
    if (derivative.isZero()) break;
    const next = rate.minus(value.div(derivative));
    if (!next.isFinite() || next.lte(-0.9999) || next.gt(100)) break;
    if (next.minus(rate).abs().lt(tolerance)) return new Decimal(next.toString());
    rate = next;
  }

  let low = new D("-0.9999");
  let high = new D(100);
  let fLow = npv(low, prepared).value;
  if (fLow.isPositive() === npv(high, prepared).value.isPositive()) return null;
  for (let i = 0; i < 200; i++) {
    const mid = low.plus(high).div(2);
    const fMid = npv(mid, prepared).value;
    if (fMid.abs().lt(tolerance) || high.minus(low).lt(tolerance)) return new Decimal(mid.toString());
    if (fMid.isPositive() === fLow.isPositive()) {
      low = mid;
      fLow = fMid;
    } else {
      high = mid;
    }
  }
  return null;
}
