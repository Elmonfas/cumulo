import Decimal from "decimal.js";

const THOUSANDS_ONLY = /^\d{1,3}(\.\d{3})+$/;
const PLAIN = /^\d+(\.\d+)?$/;

/**
 * Interpreta un número escrito en es-ES sin pasar por `number`.
 * - Con coma: los puntos son miles y la coma es decimal ("1.234,56").
 * - Sin coma: "1.234" o "1.234.567" son miles; "7.5" se acepta como decimal.
 * Ignora espacios, "€" y "%". Devuelve null si no es un número válido.
 */
export function parseDecimal(raw: string): Decimal | null {
  let text = raw.replace(/[\s €%]/g, "");
  if (!text) return null;

  let negative = false;
  if (text.startsWith("-") || text.startsWith("−")) {
    negative = true;
    text = text.slice(1);
  } else if (text.startsWith("+")) {
    text = text.slice(1);
  }

  let normalized: string;
  if (text.includes(",")) {
    const [integer, fraction, ...rest] = text.split(",");
    if (rest.length > 0 || !fraction || !/^\d+$/.test(fraction)) return null;
    if (integer.includes(".") && !THOUSANDS_ONLY.test(integer)) return null;
    if (!/^[\d.]*$/.test(integer)) return null;
    normalized = `${integer.replace(/\./g, "") || "0"}.${fraction}`;
  } else if (THOUSANDS_ONLY.test(text)) {
    normalized = text.replace(/\./g, "");
  } else if (PLAIN.test(text)) {
    normalized = text;
  } else {
    return null;
  }

  const value = new Decimal(normalized);
  return negative && !value.isZero() ? value.negated() : value;
}

/** "7" o "7,5" (en %) → 0.07 / 0.075. */
export function parsePercent(raw: string): Decimal | null {
  return parseDecimal(raw)?.div(100) ?? null;
}

/** Decimal → texto editable es-ES sin separador de miles ("1234,5"). */
export function toInputString(value: Decimal | string): string {
  return new Decimal(value).toString().replace(".", ",");
}
