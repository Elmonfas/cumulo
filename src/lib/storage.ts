/**
 * Almacenamiento persistente: sin él, el navegador puede borrar IndexedDB si
 * se queda sin espacio. Safari además borra los datos de las webs no
 * instaladas tras 7 días sin abrirlas; instalada en la pantalla de inicio, no.
 */
export type StorageStatus = "persistent" | "best-effort" | "unsupported";

export async function storageStatus(): Promise<StorageStatus> {
  if (typeof navigator === "undefined" || !navigator.storage?.persisted) return "unsupported";
  try {
    return (await navigator.storage.persisted()) ? "persistent" : "best-effort";
  } catch {
    return "unsupported";
  }
}

/** Pide guardar los datos para siempre. Nunca lanza: si no se puede, sigue como estaba. */
export async function requestPersistentStorage(): Promise<StorageStatus> {
  const status = await storageStatus();
  if (status !== "best-effort" || !navigator.storage.persist) return status;
  try {
    return (await navigator.storage.persist()) ? "persistent" : "best-effort";
  } catch {
    return "best-effort";
  }
}
