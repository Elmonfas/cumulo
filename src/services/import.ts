import Decimal from "decimal.js";
import type { Repositories } from "@/data/repositories";
import type { Asset, Transaction, TransactionType } from "@/domain/models";
import { checkTransactions, transactionTotal } from "@/domain/portfolio";
import { CASH_TRANSACTION_TYPES } from "@/lib/labels";
import type { ImportedAssetRef, ImportedTransaction, ParsedImport } from "@/importers/types";
import type { AssetCandidate, AssetSearchResponse } from "@/prices/types";
import { createManualAsset, ensureAsset } from "./transactions";

/**
 * Flujo de importación: archivo → vista previa (totales y duplicados) →
 * confirmar. Los duplicados se detectan por `importHash`, así que reimportar
 * el mismo archivo no añade nada.
 */

export interface PreviewRow {
  transaction: ImportedTransaction;
  duplicate: boolean;
}

export interface ImportPreview {
  parsed: ParsedImport;
  rows: PreviewRow[];
  newCount: number;
  duplicateCount: number;
  /** Solo filas nuevas. */
  totals: Partial<Record<TransactionType, { count: number; amount: Decimal }>>;
  /** Problema de coherencia al sumar las filas nuevas al historial (venta sin compra…). */
  problem: string | null;
}

const assetKey = (ref: ImportedAssetRef) => (ref.isin ? `isin:${ref.isin.toUpperCase()}` : `name:${ref.name.toLowerCase()}`);

export async function prepareImport(repositories: Repositories, input: ParsedImport): Promise<ImportPreview> {
  // Depósitos y retiradas no se importan: el efectivo vive en el bróker.
  const cashRows = input.transactions.filter((t) => CASH_TRANSACTION_TYPES.includes(t.type));
  const parsed: ParsedImport = {
    ...input,
    transactions: input.transactions.filter((t) => !CASH_TRANSACTION_TYPES.includes(t.type)),
    skipped: [...input.skipped, ...cashRows.map((t) => ({ line: t.line, reason: "Movimiento de efectivo" }))],
  };
  const [existing, assets] = await Promise.all([repositories.transactions.list(), repositories.assets.list()]);
  const existingHashes = await repositories.transactions.existingImportHashes(parsed.transactions.map((t) => t.importHash));

  const seen = new Set<string>();
  const rows = parsed.transactions.map((transaction) => {
    const duplicate = existingHashes.has(transaction.importHash) || seen.has(transaction.importHash);
    seen.add(transaction.importHash);
    return { transaction, duplicate };
  });
  const fresh = rows.filter((r) => !r.duplicate).map((r) => r.transaction);

  const totals: ImportPreview["totals"] = {};
  for (const t of fresh) {
    const entry = (totals[t.type] ??= { count: 0, amount: new Decimal(0) });
    entry.count++;
    entry.amount = entry.amount.plus(transactionTotal({ ...t, id: "", origin: "csv-tr" }));
  }

  // Validación con activos provisionales: el mismo ISIN que un activo existente se une a él.
  const idByIsin = new Map(assets.filter((a) => a.isin).map((a) => [`isin:${a.isin!.toUpperCase()}`, a.id]));
  const simulated: Transaction[] = [
    ...existing,
    ...fresh.map((t, i) => ({
      ...t,
      id: `import-${i}`,
      origin: "csv-tr" as const,
      assetId: t.asset ? (idByIsin.get(assetKey(t.asset)) ?? assetKey(t.asset)) : undefined,
    })),
  ];
  const error = checkTransactions(simulated);
  let problem: string | null = null;
  if (error) {
    const line = "line" in error.transaction ? ` (línea ${(error.transaction as unknown as ImportedTransaction).line})` : "";
    problem = `${error.message}${line}`;
  }

  return {
    parsed,
    rows,
    newCount: fresh.length,
    duplicateCount: rows.length - fresh.length,
    totals,
    problem,
  };
}

export type SearchFn = (query: string) => Promise<AssetSearchResponse>;

export const searchViaApi: SearchFn = async (query) => {
  const response = await fetch(`/api/assets/search?q=${encodeURIComponent(query)}`);
  if (!response.ok) throw new Error(`Búsqueda fallida (${response.status})`);
  return response.json() as Promise<AssetSearchResponse>;
};

/** Activo para una referencia importada: existente por ISIN, buscado por ISIN o manual. */
export async function resolveImportedAsset(repositories: Repositories, ref: ImportedAssetRef, search: SearchFn): Promise<Asset> {
  const assets = await repositories.assets.list();
  const isin = ref.isin?.toUpperCase();
  const byIsin = isin && assets.find((a) => a.isin?.toUpperCase() === isin);
  if (byIsin) return byIsin;

  if (isin) {
    try {
      const result = await search(isin);
      const candidate: AssetCandidate | undefined = result.securities[0];
      if (candidate) return ensureAsset(repositories, { ...candidate, isin, type: ref.type ?? candidate.type });
    } catch {
      // Sin conexión o fuente caída: se crea como activo manual.
    }
  }

  const byName = assets.find((a) => a.priceSource === "manual" && a.name.toLowerCase() === ref.name.toLowerCase());
  if (byName) return byName;
  return createManualAsset(repositories, { name: ref.name, type: ref.type ?? "other", isin, ticker: ref.ticker });
}

export async function commitImport(
  repositories: Repositories,
  preview: ImportPreview,
  search: SearchFn = searchViaApi,
): Promise<{ imported: number }> {
  // Se vuelve a comprobar por si algo cambió entre la vista previa y la confirmación.
  const current = await prepareImport(repositories, preview.parsed);
  if (current.problem) throw new Error(current.problem);

  const assetIds = new Map<string, string>();
  const fresh = current.rows.filter((r) => !r.duplicate).map((r) => r.transaction);
  for (const t of fresh) {
    if (!t.asset) continue;
    const key = assetKey(t.asset);
    if (!assetIds.has(key)) assetIds.set(key, (await resolveImportedAsset(repositories, t.asset, search)).id);
  }

  await repositories.transactions.bulkAdd(
    fresh.map(({ asset, line: _line, ...t }) => ({
      ...t,
      assetId: asset ? assetIds.get(assetKey(asset)) : undefined,
      origin: current.parsed.source,
    })),
  );
  return { imported: fresh.length };
}
