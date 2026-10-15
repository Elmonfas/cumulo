/**
 * Hash estable de una operación importada. Incluye un contador de aparición
 * para que dos filas idénticas del mismo archivo (p. ej. dos compras iguales
 * el mismo día) cuenten como dos operaciones, y reimportar el archivo genere
 * exactamente los mismos hashes.
 */
export async function importHash(fields: (string | undefined)[], occurrence: number): Promise<string> {
  const text = [...fields.map((f) => (f ?? "").trim().toLowerCase()), String(occurrence)].join("␟");
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text));
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

/** Asigna a cada fila su número de aparición entre filas con la misma clave. */
export function occurrenceCounter() {
  const seen = new Map<string, number>();
  return (key: string) => {
    const next = (seen.get(key) ?? 0) + 1;
    seen.set(key, next);
    return next;
  };
}
