import Decimal from "decimal.js";
import type { AssetType, Transaction } from "./models";
import { buildPortfolio, transactionTotal, type ConsumedLot } from "./portfolio";

/**
 * Informe orientativo para la declaración de la Renta (España, base del ahorro).
 *
 * - Ganancias y pérdidas patrimoniales por FIFO (art. 37.2 LIRPF): valor de
 *   transmisión (lo cobrado, sin comisiones ni impuestos) − valor de
 *   adquisición (lo pagado, con comisiones) de los lotes vendidos.
 * - Regla de los dos meses (art. 33.5.f): la pérdida de una venta de valores
 *   cotizados (acciones y ETF) no se computa si se compraron valores
 *   homogéneos en los dos meses anteriores o posteriores; se difiere a cuando
 *   se vendan esos valores. Se aplica en proporción a lo recomprado. A la
 *   cripto no se le aplica aquí (no son valores admitidos a negociación).
 * - Dividendos e intereses: rendimientos del capital mobiliario (RCM).
 *   Íntegro = bruto; rendimiento neto = bruto − comisiones.
 * - Retenciones: solo la española (país "ES") es pago a cuenta. La retenida
 *   en el extranjero da derecho a la deducción por doble imposición
 *   internacional (art. 80 LIRPF), que es el menor de:
 *   a) el impuesto pagado fuera, limitado al tipo del convenio (15 % por
 *      defecto; tabla por país en TREATY_RATES), y
 *   b) el tipo medio del ahorro aplicado al rendimiento extranjero que
 *      queda en la base (la base no puede superarse).
 *   Lo retenido fuera por encima de esa deducción no se recupera en la
 *   declaración (lo que pase del convenio se podría reclamar en el país de
 *   origen).
 * - El país de la retención es `withholdingCountry`; si falta, el del ISIN
 *   del valor; y sin valor (intereses de la cuenta), España.
 * - Integración y compensación (art. 49): si un saldo es negativo, compensa
 *   el otro hasta el 25 %. El resto queda para los 4 años siguientes.
 * - Escala del ahorro desde 2025: 19 % hasta 6.000 €, 21 % hasta 50.000 €,
 *   23 % hasta 200.000 €, 27 % hasta 300.000 € y 30 % a partir de ahí.
 *
 * No incluye pérdidas de años anteriores ni los gastos de custodia. Es una
 * estimación, no un borrador.
 */

export const SAVINGS_BRACKETS: { upTo: Decimal | null; rate: Decimal }[] = [
  { upTo: new Decimal(6_000), rate: new Decimal("0.19") },
  { upTo: new Decimal(50_000), rate: new Decimal("0.21") },
  { upTo: new Decimal(200_000), rate: new Decimal("0.23") },
  { upTo: new Decimal(300_000), rate: new Decimal("0.27") },
  { upTo: null, rate: new Decimal("0.30") },
];

const COMPENSATION_LIMIT = new Decimal("0.25");

/** Tipo de retención en origen del convenio con España para dividendos, por país (ISO de 2 letras). */
export const DEFAULT_TREATY_RATE = new Decimal("0.15");
export const TREATY_RATES: Readonly<Record<string, Decimal>> = {};
export const treatyRate = (country: string) => TREATY_RATES[country] ?? DEFAULT_TREATY_RATE;
const WASH_SALE_TYPES: AssetType[] = ["stock", "etf"];

/** Cuota de la base del ahorro por tramos. */
export function savingsTax(base: Decimal): Decimal {
  if (base.lte(0)) return new Decimal(0);
  let tax = new Decimal(0);
  let lower = new Decimal(0);
  for (const { upTo, rate } of SAVINGS_BRACKETS) {
    const top = upTo ? Decimal.min(base, upTo) : base;
    if (top.gt(lower)) tax = tax.plus(top.minus(lower).times(rate));
    if (upTo === null || base.lte(upTo)) break;
    lower = upTo;
  }
  return tax.toDecimalPlaces(2, Decimal.ROUND_HALF_UP);
}

/** Suma `months` meses a una fecha "YYYY-MM-DD" (el día se ajusta al último del mes si no existe). */
export function addMonths(isoDay: string, months: number): string {
  const [y, m, d] = isoDay.split("-").map(Number);
  const target = new Date(Date.UTC(y, m - 1 + months, 1));
  const lastDay = new Date(Date.UTC(target.getUTCFullYear(), target.getUTCMonth() + 1, 0)).getUTCDate();
  target.setUTCDate(Math.min(d, lastDay));
  return target.toISOString().slice(0, 10);
}

