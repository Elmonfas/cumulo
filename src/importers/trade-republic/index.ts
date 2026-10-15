import { readCsv } from "../csv";
import { UnrecognizedFormatError, type ParsedImport } from "../types";

/**
 * Parser de la "Exportación de transacciones" de Trade Republic.
 *
 * PENDIENTE (Fase 3): por regla del proyecto no se asume el formato. El
 * mapeo de columnas se escribirá sobre el CSV real y sus fixtures
 * anonimizadas. Mientras tanto, se lee el archivo y se informa de las
 * columnas encontradas para poder diagnosticarlo.
 */
export async function parseTradeRepublicCsv(text: string): Promise<ParsedImport> {
  const table = readCsv(text);
  throw new UnrecognizedFormatError(
    `${table.rows.length === 1 ? "Leída 1 fila" : `Leídas ${table.rows.length} filas`}, pero el formato de Trade Republic todavía no está mapeado.`,
    table.columns,
  );
}
