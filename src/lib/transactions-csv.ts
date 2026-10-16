import Decimal from "decimal.js";
import type { Asset, Transaction } from "@/domain/models";
import { transactionTotal } from "@/domain/portfolio";
import { ASSET_TYPE_LABELS, TRANSACTION_TYPE_LABELS } from "./labels";
import { toCsv } from "./csv-export";

/** Operaciones en CSV (es-ES), en el orden recibido. */
export function transactionsCsv(transactions: readonly Transaction[], assets: ReadonlyMap<string, Asset>): string {
  const header = [
    "Fecha",
    "Tipo",
    "Activo",
    "Ticker",
    "ISIN",
    "Clase",
    "Cantidad",
    "Precio (€)",
    "Comisión (€)",
    "Impuestos/retención (€)",
    "Total (€)",
    "Origen",
  ];
  const rows = transactions.map((t) => {
    const asset = t.assetId ? assets.get(t.assetId) : undefined;
    const byAmount = t.type !== "buy" && t.type !== "sell";
    return [
      t.date.slice(0, 10),
      TRANSACTION_TYPE_LABELS[t.type],
      asset?.name,
      asset?.ticker,
      asset?.isin,
      asset ? ASSET_TYPE_LABELS[asset.type] : undefined,
      byAmount ? undefined : new Decimal(t.quantity),
      byAmount ? new Decimal(t.quantity).times(t.price) : new Decimal(t.price),
      new Decimal(t.fee),
      new Decimal(t.tax),
      transactionTotal(t).toDecimalPlaces(2),
      t.origin === "csv-tr" ? "Trade Republic" : "Manual",
    ];
  });
  return toCsv(header, rows);
}
