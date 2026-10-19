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
  /** Por qué se omite: ya importada antes o ya registrada a mano (mismo activo, día y cantidad). */
  duplicateOf?: "import" | "manual";
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
  /** Dividendos ya importados que una corrección del archivo anula al confirmar. */
  cancels: Transaction[];
}

const assetKey = (ref: ImportedAssetRef) =>
  ref.isin
    ? `isin:${ref.isin.toUpperCase()}`
    : ref.type === "crypto" && ref.ticker
      ? `crypto:${ref.ticker.toUpperCase()}`
      : `name:${ref.name.toLowerCase()}`;

export async function prepareImport(repositories: Repositories, input: ParsedImport): Promise<ImportPreview> {
  // Depósitos y retiradas no se importan: el efectivo vive en el bróker.
  const cashRows = input.transactions.filter((t) => CASH_TRANSACTION_TYPES.includes(t.type));
  const parsed: ParsedImport = {
    ...input,
    transactions: input.transactions.filter((t) => !CASH_TRANSACTION_TYPES.includes(t.type)),
    skipped: [...input.skipped, ...cashRows.map((t) => ({ line: t.line, reason: "Movimiento de efectivo" }))],
  };
  const [stored, assets] = await Promise.all([repositories.transactions.list(), repositories.assets.list()]);

  // Correcciones de dividendos importados antes: anulan el dividendo igual
  // (mismo valor, bruto y retención). Sin original no hay nada que corregir.
  const cancels: Transaction[] = [];
  const assetRef = new Map(
    assets.map((a) => [a.id, a.isin ? `isin:${a.isin.toUpperCase()}` : a.type === "crypto" && a.ticker ? `crypto:${a.ticker.toUpperCase()}` : null]),
  );
  for (const correction of input.corrections ?? []) {
    const ref = assetKey(correction.asset);
    const original = stored.find(
      (t) =>
        t.type === "dividend" &&
        !cancels.includes(t) &&
        t.assetId !== undefined &&
        assetRef.get(t.assetId) === ref &&
        new Decimal(t.quantity).times(t.price).eq(correction.gross) &&
        new Decimal(t.tax).eq(correction.tax),
    );
    if (original) cancels.push(original);
    else parsed.skipped = [...parsed.skipped, { line: correction.line, reason: "Corrección de un dividendo que no está importado" }];
  }
  parsed.skipped = [...parsed.skipped].sort((a, b) => a.line - b.line);
  const existing = stored.filter((t) => !cancels.includes(t));
  const existingHashes = await repositories.transactions.existingImportHashes(parsed.transactions.map((t) => t.importHash));

  // Operaciones registradas a mano que coinciden con una fila del archivo (mismo
  // activo por ISIN o ticker cripto, mismo día, tipo y cantidad): se dan por la misma.
  const assetById = new Map(assets.map((a) => [a.id, a]));
  const manualKeys = new Map<string, number>();
  for (const t of existing) {
    const asset = t.assetId ? assetById.get(t.assetId) : undefined;
    if (t.origin !== "manual" || !asset) continue;
    const ref = asset.isin ? `isin:${asset.isin.toUpperCase()}` : asset.type === "crypto" && asset.ticker ? `crypto:${asset.ticker.toUpperCase()}` : null;
    if (!ref) continue;
    const key = `${ref}|${t.date.slice(0, 10)}|${t.type}|${new Decimal(t.quantity).toString()}`;
    manualKeys.set(key, (manualKeys.get(key) ?? 0) + 1);
  }

  const seen = new Set<string>();
  const rows: PreviewRow[] = parsed.transactions.map((transaction) => {
    if (existingHashes.has(transaction.importHash) || seen.has(transaction.importHash)) {
      return { transaction, duplicate: true, duplicateOf: "import" };
    }
    seen.add(transaction.importHash);
    const key = transaction.asset
      ? `${assetKey(transaction.asset)}|${transaction.date.slice(0, 10)}|${transaction.type}|${new Decimal(transaction.quantity).toString()}`
      : null;
    const manual = key ? (manualKeys.get(key) ?? 0) : 0;
    if (key && manual > 0) {
      manualKeys.set(key, manual - 1);
      return { transaction, duplicate: true, duplicateOf: "manual" };
    }
    return { transaction, duplicate: false };
  });
  const fresh = rows.filter((r) => !r.duplicate).map((r) => r.transaction);

  const totals: ImportPreview["totals"] = {};
  for (const t of fresh) {
    const entry = (totals[t.type] ??= { count: 0, amount: new Decimal(0) });
    entry.count++;
    entry.amount = entry.amount.plus(transactionTotal({ ...t, id: "", origin: "csv-tr" }));
  }

  // Validación con activos provisionales: el mismo ISIN que un activo existente se une a él.
  const idByIsin = new Map<string, string>([
    ...assets.filter((a) => a.isin).map((a) => [`isin:${a.isin!.toUpperCase()}`, a.id] as const),
    ...assets
      .filter((a) => a.type === "crypto" && a.ticker)
      .map((a) => [`crypto:${a.ticker!.toUpperCase()}`, a.id] as const),
  ]);
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
  const fileProblem = parsed.problems?.[0];
  if (fileProblem) {
    problem = `${fileProblem.reason} (línea ${fileProblem.line})`;
  } else if (error) {
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
    cancels,
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

  // Cripto: llega con su ticker (BTC), sin ISIN. Se busca en CoinGecko por
  // ticker y se elige la moneda con ese símbolo (la primera es la de más capitalización).
  const ticker = ref.ticker?.toUpperCase();
  if (ref.type === "crypto" && ticker) {
    const existing = assets.find((a) => a.type === "crypto" && a.priceSource === "coingecko" && a.ticker?.toUpperCase() === ticker);
    if (existing) return existing;
    try {
      const result = await search(ticker);
      const candidate = result.crypto.find((c) => c.ticker?.toUpperCase() === ticker);
      if (candidate) return ensureAsset(repositories, { ...candidate, type: "crypto" });
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
): Promise<{ imported: number; cancelled: number }> {
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

  for (const t of current.cancels) await repositories.transactions.remove(t.id);
  await repositories.transactions.bulkAdd(
    fresh.map(({ asset, line: _line, ...t }) => ({
      ...t,
      assetId: asset ? assetIds.get(assetKey(asset)) : undefined,
      origin: current.parsed.source,
    })),
  );
  return { imported: fresh.length, cancelled: current.cancels.length };
}
