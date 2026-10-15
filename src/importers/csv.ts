import Papa from "papaparse";
import { UnrecognizedFormatError } from "./types";

export interface CsvTable {
  columns: string[];
  rows: Record<string, string>[];
  delimiter: string;
}

/** Lee un CSV con cabecera; detecta el separador (",", ";" o tabulador) y quita el BOM. */
export function readCsv(text: string): CsvTable {
  const result = Papa.parse<Record<string, string>>(text.replace(/^﻿/, ""), {
    header: true,
    skipEmptyLines: "greedy",
    transformHeader: (header) => header.trim(),
  });
  const columns = result.meta.fields ?? [];
  if (columns.length < 2) throw new UnrecognizedFormatError("El archivo no parece un CSV con cabecera.", columns);
  return { columns, rows: result.data, delimiter: result.meta.delimiter };
}
