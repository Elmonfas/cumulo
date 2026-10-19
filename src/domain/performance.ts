import Decimal from "decimal.js";
import type { Transaction } from "./models";
import { transactionTotal, type PortfolioState } from "./portfolio";
import { annualize, daysBetween, xirr, type CashFlow } from "./returns";

/** Detalle de una compra concreta: lo que queda de ella (FIFO) y lo que vale hoy. */
export interface BuyDetail {
  kind: "buy";
  /** Lo pagado, comisiones incluidas. */
  cost: Decimal;
  quantity: Decimal;
  /** Lo que queda sin vender de esta compra. */
  remainingQuantity: Decimal;
  soldQuantity: Decimal;
  remainingCost: Decimal;
  currentValue: Decimal | null;
  gain: Decimal | null;
  gainPct: Decimal | null;
  daysHeld: number;
  /** null por debajo de un año. */
  annualized: Decimal | null;
}

/** Detalle de una venta concreta. */
export interface SellDetail {
  kind: "sell";
  /** Lo cobrado, sin comisiones ni impuestos. */
  proceeds: Decimal;
  /** Coste FIFO de lo vendido. */
  cost: Decimal;
  gain: Decimal;
  gainPct: Decimal | null;
}

export function buyDetail(state: PortfolioState, t: Transaction, price: Decimal | null, today: string): BuyDetail {
  const lot = t.assetId ? state.positions.get(t.assetId)?.lots.find((l) => l.transactionId === t.id) : undefined;
  const quantity = new Decimal(t.quantity);
  const remainingQuantity = lot?.quantity ?? new Decimal(0);
  const remainingCost = lot?.cost ?? new Decimal(0);
  const currentValue = price && remainingQuantity.gt(0) ? remainingQuantity.times(price) : null;
  const gain = currentValue ? currentValue.minus(remainingCost) : null;
  const gainPct = gain && remainingCost.gt(0) ? gain.div(remainingCost) : null;
  const daysHeld = daysBetween(t.date, today);
  return {
    kind: "buy",
    cost: transactionTotal(t),
    quantity,
    remainingQuantity,
    soldQuantity: quantity.minus(remainingQuantity),
    remainingCost,
    currentValue,
    gain,
    gainPct,
    daysHeld,
    annualized: gainPct ? annualize(gainPct, daysHeld) : null,
  };
}

export function sellDetail(state: PortfolioState, t: Transaction): SellDetail | null {
  const sale = state.sales.get(t.id);
  if (!sale) return null;
  return {
    kind: "sell",
    proceeds: sale.proceeds,
    cost: sale.cost,
    gain: sale.gain,
    gainPct: sale.cost.gt(0) ? sale.gain.div(sale.cost) : null,
  };
}

/** Flujos para la TIR: compras salen; ventas, dividendos e intereses netos y el valor actual (hoy) entran. */
export function cashFlows(transactions: readonly Transaction[], currentValue: Decimal, today: string): CashFlow[] {
  const flows: CashFlow[] = [];
  for (const t of transactions) {
    if (t.type === "buy") flows.push({ date: t.date.slice(0, 10), amount: transactionTotal(t).negated() });
    else if (t.type === "sell" || t.type === "dividend" || t.type === "interest") flows.push({ date: t.date.slice(0, 10), amount: transactionTotal(t) });
  }
  if (currentValue.gt(0)) flows.push({ date: today, amount: currentValue });
  return flows;
}

/** Rentabilidad anual (TIR) de un conjunto de operaciones; null por debajo de un año. */
export function annualReturn(transactions: readonly Transaction[], currentValue: Decimal, today: string): Decimal | null {
  return xirr(cashFlows(transactions, currentValue, today));
}
