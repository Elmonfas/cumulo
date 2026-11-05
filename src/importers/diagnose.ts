/**
 * Mensajes claros cuando el archivo no es la exportación de Trade Republic:
 * lo más habitual es subir el PDF, abrirlo antes en Numbers/Excel o traer el
 * CSV de otro bróker.
 */

const startsWith = (bytes: Uint8Array, signature: number[]) => signature.every((b, i) => bytes[i] === b);
const PDF = [0x25, 0x50, 0x44, 0x46]; // %PDF
const ZIP = [0x50, 0x4b, 0x03, 0x04]; // PK: .xlsx, .numbers y otros comprimidos

/** Mira el nombre y los primeros bytes; null si podría ser un CSV. */
export function diagnoseFile(name: string, head: Uint8Array): string | null {
  const ext = name.toLowerCase().split(".").pop() ?? "";
  if (ext === "pdf" || startsWith(head, PDF)) {
    return "Es un PDF (un extracto o un justificante). Necesitas la «Exportación de transacciones», que es un archivo .csv.";
  }
  if (ext === "numbers") {
    return "El archivo se guardó con Numbers (.numbers). Exporta otra vez desde Trade Republic y súbelo sin abrirlo.";
  }
  if (ext === "xlsx" || ext === "xls") {
    return "El archivo se guardó con Excel. Exporta otra vez desde Trade Republic y súbelo sin abrirlo: tiene que ser .csv.";
  }
  if (startsWith(head, ZIP)) return "Es un archivo comprimido, no un CSV. Exporta otra vez desde Trade Republic y súbelo tal cual.";
  return null;
}

// Cabeceras que delatan la exportación de otros brókers (en minúsculas).
const OTHER_BROKERS: { name: string; columns: string[] }[] = [
  { name: "DEGIRO", columns: ["producto", "isin", "centro de ejecución"] },
  { name: "DEGIRO", columns: ["product", "isin", "venue"] },
  { name: "Revolut", columns: ["ticker", "price per share", "total amount"] },
  { name: "Interactive Brokers", columns: ["tradeid"] },
  { name: "eToro", columns: ["position id", "open rate"] },
];

/** Si las columnas son de otro bróker, dice cuál y qué hacer; si no, null. */
export function describeOtherBroker(columns: readonly string[]): string | null {
  const present = new Set(columns.map((c) => c.trim().toLowerCase()));
  const broker = OTHER_BROKERS.find((b) => b.columns.every((c) => present.has(c)));
  if (!broker) return null;
  return `Este archivo parece de ${broker.name}. Por ahora cúmulo solo importa Trade Republic: añade esas posiciones con «Añadir lo que tengo».`;
}
