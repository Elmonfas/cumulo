import Decimal from "decimal.js";
import type { DecimalString, IsoDateString } from "@/domain/models";

/**
 * Formato es-ES hecho a mano: Intl agrupa en es-ES solo a partir de 5 cifras
 * ("1234,56 €"), y aquí queremos siempre "1.234,56 €". Los símbolos van
 * separados con espacio duro (U+00A0) para que no se partan de línea.
 */
const NBSP = " ";

type DecimalInput = Decimal | DecimalString;

function toDecimal(value: DecimalInput): Decimal {
  return value instanceof Decimal ? value : new Decimal(value);
}

function sign(rounded: Decimal, signed: boolean): string {
  if (rounded.isZero()) return "";
  if (rounded.isNegative()) return "-";
  return signed ? "+" : "";
}

/** Número con separador de miles "." y decimal ",", redondeo half-up. */
export function formatNumber(value: DecimalInput, decimals = 2, { signed = false } = {}): string {
  const rounded = toDecimal(value).toDecimalPlaces(decimals, Decimal.ROUND_HALF_UP);
  const [integer, fraction] = rounded.abs().toFixed(decimals).split(".");
  const grouped = integer.replace(/\B(?=(\d{3})+(?!\d))/g, ".");
  return `${sign(rounded, signed)}${grouped}${fraction ? `,${fraction}` : ""}`;
}

/** "1.234,56 €". Con `signed`, los positivos llevan "+". */
export function formatCurrency(value: DecimalInput, { signed = false } = {}): string {
  return `${formatNumber(value, 2, { signed })}${NBSP}€`;
}

/** Versión corta para ejes y etiquetas: "850 €", "1,5 mil €", "12 mil €", "1,2 M€". */
export function formatCompactCurrency(value: DecimalInput): string {
  const decimal = toDecimal(value);
  const abs = decimal.abs();
  const compact = (scaled: Decimal, decimals: number) =>
    formatNumber(scaled, decimals).replace(/,0+$/, "");
  if (abs.gte(999_500)) return `${compact(decimal.div(1_000_000), 1)}${NBSP}M€`;
  if (abs.gte(1_000)) return `${compact(decimal.div(1_000), abs.gte(10_000) ? 0 : 1)}${NBSP}mil${NBSP}€`;
  return `${formatNumber(decimal, 0)}${NBSP}€`;
}

/** Recibe una proporción (0.032 → "+3,2 %"). Con signo por defecto, para variaciones. */
export function formatPercent(ratio: DecimalInput, { decimals = 1, signed = true } = {}): string {
  return `${formatNumber(toDecimal(ratio).times(100), decimals, { signed })}${NBSP}%`;
}

const MONTHS = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sept", "oct", "nov", "dic"];
const DATE_ONLY = /^(\d{4})-(\d{2})-(\d{2})$/;

/**
 * "15 oct 2026". Una fecha sin hora ("2026-10-15") se muestra tal cual, sin
 * conversión de zona; una fecha con hora se muestra en la zona del navegador.
 */
export function formatDate(value: IsoDateString | Date): string {
  if (typeof value === "string") {
    const match = DATE_ONLY.exec(value);
    if (match) {
      const [, year, month, day] = match;
      return `${Number(day)} ${MONTHS[Number(month) - 1]} ${year}`;
    }
  }
  const date = typeof value === "string" ? new Date(value) : value;
  if (Number.isNaN(date.getTime())) throw new RangeError(`Fecha no válida: ${String(value)}`);
  return `${date.getDate()} ${MONTHS[date.getMonth()]} ${date.getFullYear()}`;
}
