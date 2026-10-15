import type { AssetType, TransactionType } from "@/domain/models";

export const ASSET_TYPE_LABELS: Record<AssetType, string> = {
  stock: "Acción",
  etf: "ETF",
  crypto: "Cripto",
  other: "Otro",
};

export const TRANSACTION_TYPE_LABELS: Record<TransactionType, string> = {
  buy: "Compra",
  sell: "Venta",
  deposit: "Depósito",
  withdrawal: "Retirada",
  dividend: "Dividendo",
  fee: "Comisión",
};

/** Tipos que se pueden registrar a mano en la V1. */
export const MANUAL_TRANSACTION_TYPES: TransactionType[] = ["buy", "sell", "deposit", "withdrawal"];

export const isAssetTransaction = (type: TransactionType) => type === "buy" || type === "sell";
