import Decimal from "decimal.js";

/**
 * Interés compuesto con capitalización mensual.
 *
 * Reglas (acordadas en la Fase 1):
 * - El tipo mensual es el equivalente al anual: (1 + r)^(1/12) − 1, de modo que
 *   12 meses sin aportaciones rinden exactamente r.
 * - Cada mes: interés = saldo × tipo mensual, redondeado al céntimo (half-up,
 *   igual que REDONDEAR de una hoja de cálculo); después se suma la aportación,
 *   que llega al final del mes.
 * - La inflación se descuenta por años completos: valor real del año n =
 *   saldo / (1 + inflación)^n, redondeado al céntimo.
 */

/** Precisión amplia para la potencia fraccionaria; los importes se redondean a céntimos. */
const D = Decimal.clone({ precision: 40, rounding: Decimal.ROUND_HALF_UP });

const MAX_YEARS = 100;

export interface CompoundInterestInput {
  initialCapital: Decimal;
  monthlyContribution: Decimal;
  /** Proporción anual: 0.07 = 7 %. */
  annualRate: Decimal;
  /** Años completos (entero entre 1 y 100). */
  years: number;
  /** Proporción anual: 0.02 = 2 %. Si falta, no se calcula el valor real. */
  annualInflation?: Decimal;
}

export interface CompoundInterestYear {
  /** 0 es el punto de partida. */
  year: number;
  /** Capital inicial más aportaciones acumuladas. */
  contributed: Decimal;
  /** Intereses acumulados. */
  interest: Decimal;
  balance: Decimal;
  /** Saldo en euros de hoy; solo si hay inflación. */
  realBalance?: Decimal;
}

export interface CompoundInterestResult {
  monthlyRate: Decimal;
  /** Fila por año, de 0 a `years`. */
  timeline: CompoundInterestYear[];
  final: CompoundInterestYear;
}

const toCents = (value: Decimal) => value.toDecimalPlaces(2, Decimal.ROUND_HALF_UP);

export function monthlyRateFromAnnual(annualRate: Decimal): Decimal {
  return new D(1).plus(annualRate.toString()).pow(new D(1).div(12)).minus(1);
}

function validate(input: CompoundInterestInput) {
  if (input.initialCapital.isNegative()) throw new RangeError("El capital inicial no puede ser negativo.");
  if (input.monthlyContribution.isNegative()) throw new RangeError("La aportación mensual no puede ser negativa.");
  if (input.annualRate.lte(-1)) throw new RangeError("La rentabilidad anual debe ser mayor que -100 %.");
  if (input.annualInflation?.lte(-1)) throw new RangeError("La inflación anual debe ser mayor que -100 %.");
  if (!Number.isInteger(input.years) || input.years < 1 || input.years > MAX_YEARS) {
    throw new RangeError(`Los años deben ser un entero entre 1 y ${MAX_YEARS}.`);
  }
}

export function calculateCompoundInterest(input: CompoundInterestInput): CompoundInterestResult {
  validate(input);

  const monthlyRate = monthlyRateFromAnnual(input.annualRate);
  const contribution = toCents(input.monthlyContribution);
  const inflationFactor = input.annualInflation ? new D(1).plus(input.annualInflation.toString()) : undefined;

  let balance = toCents(input.initialCapital);
  let contributed = balance;

  const row = (year: number): CompoundInterestYear => ({
    year,
    contributed,
    interest: balance.minus(contributed),
    balance,
    realBalance: inflationFactor && new Decimal(toCents(new D(balance.toString()).div(inflationFactor.pow(year))).toString()),
  });

  const timeline = [row(0)];
  for (let year = 1; year <= input.years; year++) {
    for (let month = 0; month < 12; month++) {
      const interest = new Decimal(toCents(new D(balance.toString()).times(monthlyRate)).toString());
      balance = balance.plus(interest).plus(contribution);
      contributed = contributed.plus(contribution);
    }
    timeline.push(row(year));
  }

  return { monthlyRate, timeline, final: timeline[timeline.length - 1] };
}
