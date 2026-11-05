import Decimal from "decimal.js";
import type { Repositories } from "@/data/repositories";
import type { Asset, Transaction, TransactionOrigin, TransactionType } from "@/domain/models";
import { checkTransactions, OversellError } from "@/domain/portfolio";
import { formatDate, formatNumber } from "@/lib/format";
import type { AssetCandidate } from "@/prices/types";

/**
 * Casos de uso de operaciones. Validan el historial completo con el dominio
 * antes de escribir, así ninguna alta, edición o borrado deja la cartera en
 * un estado imposible (p. ej. vender más de lo que se tiene).
 */

export interface TransactionDraft {
  type: TransactionType;
  assetId?: string;
  date: string;
  quantity: string;
  price: string;
  fee: string;
  tax: string;
}

export type SaveResult = { ok: true; transaction?: Transaction } | { ok: false; message: string };

const DRAFT_ID = "__draft__";

async function describeError(repositories: Repositories, error: Error): Promise<string> {
  if (!(error instanceof OversellError)) return error.message;
  const t = error.transaction;
  const asset = t.assetId ? await repositories.assets.get(t.assetId) : undefined;
  const name = asset?.name ?? "este activo";
  const requested = formatNumber(new Decimal(t.quantity), decimalsOf(t.quantity));
  const available = formatNumber(error.available, decimalsOf(error.available.toString()));
  return error.available.isZero()
    ? `No puedes vender ${requested} de ${name}: el ${formatDate(t.date)} no tenías ninguna.`
    : `No puedes vender ${requested} de ${name}: el ${formatDate(t.date)} solo tenías ${available}.`;
}

const decimalsOf = (value: string) => Math.min(8, value.split(".")[1]?.length ?? 0);

export async function saveTransaction(
  repositories: Repositories,
  draft: TransactionDraft,
  existingId?: string,
  origin: Exclude<TransactionOrigin, "csv-tr"> = "manual",
): Promise<SaveResult> {
  const all = await repositories.transactions.list();
  const candidate: Transaction[] = existingId
    ? all.map((t) => (t.id === existingId ? { ...t, ...draft } : t))
    : [...all, { ...draft, id: DRAFT_ID, origin }];

  const error = checkTransactions(candidate);
  if (error) return { ok: false, message: await describeError(repositories, error) };

  if (existingId) {
    await repositories.transactions.update(existingId, draft);
    return { ok: true };
  }
  const transaction = await repositories.transactions.add({ ...draft, origin });
  return { ok: true, transaction };
}

export interface QuickPositionDraft {
  assetId: string;
  quantity: string;
  /** Precio medio por unidad, comisiones incluidas. */
  averagePrice: string;
  date: string;
}

/**
 * Alta rápida: lo que tienes hoy como una sola compra al precio medio. Sin
 * comisión aparte (ya va en el precio medio), así el coste cuadra con el bróker.
 */
export function saveQuickPosition(repositories: Repositories, draft: QuickPositionDraft): Promise<SaveResult> {
  return saveTransaction(
    repositories,
    { type: "buy", assetId: draft.assetId, date: draft.date, quantity: draft.quantity, price: draft.averagePrice, fee: "0", tax: "0" },
    undefined,
    "quick",
  );
}

export async function deleteTransaction(repositories: Repositories, id: string): Promise<SaveResult> {
  const all = await repositories.transactions.list();
  const error = checkTransactions(all.filter((t) => t.id !== id));
  if (error) {
    return {
      ok: false,
      message: `No se puede borrar: ${await describeError(repositories, error)} Borra o ajusta antes esa venta.`,
    };
  }
  await repositories.transactions.remove(id);
  return { ok: true };
}

/** Devuelve el activo que corresponde a un resultado del buscador, creándolo si no existe. */
export async function ensureAsset(repositories: Repositories, candidate: AssetCandidate): Promise<Asset> {
  const existing = await repositories.assets.findBySource(candidate.priceSource, candidate.priceSourceId);
  if (existing) return existing;
  return repositories.assets.add({
    name: candidate.name,
    ticker: candidate.ticker,
    isin: candidate.isin,
    type: candidate.type,
    priceSource: candidate.priceSource,
    priceSourceId: candidate.priceSourceId,
  });
}

export async function createManualAsset(
  repositories: Repositories,
  asset: Pick<Asset, "name" | "type" | "ticker" | "isin">,
): Promise<Asset> {
  return repositories.assets.add({ ...asset, priceSource: "manual", priceSourceId: "" });
}
