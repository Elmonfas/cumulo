import Decimal from "decimal.js";
import { formatDate, formatNumber, formatTime, MASK } from "./format";

/**
 * Ayudas para que los ejes de las gráficas se lean como los de un bróker:
 * etiquetas distintas entre sí, horas en los periodos cortos y días en los largos.
 */

const NBSP = " ";
const MONTHS = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sept", "oct", "nov", "dic"];

/** ¿La fecha lleva hora (dato intradía)? "2026-10-16T09:30:00.000Z" sí; "2026-10-16" no. */
export const hasTime = (date: string) => date.length > 10;

/** Quita los ceros decimales sobrantes: "74,50" → "74,5"; "75,00" → "75". */
const trimZeros = (text: string) => text.replace(/(,\d*?)0+$/, "$1").replace(/,$/, "");

/**
 * Decimales para que dos marcas separadas al menos `step` no se escriban
 * igual. Uno más de la cuenta porque Recharts usa pasos "bonitos" de 2,5
 * (72,5 mil €); los ceros sobrantes se quitan después.
 */
function decimalsForStep(step: number): number {
  if (step <= 0 || !Number.isFinite(step)) return 2;
  return Math.min(6, Math.max(0, Math.ceil(-Math.log10(step) + 0.0001)) + 1);
}

/**
 * Formateador del eje Y en euros adaptado al rango visible. Por encima de
 * 10.000 € usa "mil €" (74,5 mil €) y de 1 M€, "M€"; los decimales salen del
 * paso entre marcas, así nunca se repiten etiquetas ("75 mil €" dos veces).
 */
export function currencyAxisFormatter(values: readonly number[], { hidden = false, ticks = 5 } = {}): (value: number) => string {
  if (hidden) return () => MASK;
  const finite = values.filter(Number.isFinite);
  const min = finite.length ? Math.min(...finite) : 0;
  const max = finite.length ? Math.max(...finite) : 0;
  const top = Math.max(Math.abs(min), Math.abs(max));
  const step = (max - min || Math.abs(max) * 0.02 || 1) / (ticks - 1);

  if (top >= 1_000_000) {
    const decimals = decimalsForStep(step / 1_000_000);
    return (v) => `${trimZeros(formatNumber(new Decimal(v).div(1_000_000), decimals))}${NBSP}M€`;
  }
  if (top >= 10_000) {
    const decimals = decimalsForStep(step / 1_000);
    return (v) => `${trimZeros(formatNumber(new Decimal(v).div(1_000), decimals))}${NBSP}mil${NBSP}€`;
  }
  const decimals = decimalsForStep(step);
  return (v) => `${trimZeros(formatNumber(new Decimal(v), decimals))}${NBSP}€`;
}

const SHORT_SPAN_MS = 36 * 3_600_000;
/**
 * ¿Periodo de un día? Se ignora el primer punto: en 1D es el cierre anterior,
 * que puede ser de hace varios días (lunes frente al viernes).
 */
const isShortSpan = (dates: readonly string[]) => {
  const from = dates.length > 2 ? dates[1] : dates[0];
  return Date.parse(dates[dates.length - 1]) - Date.parse(from) <= SHORT_SPAN_MS;
};
const localDayKey = (date: Date) => `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`;

/**
 * Marcas del eje X para series intradía (eje de categorías, sin huecos de
 * mercado cerrado): en periodos de un día, horas redondas; en los demás, el
 * primer punto de cada día. Para series diarias devuelve undefined (Recharts
 * reparte las marcas).
 */
export function timeAxisTicks(dates: readonly string[], maxTicks = 5): string[] | undefined {
  if (dates.length < 2 || !hasTime(dates[0])) return undefined;
  const short = isShortSpan(dates);

  if (short) {
    for (const step of [1, 2, 3, 4, 6, 8, 12]) {
      const ticks: string[] = [];
      let previous = "";
      for (const d of dates.slice(1)) {
        const date = new Date(d);
        const key = `${localDayKey(date)}-${date.getHours()}`;
        if (key !== previous && date.getHours() % step === 0) ticks.push(d);
        previous = key;
      }
      if (ticks.length <= maxTicks) return ticks;
    }
    return [dates[0]];
  }

  const days: string[] = [];
  let previous = localDayKey(new Date(dates[0]));
  for (const d of dates) {
    const key = localDayKey(new Date(d));
    if (key !== previous) days.push(d);
    previous = key;
  }
  const every = Math.max(1, Math.ceil(days.length / maxTicks));
  return days.filter((_, i) => i % every === 0);
}

/** Etiqueta de una marca intradía: "14:00" en periodos de un día, "14 oct" en los demás. */
export function formatTimeTick(date: string, dates: readonly string[]): string {
  const value = new Date(date);
  return isShortSpan(dates) ? formatTime(value) : `${value.getDate()} ${MONTHS[value.getMonth()]}`;
}

/** Título del tooltip: "15 oct 2026" o, con hora, "15 oct 2026, 17:35". */
export function formatPointDate(date: string): string {
  return hasTime(date) ? `${formatDate(date)}, ${formatTime(date)}` : formatDate(date);
}

/**
 * Escala "bonita" para el eje Y: marcas con pasos de 1, 2, 2,5 o 5 × 10ⁿ que
 * envuelven los datos. Recharts, con domain "auto", a veces elige pasos como
 * 1.050 que dan etiquetas largas e ilegibles.
 */
export function niceScale(values: readonly number[], count = 5): { domain: [number, number]; ticks: number[] } {
  const finite = values.filter(Number.isFinite);
  if (finite.length === 0) return { domain: [0, 1], ticks: [0, 1] };
  let min = Math.min(...finite);
  let max = Math.max(...finite);
  if (min === max) {
    const pad = Math.abs(max) * 0.01 || 1;
    min -= pad;
    max += pad;
  }
  // El paso más fino de 1, 2, 2,5 o 5 × 10ⁿ que deja como mucho count + 1 marcas.
  const raw = (max - min) / (count - 1);
  const base = 10 ** (Math.floor(Math.log10(raw)) - 1);
  const candidates = [1, 10, 100].flatMap((k) => [1, 2, 2.5, 5].map((m) => m * k * base));
  const fits = (s: number) => Math.ceil(max / s - 1e-9) - Math.floor(min / s + 1e-9) + 1 <= count + 1;
  const step = candidates.find(fits) ?? candidates[candidates.length - 1];
  const lo = Math.floor(min / step) * step;
  const hi = Math.ceil(max / step) * step;
  const decimals = Math.max(0, -Math.floor(Math.log10(step)) + 2);
  const ticks: number[] = [];
  for (let v = lo; v <= hi + step / 2; v += step) ticks.push(Number(v.toFixed(decimals)));
  return { domain: [ticks[0], ticks[ticks.length - 1]], ticks };
}

/** Ancho del eje Y para que quepa la etiqueta más larga en una línea (fuente de 11–12 px). */
export const axisWidth = (labels: readonly string[], fontSize = 11) =>
  Math.ceil(Math.max(...labels.map((l) => l.length), 3) * fontSize * 0.66) + 10;
