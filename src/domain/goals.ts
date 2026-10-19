import Decimal from "decimal.js";
import { monthlyRateFromAnnual } from "./compound-interest";
import type { DecimalString, IsoDateString, Transaction } from "./models";
import { transactionTotal } from "./portfolio";

/**
 * Objetivos de ahorro: "quiero X € en tal fecha".
 *
 * - Se miden contra el valor de la cartera (posiciones abiertas a precio de
 *   mercado), el mismo número que ves en Inicio.
 * - Mismo criterio que la calculadora de interés compuesto: tipo mensual
 *   equivalente al anual, (1 + r)^(1/12) − 1, y aportación al final de cada mes.
 * - Ritmo actual = lo aportado neto (compras − ventas) en los últimos 6 meses
 *   (incluido el actual, o desde la primera compra si es más reciente), entre
 *   esos meses. Si vendes más de lo que compras, es 0.
 * - Aportación necesaria = la cuota mensual que, con esa rentabilidad, lleva
 *   el valor de hoy hasta el objetivo en los meses que quedan:
 *   PMT = (objetivo − VP·(1+i)^n) · i / ((1+i)^n − 1).
 */

export interface Goal {
  id: string;
  name: string;
  /** Importe objetivo en EUR. */
  target: DecimalString;
  /** Fecha límite (YYYY-MM-DD). */
  targetDate: IsoDateString;
  /** Rentabilidad anual esperada: "0.07" = 7 %. */
  expectedReturn: DecimalString;
  createdAt: IsoDateString;
}

export interface GoalProgress {
  current: Decimal;
  target: Decimal;
  /** current / target, entre 0 y 1. */
  progress: Decimal;
  reached: boolean;
  /** Aportaciones mensuales que quedan hasta la fecha. */
  monthsLeft: number;
  /** Lo que habría que aportar cada mes; 0 si con lo que hay ya se llega; null si no queda tiempo. */
  requiredMonthly: Decimal | null;
  /** Lo que aportas de media al mes (últimos 6 meses). */
  currentMonthly: Decimal;
  /** Valor estimado en la fecha al ritmo actual. */
  projected: Decimal;
  onTrack: boolean;
  /** Mes (YYYY-MM) en el que se llegaría al ritmo actual; null si no se llega en 100 años. */
  reachMonth: string | null;
}

const D = Decimal.clone({ precision: 40, rounding: Decimal.ROUND_HALF_UP });
const cents = (v: Decimal) => new Decimal(v.toString()).toDecimalPlaces(2, Decimal.ROUND_HALF_UP);
const AVERAGE_MONTHS = 6;
const MAX_MONTHS = 1200;

const addMonth = (yearMonth: string, months: number) => {
  const [y, m] = yearMonth.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1 + months, 1)).toISOString().slice(0, 7);
};

/** Aportaciones mensuales completas entre hoy y la fecha objetivo (meses de calendario). */
export function monthsUntil(today: string, targetDate: string): number {
  const [ty, tm, td] = today.split("-").map(Number);
  const [gy, gm, gd] = targetDate.split("-").map(Number);
  const months = (gy - ty) * 12 + (gm - tm) - (gd < td ? 1 : 0);
  return Math.max(0, months);
}

/** Valor futuro con aportación al final de cada mes. */
export function futureValue(present: Decimal, monthly: Decimal, monthlyRate: Decimal, months: number): Decimal {
  if (months <= 0) return present;
  if (monthlyRate.isZero()) return present.plus(monthly.times(months));
  const growth = new D(1).plus(monthlyRate.toString()).pow(months);
  const fv = new D(present.toString()).times(growth).plus(new D(monthly.toString()).times(growth.minus(1)).div(monthlyRate.toString()));
  return new Decimal(fv.toString());
}

/** Cuota mensual para llegar a `target` en `months` meses; 0 si ya se llega solo con lo que hay. */
export function requiredMonthly(present: Decimal, target: Decimal, monthlyRate: Decimal, months: number): Decimal | null {
  if (months <= 0) return null;
  const withoutContributions = futureValue(present, new Decimal(0), monthlyRate, months);
  const gap = target.minus(withoutContributions);
  if (gap.lte(0)) return new Decimal(0);
  if (monthlyRate.isZero()) return cents(gap.div(months));
  const growth = new D(1).plus(monthlyRate.toString()).pow(months);
  return cents(new Decimal(new D(gap.toString()).times(monthlyRate.toString()).div(growth.minus(1)).toString()));
}

/**
 * Aportación neta media de los últimos `months` meses, incluido el actual. Si
 * la primera compra es más reciente, solo cuentan los meses desde entonces
 * (quien empezó este mes no aporta "0 €/mes").
 */
export function averageMonthlyContribution(transactions: readonly Transaction[], today: string, months = AVERAGE_MONTHS): Decimal {
  const current = today.slice(0, 7);
  const firstBuy = transactions
    .filter((t) => t.type === "buy")
    .map((t) => t.date.slice(0, 7))
    .sort()[0];
  if (!firstBuy || firstBuy > current) return new Decimal(0);
  const earliest = addMonth(current, -(months - 1));
  const start = firstBuy > earliest ? firstBuy : earliest;
  const [sy, sm] = start.split("-").map(Number);
  const [cy, cm] = current.split("-").map(Number);
  const count = (cy - sy) * 12 + (cm - sm) + 1;

  let net = new Decimal(0);
  for (const t of transactions) {
    const month = t.date.slice(0, 7);
    if (month < start || month > current) continue;
    if (t.type === "buy") net = net.plus(transactionTotal(t));
    else if (t.type === "sell") net = net.minus(transactionTotal(t));
  }
  return net.gt(0) ? cents(net.div(count)) : new Decimal(0);
}

export function goalProgress(goal: Goal, currentValue: Decimal, transactions: readonly Transaction[], today: string): GoalProgress {
  const target = new Decimal(goal.target);
  const rate = new Decimal(monthlyRateFromAnnual(new Decimal(goal.expectedReturn)).toString());
  const months = monthsUntil(today, goal.targetDate);
  const currentMonthly = averageMonthlyContribution(transactions, today);
  const reached = currentValue.gte(target);
  const projected = cents(futureValue(currentValue, currentMonthly, rate, months));
  const required = reached ? new Decimal(0) : requiredMonthly(currentValue, target, rate, months);

  let reachMonth: string | null = reached ? today.slice(0, 7) : null;
  if (!reached) {
    let value = currentValue;
    for (let i = 1; i <= MAX_MONTHS; i++) {
      value = futureValue(value, currentMonthly, rate, 1);
      if (value.gte(target)) {
        reachMonth = addMonth(today.slice(0, 7), i);
        break;
      }
      if (currentMonthly.isZero() && !rate.gt(0)) break;
    }
  }

  return {
    current: currentValue,
    target,
    progress: target.gt(0) ? Decimal.min(1, Decimal.max(0, currentValue.div(target))) : new Decimal(1),
    reached,
    monthsLeft: months,
    requiredMonthly: required,
    currentMonthly,
    projected,
    onTrack: reached || projected.gte(target),
    reachMonth,
  };
}
