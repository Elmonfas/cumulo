import Decimal from "decimal.js";
import type { AssetType } from "@/domain/models";
import { readCsv } from "../csv";
import { importHash } from "../hash";
import {
  UnrecognizedFormatError,
  type ImportedAssetRef,
  type ImportedCorrection,
  type ImportedTransaction,
  type ParsedImport,
} from "../types";

/**
 * Parser de la "Exportación de transacciones" de Trade Republic.
 *
 * El formato y el significado de cada combinación category/type están en
 * docs/trade-republic-csv.md (fuentes: exportación real española, tests y
 * foro de Portfolio Performance). Resumen de signos: `amount` es el bruto
 * con signo de caja, `fee` y `tax` llegan en negativo cuando se cobran y
 * `shares` es negativo en ventas y salidas.
 *
 * Qué se importa:
 * - TRADING/BUY y SELL (cualquier clase; los planes de inversión y el
 *   Saveback invertido llegan como BUY) y CASH/PRIVATE_MARKET_BUY/SELL.
 *   Precio = |amount| / |shares|, así el coste cuadra al céntimo con TR.
 * - CASH/DIVIDEND y DISTRIBUTION → dividendo: bruto = amount, retención =
 *   −tax. Con amount negativo es una corrección que anula el dividendo igual
 *   (del archivo o, si no está, de uno ya importado).
 * - CASH/INTEREST_PAYMENT → interés (de la cuenta o cupón de un bono).
 * - CASH/FINAL_MATURITY y TILG → venta de lo amortizado al importe cobrado.
 * - DELIVERY/FREE_RECEIPT (staking) → compra a valor de mercado más un
 *   interés por ese mismo valor: en España es rendimiento del capital
 *   mobiliario y ese valor pasa a ser el coste.
 * - DELIVERY/MIGRATION llega en parejas que se anulan; una suelta es un error.
 *
 * Se omiten, con su motivo: movimientos de efectivo, la fiscalidad alemana
 * (Vorabpauschale y ajustes), las acciones corporativas informativas, los
 * desdoblamientos y devoluciones de capital (no soportados), la cuenta
 * JUNIOR (es de otra persona) y cualquier tipo desconocido.
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

/** Efectivo que no es de la cartera: la cuenta vive en el bróker. */
const CASH_MOVEMENTS = new Set([
  "TRANSFER_INSTANT_INBOUND",
  "TRANSFER_INBOUND",
  "TRANSFER_IN",
  "TRANSFER_INSTANT_OUTBOUND",
  "TRANSFER_OUTBOUND",
  "TRANSFER_OUT",
  "TRANSFER_DIRECT_DEBIT_INBOUND",
  "CUSTOMER_INBOUND",
  "CUSTOMER_INPAYMENT",
  "CUSTOMER_INPAYMENT_REVERSAL",
  "CUSTOMER_OUTBOUND_REQUEST",
  "VIBAN_TRANSFER_INBOUND",
  "VIBAN_TRANSFER_OUTBOUND",
  "GENERAL_INBOUND",
  "MANUAL_CASH_TRANSFER",
  "CARD_TRANSACTION",
  "CARD_TRANSACTION_INTERNATIONAL",
  "CARD_TRANSACTION_REFUND",
  "CARD_TRANSACTION_REFUND_REVERSAL",
  "CARD_ORDERING_FEE",
  "PAYMENT",
  "GIFT",
]);
/** Fiscalidad alemana: no aplica a un residente en España. */
const GERMAN_TAX = new Set(["EARNINGS", "PRE_DETERMINED_TAX_BASE", "SEC_ACCOUNT", "TAX_OPTIMIZATION"]);

const REASONS = {
  cash: "Movimiento de efectivo",
  saveback: "Saveback en efectivo (su compra llega aparte)",
  germanTax: "Fiscalidad alemana (no aplica en España)",
  migration: "Traspaso interno de Trade Republic",
  corporateInfo: "Acción corporativa informativa (el importe llega en otra fila)",
  split: "Desdoblamiento (split): no soportado todavía",
  capitalReturn: "Devolución de capital: no soportada todavía",
  junior: "Cuenta junior (es de otra persona)",
  correctedPair: "Dividendo anulado por una corrección del mismo archivo",
  correctionApplied: "Corrección de un dividendo del mismo archivo",
} as const;

const abs = (value: string | undefined) => {
  const text = (value ?? "").trim();
  return text ? new Decimal(text).abs() : new Decimal(0);
};
const signed = (value: string | undefined) => {
  const text = (value ?? "").trim();
  return text ? new Decimal(text) : new Decimal(0);
};

type Row = Record<string, string>;