export interface TaxSale {
  transactionId: string;
  assetId: string;
  date: string;
  quantity: Decimal;
  /** Valor de transmisión: cobrado sin comisiones ni impuestos. */
  proceeds: Decimal;
  /** Valor de adquisición FIFO, comisiones incluidas. */
  cost: Decimal;
  gain: Decimal;
  lots: ConsumedLot[];
  /** Parte de la pérdida que no se computa este año por la regla de los dos meses. */
  deferredLoss: Decimal;
  /** Compras que activan la regla. */
  repurchases: { date: string; quantity: Decimal }[];
}

/** Rendimiento del capital mobiliario: un dividendo o un interés. */
export interface TaxIncome {
  transactionId: string;
  kind: "dividend" | "interest";
  assetId?: string;
  date: string;
  gross: Decimal;
  withholding: Decimal;
  /** País que retuvo ("ES" = retención española). */
  country: string;
  fee: Decimal;
  net: Decimal;
}

export interface TaxReport {
  year: number;
  sales: TaxSale[];
  /** Dividendos e intereses del año. */
  dividends: TaxIncome[];
  /** Suma de ventas con ganancia. */
  gains: Decimal;
  /** Suma de ventas con pérdida (negativa), ya sin la parte diferida. */
  losses: Decimal;
  deferredLosses: Decimal;
  /** Saldo de ganancias y pérdidas patrimoniales. */
  netGains: Decimal;
  transmissionValue: Decimal;
  acquisitionValue: Decimal;
  dividendsGross: Decimal;
  interestGross: Decimal;
  /** Retenciones españolas: pagos a cuenta. */
  spanishWithholding: Decimal;
  /** Retenciones en el extranjero (todas). */
  foreignWithholding: Decimal;
  /** Saldo de rendimientos del capital mobiliario (bruto − comisiones). */
  netDividends: Decimal;
  /** Tipo medio de la base del ahorro (cuota / base). */
  averageRate: Decimal;
  /** Deducción por doble imposición internacional. */
  doubleTaxDeduction: Decimal;
  /** Retención extranjera que no se recupera en la declaración. */
  unrecoverableWithholding: Decimal;
  /** Base liquidable del ahorro tras compensar saldos. */
  savingsBase: Decimal;
  /** Saldo negativo que queda para los 4 años siguientes. */
  lossCarryForward: Decimal;
  estimatedTax: Decimal;
  /** Cuota − deducción − retenciones españolas: positivo = a pagar, negativo = a devolver (por esta parte). */
  estimatedResult: Decimal;
}

const day = (iso: string) => iso.slice(0, 10);

/** Años con ventas o dividendos, del más reciente al más antiguo. */
export function taxYears(transactions: readonly Transaction[]): number[] {
  const years = new Set(transactions.filter((t) => t.type === "sell" || t.type === "dividend" || t.type === "interest").map((t) => Number(t.date.slice(0, 4))));
  return [...years].sort((a, b) => b - a);
}

export interface TaxAssetInfo {
  type: AssetType;
  isin?: string;
}

