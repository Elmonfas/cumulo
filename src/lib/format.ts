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

/**
 * Modo privado: con los importes ocultos, euros y cantidades se muestran como
 * "•••" (los porcentajes siguen visibles). Lo activa PrivacyBoundary; las
 * cifras hipotéticas (calculadoras) o las tarjetas usan `reveal`.
 */
export const MASK = "•••";
let amountsHidden = false;

export function setAmountsHidden(hidden: boolean) {
  amountsHidden = hidden;
}

export const areAmountsHidden = () => amountsHidden;

interface RevealOption {
  /** Muestra la cifra aunque el modo privado esté activo. */
  reveal?: boolean;
}

/** "1.234,56 €". Con `signed`, los positivos llevan "+". */
export function formatCurrency(value: DecimalInput, { signed = false, reveal = false }: { signed?: boolean } & RevealOption = {}): string {
  if (amountsHidden && !reveal) return `${MASK}${NBSP}€`;
  return `${formatNumber(value, 2, { signed })}${NBSP}€`;
}

/** Cantidad de participaciones con hasta 8 decimales ("12", "0,0215"). */
export function formatQuantity(value: DecimalInput, { reveal = false }: RevealOption = {}): string {
  if (amountsHidden && !reveal) return MASK;
  const decimal = toDecimal(value);
  return formatNumber(decimal, Math.min(8, decimal.decimalPlaces()));
}

/** Versión corta para ejes y etiquetas: "850 €", "1,5 mil €", "12 mil €", "1,2 M€". */
export function formatCompactCurrency(value: DecimalInput, { reveal = false }: RevealOption = {}): string {
  if (amountsHidden && !reveal) return MASK;
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

/** Etiqueta de eje de fechas: "15 oct", o "oct 26" en rangos largos. */
export function formatAxisDate(isoDate: string, withYear: boolean): string {
  const [y, m, d] = isoDate.split("-");
  return withYear ? `${MONTHS[Number(m) - 1]} ${y.slice(2)}` : `${Number(d)} ${MONTHS[Number(m) - 1]}`;
}

/**
 * ¿El eje debe llevar año? Si el rango pasa de ~13 meses, o si cruza de año y
 * dura más de unos meses ("22 ene" sería ambiguo entre nov 25 y oct 26).
 */
export function isLongRange(first: string | undefined, last: string | undefined): boolean {
  if (!first || !last) return false;
  const days = (Date.parse(last) - Date.parse(first)) / 86_400_000;
  return days > 400 || (first.slice(0, 4) !== last.slice(0, 4) && days > 120);
}

/** Etiqueta de eje en puntos porcentuales (geometría, no dinero): 25 → "25 %", −7 → "−7 %". */
export function formatAxisPercent(points: number): string {
  const rounded = Math.round(points);
  return `${rounded < 0 ? "−" : ""}${Math.abs(rounded)}${NBSP}%`;
}

const MONTHS_LONG = [
  "enero",
  "febrero",
  "marzo",
  "abril",
  "mayo",
  "junio",
  "julio",
  "agosto",
  "septiembre",
  "octubre",
  "noviembre",
  "diciembre",
];

/** "2026-10" o una fecha ISO → "octubre 2026". */
export function formatMonthYear(isoDate: string): string {
  const [year, month] = isoDate.split("-");
  return `${MONTHS_LONG[Number(month) - 1]} ${year}`;
}

/** Hora local "18:05". */
export function formatTime(value: string | Date): string {
  const date = typeof value === "string" ? new Date(value) : value;
  return `${String(date.getHours()).padStart(2, "0")}:${String(date.getMinutes()).padStart(2, "0")}`;
}

/** Fecha de hoy en la zona local, "YYYY-MM-DD". */
export function todayIso(now = new Date()): string {
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
}
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
