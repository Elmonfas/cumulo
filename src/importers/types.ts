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

/** Corrección de un dividendo que no estaba en el mismo archivo: anula uno ya importado. */
export interface ImportedCorrection {
  line: number;
  asset: ImportedAssetRef;
  /** Bruto y retención del dividendo que se anula (positivos). */
  gross: string;
  tax: string;
}

export interface ParsedImport {
  source: "csv-tr";
  transactions: ImportedTransaction[];
  /** Filas que no se importan y por qué (tipos no soportados, etc.). */
  skipped: { line: number; reason: string }[];
  /** Filas incoherentes que impiden importar (p. ej. un traspaso sin su pareja). */
  problems?: { line: number; reason: string }[];
  /** Correcciones que anulan dividendos importados antes. */
  corrections?: ImportedCorrection[];
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