export function taxReport(
  transactions: readonly Transaction[],
  year: number,
  assetOf: (assetId: string) => TaxAssetInfo | undefined,
): TaxReport {
  const typeOf = (id: string) => assetOf(id)?.type ?? "other";
  const state = buildPortfolio(transactions);
  const inYear = (t: Transaction) => t.date.slice(0, 4) === String(year);
  const buysByAsset = new Map<string, Transaction[]>();
  for (const t of transactions) {
    if (t.type === "buy" && t.assetId) buysByAsset.set(t.assetId, [...(buysByAsset.get(t.assetId) ?? []), t]);
  }

  const sales: TaxSale[] = transactions
    .filter((t) => t.type === "sell" && inYear(t))
    .map((t) => {
      const sale = state.sales.get(t.id)!;
      const quantity = new Decimal(t.quantity);
      let deferredLoss = new Decimal(0);
      let repurchases: TaxSale["repurchases"] = [];
      if (sale.gain.isNegative() && WASH_SALE_TYPES.includes(typeOf(sale.assetId))) {
        const date = day(t.date);
        const from = addMonths(date, -2);
        const to = addMonths(date, 2);
        const soldLots = new Set(sale.consumed.map((l) => l.transactionId));
        repurchases = (buysByAsset.get(sale.assetId) ?? [])
          .filter((b) => !soldLots.has(b.id) && day(b.date) >= from && day(b.date) <= to)
          .map((b) => ({ date: day(b.date), quantity: new Decimal(b.quantity) }));
        const repurchased = repurchases.reduce((sum, r) => sum.plus(r.quantity), new Decimal(0));
        if (repurchased.gt(0)) deferredLoss = sale.gain.times(Decimal.min(1, repurchased.div(quantity)));
      }
      return {
        transactionId: t.id,
        assetId: sale.assetId,
        date: day(t.date),
        quantity,
        proceeds: sale.proceeds,
        cost: sale.cost,
        gain: sale.gain,
        lots: sale.consumed,
        deferredLoss,
        repurchases,
      };
    })
    .sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));

  const dividends: TaxIncome[] = transactions
    .filter((t) => (t.type === "dividend" || t.type === "interest") && inYear(t))
    .map((t) => {
      const gross = new Decimal(t.quantity).times(t.price);
      const isin = t.assetId ? assetOf(t.assetId)?.isin : undefined;
      return {
        transactionId: t.id,
        kind: t.type === "interest" ? ("interest" as const) : ("dividend" as const),
        assetId: t.assetId,
        date: day(t.date),
        gross,
        withholding: new Decimal(t.tax),
        country: (t.withholdingCountry ?? isin?.slice(0, 2) ?? "ES").toUpperCase(),
        fee: new Decimal(t.fee),
        net: transactionTotal(t),
      };
    })
    .sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));

  const zero = new Decimal(0);
  const sum = <T>(items: T[], pick: (item: T) => Decimal) => items.reduce((s, i) => s.plus(pick(i)), zero);

  const gains = sum(sales.filter((s) => s.gain.gt(0)), (s) => s.gain);
  const deferredLosses = sum(sales, (s) => s.deferredLoss);
  const losses = sum(sales.filter((s) => s.gain.isNegative()), (s) => s.gain).minus(deferredLosses);
  const netGains = gains.plus(losses);
  const dividendsGross = sum(dividends.filter((d) => d.kind === "dividend"), (d) => d.gross);
  const interestGross = sum(dividends.filter((d) => d.kind === "interest"), (d) => d.gross);
  const spanish = dividends.filter((d) => d.country === "ES");
  const foreign = dividends.filter((d) => d.country !== "ES");
  const spanishWithholding = sum(spanish, (d) => d.withholding);
  const foreignWithholding = sum(foreign, (d) => d.withholding);
  const netDividends = sum(dividends, (d) => d.gross.minus(d.fee));

  // Integración y compensación de la base del ahorro (art. 49 LIRPF).
  let savingsBase: Decimal;
  let lossCarryForward = zero;
  if (netGains.isNegative() && netDividends.gt(0)) {
    const offset = Decimal.min(netGains.negated(), netDividends.times(COMPENSATION_LIMIT));
    savingsBase = netDividends.minus(offset);
    lossCarryForward = netGains.negated().minus(offset);
  } else if (netDividends.isNegative() && netGains.gt(0)) {
    const offset = Decimal.min(netDividends.negated(), netGains.times(COMPENSATION_LIMIT));
    savingsBase = netGains.minus(offset);
    lossCarryForward = netDividends.negated().minus(offset);
  } else {
    savingsBase = Decimal.max(netGains, zero).plus(Decimal.max(netDividends, zero));
    lossCarryForward = Decimal.max(netGains.negated(), zero).plus(Decimal.max(netDividends.negated(), zero));
  }

  const estimatedTax = savingsTax(savingsBase);

  // Doble imposición internacional (art. 80 LIRPF).
  const averageRate = savingsBase.gt(0) ? estimatedTax.div(savingsBase) : zero;
  const foreignLimited = sum(foreign, (d) => Decimal.min(d.withholding, d.gross.times(treatyRate(d.country))));
  const foreignIncome = Decimal.min(Decimal.max(sum(foreign, (d) => d.gross.minus(d.fee)), zero), savingsBase);
  const doubleTaxDeduction = Decimal.min(foreignLimited, foreignIncome.times(averageRate)).toDecimalPlaces(2, Decimal.ROUND_HALF_UP);
  return {
    year,
    sales,
    dividends,
    gains,
    losses,
    deferredLosses,
    netGains,
    transmissionValue: sum(sales, (s) => s.proceeds),
    acquisitionValue: sum(sales, (s) => s.cost),
    dividendsGross,
    interestGross,
    spanishWithholding,
    foreignWithholding,
    netDividends,
    averageRate,
    doubleTaxDeduction,
    unrecoverableWithholding: foreignWithholding.minus(doubleTaxDeduction),
    savingsBase,
    lossCarryForward,
    estimatedTax,
    estimatedResult: estimatedTax.minus(doubleTaxDeduction).minus(spanishWithholding),
  };
}
