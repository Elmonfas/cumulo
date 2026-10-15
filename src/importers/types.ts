import type { AssetType, Transaction } from "@/domain/models";

/** Activo tal y como lo describe el archivo importado. */
export interface ImportedAssetRef {
  name: string;
  isin?: string;
  ticker?: string;
  type?: AssetType;
}

/** Operación leída de un archivo, antes de asignarle activo e id. */
export interface ImportedTransaction extends Omit<Transaction, "id" | "assetId" | "origin" | "importHash"> {
  asset?: ImportedAssetRef;
  importHash: string;
  /** Línea del archivo (1 = cabecera), para mensajes. */
  line: number;
}

export interface ParsedImport {
  source: "csv-tr";
  transactions: ImportedTransaction[];
  /** Filas que no se importan y por qué (tipos no soportados, etc.). */
  skipped: { line: number; reason: string }[];
}

/** El archivo no tiene el formato esperado. `columns` ayuda a diagnosticar. */
export class UnrecognizedFormatError extends Error {
  constructor(
    message: string,
    readonly columns: string[] = [],
  ) {
    super(message);
    this.name = "UnrecognizedFormatError";
  }
}
