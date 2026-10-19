import Decimal from "decimal.js";
import type { AssetType } from "@/domain/models";
import { readCsv } from "../csv";
import { importHash } from "../hash";
import { UnrecognizedFormatError, type ImportedTransaction, type ParsedImport } from "../types";

/**
 * Parser de la "Exportación de transacciones" de Trade Republic (CSV oficial
 * desde abril de 2026), construido sobre un archivo real (ver fixtures/):
 *
 * - Separador ",", todo entre comillas, decimales con punto y fechas ISO.
 * - `category`/`type`: TRADING/BUY son compras; CASH son movimientos de la
 *   cuenta (no se importan: el efectivo vive en el bróker); DELIVERY/MIGRATION
 *   son traspasos internos de TR que vienen en parejas que se anulan (si se
 *   importaran parecerían una venta y una recompra).
 * - `amount` es el importe sin comisión, negativo en compras; `fee` y `tax`
 *   también llegan en negativo. El precio se guarda como |amount| / shares
 *   para que el coste cuadre al céntimo con el efectivo de TR (el `price` del
 *   archivo multiplicado por las participaciones puede diferir en décimas de
 *   céntimo por el redondeo de TR).
 * - `symbol` es el ISIN en acciones y fondos y el ticker en cripto.
 * - `transaction_id` es único y estable: es la base del hash anti-duplicados.
 * - Sin ejemplos reales todavía de ventas, dividendos o planes de ahorro: las
 *   ventas (TRADING/SELL) se leen como el reflejo de las compras y el resto
 *   se omite indicando su tipo, nunca se adivina.
 *
 * Nunca se leen ni guardan las columnas de contrapartida (nombre, IBAN…).
 */

const REQUIRED = ["date", "category", "type", "asset_class", "name", "symbol", "shares", "amount", "fee", "tax", "currency", "transaction_id"];

const ASSET_CLASS: Record<string, AssetType> = {
  STOCK: "stock",
  FUND: "etf",
  ETF: "etf",
  CRYPTO: "crypto",
};

const ISIN = /^[A-Z]{2}[A-Z0-9]{9}\d$/;
const DATE = /^\d{4}-\d{2}-\d{2}$/;

const abs = (value: string | undefined) => {
  const text = (value ?? "").trim();
  return text ? new Decimal(text).abs() : new Decimal(0);
};

export async function parseTradeRepublicCsv(text: string): Promise<ParsedImport> {
  const table = readCsv(text);
  const missing = REQUIRED.filter((c) => !table.columns.includes(c));
  if (missing.length > 0) {
    throw new UnrecognizedFormatError(
      `No parece la «Exportación de transacciones» de Trade Republic: faltan las columnas ${missing.join(", ")}.`,
      table.columns,
    );
  }

  const transactions: ImportedTransaction[] = [];
  const skipped: ParsedImport["skipped"] = [];

  for (const [index, row] of table.rows.entries()) {
    const line = index + 2;
    const category = row.category?.trim().toUpperCase() ?? "";
    const type = row.type?.trim().toUpperCase() ?? "";

    if (category === "CASH") {
      skipped.push({ line, reason: "Movimiento de efectivo" });
      continue;
    }
    if (category === "DELIVERY" && type === "MIGRATION") {
      skipped.push({ line, reason: "Traspaso interno de Trade Republic" });
      continue;
    }
    if (category !== "TRADING" || (type !== "BUY" && type !== "SELL")) {
      skipped.push({ line, reason: `Tipo no soportado todavía (${category || "?"}/${type || "?"})` });
      continue;
    }

    const date = row.date?.trim() ?? "";
    const currency = row.currency?.trim().toUpperCase();
    let shares: Decimal;
    let amount: Decimal;
    try {
      shares = abs(row.shares);
      amount = abs(row.amount);
    } catch {
      skipped.push({ line, reason: "Cantidad o importe no válidos" });
      continue;
    }
    if (!DATE.test(date) || shares.isZero() || amount.isZero()) {
      skipped.push({ line, reason: "Fila incompleta (fecha, cantidad o importe)" });
      continue;
    }
    if (currency !== "EUR") {
      skipped.push({ line, reason: `Divisa no soportada (${currency || "?"})` });
      continue;
    }

    const symbol = row.symbol?.trim().toUpperCase() ?? "";
    const assetType = ASSET_CLASS[row.asset_class?.trim().toUpperCase() ?? ""] ?? "other";
    const isin = ISIN.test(symbol) ? symbol : undefined;
    const id = row.transaction_id?.trim();

    transactions.push({
      type: type === "BUY" ? "buy" : "sell",
      date,
      quantity: shares.toString(),
      price: amount.div(shares).toDecimalPlaces(10, Decimal.ROUND_HALF_UP).toString(),
      fee: abs(row.fee).toString(),
      tax: abs(row.tax).toString(),
      asset: {
        name: row.name?.trim() || symbol || "Activo",
        isin,
        ticker: isin ? undefined : symbol || undefined,
        type: assetType,
      },
      importHash: id
        ? await importHash(["tr", id], 1)
        : await importHash(["tr", date, type, symbol, row.shares, row.amount, row.datetime], 1),
      line,
    });
  }

  return { source: "csv-tr", transactions, skipped };
}
