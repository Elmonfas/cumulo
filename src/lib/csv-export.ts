import Decimal from "decimal.js";

/**
 * CSV para abrir en Excel/Numbers/Sheets en español: separador ";", coma
 * decimal y BOM para que respete los acentos. Las celdas de texto que
 * empiezan por = + - @ se protegen con un apóstrofo (inyección de fórmulas).
 */
export type CsvCell = string | Decimal | null | undefined;

const FORMULA_START = /^[=+\-@\t\r]/;

/** Número sin separador de miles y con coma decimal: "1234,56". */
export const csvNumber = (value: Decimal | string, decimals?: number) => {
  const d = value instanceof Decimal ? value : new Decimal(value);
  return (decimals === undefined ? d.toString() : d.toFixed(decimals)).replace(".", ",");
};

function cell(value: CsvCell): string {
  if (value === null || value === undefined) return "";
  let text = value instanceof Decimal ? csvNumber(value) : value;
  if (!(value instanceof Decimal) && FORMULA_START.test(text)) text = `'${text}`;
  return /[";\n\r]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

export function toCsv(header: string[], rows: CsvCell[][]): string {
  return `﻿${[header, ...rows].map((row) => row.map(cell).join(";")).join("\r\n")}\r\n`;
}
