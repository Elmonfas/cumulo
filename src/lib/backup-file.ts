import type { Repositories } from "@/data/repositories";
import { exportBackup } from "@/services/backup";
import { isIos } from "./device";
import { downloadFile, shareOrDownload } from "./image";

const LAST_BACKUP_KEY = "cumulo:last-backup";

/** Guarda la copia: en iPhone con el menú Compartir (Archivos o iCloud Drive); si no, se descarga. */
export async function saveBackupCopy(repositories: Repositories): Promise<boolean> {
  const { fileName, json } = await exportBackup(repositories);
  const file = new File([json], fileName, { type: "application/json" });
  const result = isIos() ? await shareOrDownload(file, "Copia de cúmulo") : (downloadFile(file), "downloaded");
  if (result === "cancelled") return false;
  try {
    localStorage.setItem(LAST_BACKUP_KEY, new Date().toISOString());
  } catch {}
  return true;
}

/** Cuándo se guardó la última copia desde este dispositivo, si se sabe. */
export function lastBackupAt(): string | null {
  try {
    return localStorage.getItem(LAST_BACKUP_KEY);
  } catch {
    return null;
  }
}
