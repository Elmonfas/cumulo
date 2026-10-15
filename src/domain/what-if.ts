import Decimal from "decimal.js";

/**
 * "¿Y si compro?": cómo quedaría una posición tras una compra hipotética.
 * Mismas reglas que la cartera: la comisión se suma al coste.
 */
export interface WhatIfInput {
  /** Posición actual (0 si aún no la tienes). */
  quantity: Decimal;
  cost: Decimal;
  /** Valor de mercado del resto de la cartera (sin esta posición). */
  otherValue: Decimal;
  /** Precio de mercado actual del activo, para valorar la posición. */
  marketPrice: Decimal;
  /** Compra: por importe (lo que gastas, comisión incluida) o por cantidad. */
  buy: { amount: Decimal } | { quantity: Decimal };
  price: Decimal;
  fee: Decimal;
}

export interface WhatIfResult {
  addedQuantity: Decimal;
  /** Lo que pagarías, comisión incluida. */
  spent: Decimal;
  quantity: Decimal;
  cost: Decimal;
  averageCost: Decimal;
  /** Variación del precio medio (null si no tenías posición). */
  averageChange: Decimal | null;
  /** Peso de la posición en la cartera, antes y después. */
  weightBefore: Decimal | null;
  weightAfter: Decimal | null;
  /** Ganancia no realizada al precio de mercado, después de comprar. */
  unrealizedAfter: Decimal;
}

export function simulateBuy(input: WhatIfInput): WhatIfResult | null {
  const { quantity, cost, otherValue, marketPrice, price, fee } = input;
  if (!price.gt(0) || fee.isNegative()) return null;

  let addedQuantity: Decimal;
  let spent: Decimal;
  if ("amount" in input.buy) {
    if (!input.buy.amount.gt(fee)) return null;
    spent = input.buy.amount;
    addedQuantity = input.buy.amount.minus(fee).div(price);
  } else {
    if (!input.buy.quantity.gt(0)) return null;
    addedQuantity = input.buy.quantity;
    spent = input.buy.quantity.times(price).plus(fee);
  }

  const newQuantity = quantity.plus(addedQuantity);
  const newCost = cost.plus(spent);
  const averageCost = newCost.div(newQuantity);
  const valueBefore = quantity.times(marketPrice);
  const valueAfter = newQuantity.times(marketPrice);
  const totalBefore = otherValue.plus(valueBefore);
  const totalAfter = otherValue.plus(valueAfter);

  return {
    addedQuantity,
    spent,
    quantity: newQuantity,
    cost: newCost,
    averageCost,
    averageChange: quantity.gt(0) ? averageCost.div(cost.div(quantity)).minus(1) : null,
    weightBefore: totalBefore.gt(0) ? valueBefore.div(totalBefore) : null,
    weightAfter: totalAfter.gt(0) ? valueAfter.div(totalAfter) : null,
    unrealizedAfter: valueAfter.minus(newCost),
  };
}
