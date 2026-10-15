import Decimal from "decimal.js";
import type { Transaction, TransactionType } from "./models";

/**
 * Cartera a partir de las operaciones.
 *
 * - Importe de una operación = cantidad × precio. Las de solo efectivo
 *   (depósito, retirada, dividendo, comisión) usan cantidad 1 y precio = importe.
 * - Compra: el coste del lote incluye comisión e impuestos.
 * - Venta: se consumen lotes por FIFO (criterio fiscal español). Ganancia
 *   realizada = importe neto (− comisión − impuestos) − coste de los lotes
 *   consumidos (proporcional si un lote se consume a medias).
 * - El coste de la posición abierta es el de los lotes que quedan, y el coste
 *   medio ponderado es ese coste entre la cantidad.
 * - No se puede vender más de lo que se tiene en esa fecha.
 */

export interface Lot {
  transactionId: string;
  date: string;
  quantity: Decimal;
  /** Coste total que queda del lote, comisiones incluidas. */
  cost: Decimal;
}

export interface Position {
  assetId: string;
  quantity: Decimal;
  /** Coste de los lotes abiertos (FIFO), con comisiones. */
  cost: Decimal;
  /** cost / quantity; 0 si la posición está cerrada. */
  averageCost: Decimal;
  realizedGain: Decimal;
  lots: Lot[];
}

export interface PortfolioState {
  /** Todas las posiciones con historial, incluidas las cerradas (cantidad 0). */
  positions: Map<string, Position>;
  cash: Decimal;
  /** Depósitos − retiradas. */
  netDeposits: Decimal;
  realizedGain: Decimal;
  /** Dividendos netos y comisiones sueltas, para el cuadre de efectivo. */
  dividends: Decimal;
  fees: Decimal;
}

export class OversellError extends Error {
  constructor(
    readonly transaction: Transaction,
    readonly available: Decimal,
  ) {
    super(
      `No se puede vender ${transaction.quantity} el ${transaction.date}: en esa fecha solo hay ${available.toString()}.`,
    );
    this.name = "OversellError";
  }
}

export class InvalidTransactionError extends Error {
  constructor(
    readonly transaction: Transaction,
    reason: string,
  ) {
    super(reason);
    this.name = "InvalidTransactionError";
  }
}

const ASSET_TYPES: TransactionType[] = ["buy", "sell"];
/** Dentro del mismo instante: primero entra el dinero, luego compras y después ventas. */
const SAME_DATE_ORDER: Record<TransactionType, number> = {
  deposit: 0,
  buy: 1,
  sell: 2,
  dividend: 3,
  fee: 4,
  withdrawal: 5,
};

export const transactionAmount = (t: Pick<Transaction, "quantity" | "price">) =>
  new Decimal(t.quantity).times(t.price);

/** Efecto de una operación en el efectivo: positivo si entra dinero. */
export function cashEffect(t: Transaction): Decimal {
  const gross = transactionAmount(t);
  const charges = new Decimal(t.fee).plus(t.tax);
  switch (t.type) {
    case "sell":
    case "dividend":
    case "deposit":
      return gross.minus(charges);
    case "buy":
    case "withdrawal":
    case "fee":
      return gross.plus(charges).negated();
  }
}

/** Orden estable para recorrer el historial. */
export function sortTransactions<T extends Transaction>(transactions: readonly T[]): T[] {
  return transactions
    .map((t, index) => ({ t, index }))
    .sort((a, b) => {
      if (a.t.date !== b.t.date) return a.t.date < b.t.date ? -1 : 1;
      const byType = SAME_DATE_ORDER[a.t.type] - SAME_DATE_ORDER[b.t.type];
      return byType !== 0 ? byType : a.index - b.index;
    })
    .map(({ t }) => t);
}

function validate(t: Transaction) {
  const quantity = new Decimal(t.quantity);
  const price = new Decimal(t.price);
  if (ASSET_TYPES.includes(t.type) && !t.assetId) {
    throw new InvalidTransactionError(t, "Las compras y ventas necesitan un activo.");
  }
  if (!quantity.isPositive() || quantity.isZero()) throw new InvalidTransactionError(t, "La cantidad debe ser mayor que 0.");
  if (price.isNegative()) throw new InvalidTransactionError(t, "El precio no puede ser negativo.");
  if (new Decimal(t.fee).isNegative() || new Decimal(t.tax).isNegative()) {
    throw new InvalidTransactionError(t, "Comisión e impuestos no pueden ser negativos.");
  }
}

