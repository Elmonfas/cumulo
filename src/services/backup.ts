import type { Repositories } from "@/data/repositories";
import { BACKUP_FORMAT, BACKUP_VERSION, parseBackup, type BackupData } from "@/domain/backup";
import { DEFAULT_SETTINGS } from "@/domain/models";
import { checkTransactions } from "@/domain/portfolio";
import { todayIso } from "@/lib/format";

export async function exportBackup(repositories: Repositories): Promise<{ fileName: string; json: string }> {
  const data = await repositories.backup.exportAll();
  return { fileName: `cumulo-backup-${todayIso()}.json`, json: JSON.stringify(data, null, 2) };
}

export interface BackupSummary {
  data: BackupData;
  assets: number;
  transactions: number;
  exportedAt: string;
}

/** Lee y valida un backup sin escribir nada. */
export function readBackup(text: string): BackupSummary {
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    throw new Error("El archivo no es un JSON válido.");
  }
  const data = parseBackup(raw);
  const problem = checkTransactions(data.transactions);
  if (problem) throw new Error(`El backup contiene operaciones incoherentes: ${problem.message}`);
  return { data, assets: data.assets.length, transactions: data.transactions.length, exportedAt: data.exportedAt };
}

/** Sustituye todos los datos de este navegador por los del backup. */
export async function restoreBackup(repositories: Repositories, data: BackupData) {
  await repositories.backup.importAll(data);
}

/** Borra operaciones, activos, precios y ajustes de este navegador. */
export async function wipeAllData(repositories: Repositories) {
  await repositories.backup.importAll({
    format: BACKUP_FORMAT,
    version: BACKUP_VERSION,
    exportedAt: new Date().toISOString(),
    assets: [],
    transactions: [],
    priceCache: [],
    settings: DEFAULT_SETTINGS,
    alerts: [],
    watchlist: [],
    goals: [],
  });
}