function assetOf(row: Row): ImportedAssetRef {
  const symbol = row.symbol?.trim().toUpperCase() ?? "";
  const isin = ISIN.test(symbol) ? symbol : undefined;
  return {
    name: row.name?.trim() || symbol || "Activo",
    isin,
    ticker: isin ? undefined : symbol || undefined,
    type: ASSET_CLASS[row.asset_class?.trim().toUpperCase() ?? ""] ?? "other",
  };
}

/** País que retiene: el del ISIN del valor; sin valor (intereses de la cuenta), España. */
const withholdingCountryOf = (asset: ImportedAssetRef | undefined) => asset?.isin?.slice(0, 2) ?? "ES";

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
  const problems: NonNullable<ParsedImport["problems"]> = [];
  const corrections: (ImportedCorrection & { key: string })[] = [];
  const migrations = new Map<string, { lines: number[]; shares: Decimal }>();
  /** Participaciones de las acciones corporativas de amortización, por valor y día. */
  const redeemedShares = new Map<string, Decimal>();
  for (const row of table.rows) {
    const category = row.category?.trim().toUpperCase();
    const type = row.type?.trim().toUpperCase();
    if (category === "CORPORATE_ACTION" && (type === "REDEMPTION" || type === "FINAL_MATURITY" || type === "WARRANT_EXERCISE")) {
      redeemedShares.set(`${row.symbol?.trim().toUpperCase()}|${row.date?.trim()}`, abs(row.shares));
    }
  }

  const hash = (row: Row, suffix = "") =>
    row.transaction_id?.trim()
      ? importHash(["tr", row.transaction_id.trim() + suffix], 1)
      : importHash(["tr", row.date, row.category, row.type, row.symbol, row.shares, row.amount, row.datetime, suffix], 1);

  for (const [index, row] of table.rows.entries()) {
    const line = index + 2;
    const category = row.category?.trim().toUpperCase() ?? "";
    const type = row.type?.trim().toUpperCase() ?? "";
    const date = row.date?.trim() ?? "";
    const currency = row.currency?.trim().toUpperCase() || "EUR";
    const skip = (reason: string) => skipped.push({ line, reason });

    if (row.account_type?.trim().toUpperCase() === "JUNIOR") {
      skip(REASONS.junior);
      continue;
    }

    let shares: Decimal;
    let amount: Decimal;
    let fee: Decimal;
    let tax: Decimal;
    try {
      shares = signed(row.shares);
      amount = signed(row.amount);
      fee = abs(row.fee);
      tax = abs(row.tax);
    } catch {
      skip("Cantidad o importe no válidos");
      continue;
    }

    // Movimientos que nunca son de la cartera.
    if (category === "CASH" && CASH_MOVEMENTS.has(type)) {
      skip(REASONS.cash);
      continue;
    }
    if (category === "CASH" && type === "BENEFITS_SAVEBACK") {
      skip(REASONS.saveback);
      continue;
    }
    if (category === "CASH" && GERMAN_TAX.has(type)) {
      skip(REASONS.germanTax);
      continue;
    }
    if (category === "DELIVERY" && type === "MIGRATION") {
      const key = `${row.symbol?.trim().toUpperCase()}|${row.datetime?.trim() || date}`;
      const entry = migrations.get(key) ?? { lines: [], shares: new Decimal(0) };
      entry.lines.push(line);
      entry.shares = entry.shares.plus(shares);
      migrations.set(key, entry);
      skip(REASONS.migration);
      continue;
    }
    if (category === "CORPORATE_ACTION") {
      if (type === "SPLIT") skip(REASONS.split);
      else if (type === "REDEMPTION" || type === "FINAL_MATURITY" || type === "WARRANT_EXERCISE") skip(REASONS.corporateInfo);
      else skip(`Tipo no soportado todavía (${category}/${type})`);
      continue;
    }
    if (category === "CASH" && type === "DIVIDEND_EQUIVALENT_PAYMENT") {
      skip(REASONS.capitalReturn);
      continue;
    }

    if (!DATE.test(date)) {
      skip("Fila sin fecha válida");
      continue;
    }
    if (currency !== "EUR") {
      skip(`Divisa no soportada (${currency})`);
      continue;
    }

    const asset = assetOf(row);
    const base = { date, fee: fee.toString(), tax: tax.toString(), line };

    // Compras y ventas.
    const tradeType =
      (category === "TRADING" && type === "BUY") || (category === "CASH" && type === "PRIVATE_MARKET_BUY")
        ? "buy"
        : (category === "TRADING" && type === "SELL") || (category === "CASH" && type === "PRIVATE_MARKET_SELL")
          ? "sell"
          : null;
    if (tradeType) {
      if (shares.isZero() || amount.isZero()) {
        skip("Fila incompleta (cantidad o importe)");
        continue;
      }
      transactions.push({
        ...base,
        type: tradeType,
        quantity: shares.abs().toString(),
        price: amount.abs().div(shares.abs()).toDecimalPlaces(10, Decimal.ROUND_HALF_UP).toString(),
        asset,
        importHash: await hash(row),
      });
      continue;
    }

    // Amortización de bonos y ejercicio de derivados: venta al importe cobrado.
    if (category === "CASH" && (type === "FINAL_MATURITY" || type === "TILG")) {
      const qty = redeemedShares.get(`${row.symbol?.trim().toUpperCase()}|${date}`) ?? shares.abs();
      if (qty.isZero() || amount.lte(0)) {
        skip("Fila incompleta (cantidad o importe)");
        continue;
      }
      transactions.push({
        ...base,
        type: "sell",
        quantity: qty.toString(),
        price: amount.div(qty).toDecimalPlaces(10, Decimal.ROUND_HALF_UP).toString(),
        asset,
        importHash: await hash(row),
      });
      continue;
    }

    // Dividendos (y sus correcciones).
    if (category === "CASH" && (type === "DIVIDEND" || type === "DISTRIBUTION")) {
      if (amount.isNegative()) {
        const key = `${asset.isin ?? asset.ticker}|${amount.abs()}|${tax}`;
        corrections.push({ key, line, asset, gross: amount.abs().toString(), tax: tax.toString() });
        continue;
      }
      if (amount.isZero()) {
        skip("Dividendo sin importe");
        continue;
      }
      transactions.push({
        ...base,
        type: "dividend",
        quantity: "1",
        price: amount.toString(),
        asset,
        withholdingCountry: withholdingCountryOf(asset),
        importHash: await hash(row),
      });
      continue;
    }

    // Intereses de la cuenta y cupones.
    if (category === "CASH" && type === "INTEREST_PAYMENT") {
      if (amount.lte(0)) {
        skip("Interés sin importe");
        continue;
      }
      const isSecurity = Boolean(row.symbol?.trim());
      transactions.push({
        ...base,
        type: "interest",
        quantity: "1",
        price: amount.toString(),
        asset: isSecurity ? asset : undefined,
        withholdingCountry: withholdingCountryOf(isSecurity ? asset : undefined),
        importHash: await hash(row),
      });
      continue;
    }

    // Entregas gratuitas (staking): compra a valor de mercado e ingreso por ese valor.
    if (category === "DELIVERY" && type === "FREE_RECEIPT") {
      const price = abs(row.price);
      if (shares.lte(0) || price.isZero()) {
        skip("Entrega sin cantidad o precio");
        continue;
      }
      const value = shares.times(price).toDecimalPlaces(2, Decimal.ROUND_HALF_UP);
      transactions.push({
        ...base,
        fee: "0",
        tax: "0",
        type: "buy",
        quantity: shares.toString(),
        price: price.toString(),
        asset,
        importHash: await hash(row, ":compra"),
      });
      transactions.push({
        ...base,
        fee: "0",
        tax: "0",
        type: "interest",
        quantity: "1",
        price: value.toString(),
        asset,
        importHash: await hash(row, ":renta"),
      });
      continue;
    }

    skip(`Tipo no soportado todavía (${category || "?"}/${type || "?"})`);
  }

  // Los traspasos internos deben anularse por parejas.
  for (const { lines, shares } of migrations.values()) {
    if (lines.length % 2 !== 0 || !shares.isZero()) {
      problems.push({ line: lines[0], reason: "Traspaso interno de Trade Republic sin su pareja: revisa el archivo." });
    }
  }

  // Las correcciones anulan el dividendo igual del mismo archivo; las que no lo encuentran se resuelven contra lo ya importado.
  const pending: ImportedCorrection[] = [];
  for (const correction of corrections) {
    const index = transactions.findIndex(
      (t) => t.type === "dividend" && `${t.asset?.isin ?? t.asset?.ticker}|${t.price}|${t.tax}` === correction.key,
    );
    if (index >= 0) {
      skipped.push({ line: transactions[index].line, reason: REASONS.correctedPair });
      skipped.push({ line: correction.line, reason: REASONS.correctionApplied });
      transactions.splice(index, 1);
    } else {
      const { key: _key, ...rest } = correction;
      pending.push(rest);
    }
  }

  skipped.sort((a, b) => a.line - b.line);
  return { source: "csv-tr", transactions, skipped, problems, corrections: pending };
}