export function createPortfolioState(): PortfolioState {
  return {
    positions: new Map(),
    cash: new Decimal(0),
    netDeposits: new Decimal(0),
    realizedGain: new Decimal(0),
    dividends: new Decimal(0),
    fees: new Decimal(0),
  };
}

function positionFor(state: PortfolioState, assetId: string): Position {
  let position = state.positions.get(assetId);
  if (!position) {
    position = {
      assetId,
      quantity: new Decimal(0),
      cost: new Decimal(0),
      averageCost: new Decimal(0),
      realizedGain: new Decimal(0),
      lots: [],
    };
    state.positions.set(assetId, position);
  }
  return position;
}

/**
 * Aplica una operación al estado (lo modifica). Las operaciones deben llegar
 * en el orden de `sortTransactions`.
 */
export function applyTransaction(state: PortfolioState, t: Transaction): void {
  validate(t);
  const amount = transactionAmount(t);
  const charges = new Decimal(t.fee).plus(t.tax);

  switch (t.type) {
    case "deposit":
      state.cash = state.cash.plus(amount).minus(charges);
      state.netDeposits = state.netDeposits.plus(amount);
      state.fees = state.fees.plus(charges);
      break;
    case "withdrawal":
      state.cash = state.cash.minus(amount).minus(charges);
      state.netDeposits = state.netDeposits.minus(amount);
      state.fees = state.fees.plus(charges);
      break;
    case "dividend": {
      const net = amount.minus(charges);
      state.cash = state.cash.plus(net);
      state.dividends = state.dividends.plus(net);
      break;
    }
    case "fee":
      state.cash = state.cash.minus(amount).minus(charges);
      state.fees = state.fees.plus(amount).plus(charges);
      break;
    case "buy": {
      const position = positionFor(state, t.assetId!);
      const cost = amount.plus(charges);
      position.lots.push({ transactionId: t.id, date: t.date, quantity: new Decimal(t.quantity), cost });
      position.quantity = position.quantity.plus(t.quantity);
      position.cost = position.cost.plus(cost);
      state.cash = state.cash.minus(cost);
      break;
    }
    case "sell": {
      const position = positionFor(state, t.assetId!);
      let remaining = new Decimal(t.quantity);
      if (remaining.gt(position.quantity)) throw new OversellError(t, position.quantity);

      let consumedCost = new Decimal(0);
      while (remaining.gt(0)) {
        const lot = position.lots[0];
        if (lot.quantity.lte(remaining)) {
          consumedCost = consumedCost.plus(lot.cost);
          remaining = remaining.minus(lot.quantity);
          position.lots.shift();
        } else {
          const partCost = lot.cost.times(remaining).div(lot.quantity);
          consumedCost = consumedCost.plus(partCost);
          lot.cost = lot.cost.minus(partCost);
          lot.quantity = lot.quantity.minus(remaining);
          remaining = new Decimal(0);
        }
      }

      const proceeds = amount.minus(charges);
      const gain = proceeds.minus(consumedCost);
      position.quantity = position.quantity.minus(t.quantity);
      position.cost = position.lots.reduce((sum, lot) => sum.plus(lot.cost), new Decimal(0));
      position.realizedGain = position.realizedGain.plus(gain);
      state.realizedGain = state.realizedGain.plus(gain);
      state.cash = state.cash.plus(proceeds);
      break;
    }
  }

  if (t.assetId && ASSET_TYPES.includes(t.type)) {
    const position = state.positions.get(t.assetId)!;
    position.averageCost = position.quantity.isZero() ? new Decimal(0) : position.cost.div(position.quantity);
  }
}

export function buildPortfolio(transactions: readonly Transaction[]): PortfolioState {
  const state = createPortfolioState();
  for (const t of sortTransactions(transactions)) applyTransaction(state, t);
  return state;
}

/** Posiciones con cantidad > 0. */
export function openPositions(state: PortfolioState): Position[] {
  return [...state.positions.values()].filter((p) => p.quantity.gt(0));
}

/**
 * Comprueba que un historial es coherente. Devuelve el error en vez de
 * lanzarlo para que la UI pueda mostrarlo junto al formulario.
 */
export function checkTransactions(transactions: readonly Transaction[]): OversellError | InvalidTransactionError | null {
  try {
    buildPortfolio(transactions);
    return null;
  } catch (error) {
    if (error instanceof OversellError || error instanceof InvalidTransactionError) return error;
    throw error;
  }
}
