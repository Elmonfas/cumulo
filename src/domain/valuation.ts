import Decimal from "decimal.js";
import { openPositions, type PortfolioState, type Position } from "./portfolio";

/**
 * Valoración de la cartera con precios (rentabilidad simple, V1).
 *
 * - Valor de mercado = cantidad × precio de cada posición con precio.
 * - No realizado = valor de mercado − coste de las posiciones abiertas.
 * - El valor de la cartera es solo el de las posiciones abiertas: el
 *   efectivo vive en el bróker. Lo cobrado en ventas se muestra aparte.
 * - Una posición sin precio no suma valor ni plusvalía: se cuenta aparte.
 */

export interface PositionValuation {
  position: Position;
  price: Decimal | null;
  marketValue: Decimal | null;
  unrealized: Decimal | null;
  /** unrealized / coste; null sin precio o con coste 0. */
  unrealizedPct: Decimal | null;
  /** Peso sobre el valor de mercado de las posiciones con precio. */
  weight: Decimal | null;
}

export interface PortfolioValuation {
  positions: PositionValuation[];
  /** Coste de las posiciones abiertas. */
  invested: Decimal;
  /** Coste de las posiciones abiertas que tienen precio. */
  pricedCost: Decimal;
  marketValue: Decimal;
  unrealized: Decimal;
  unrealizedPct: Decimal | null;
  realized: Decimal;
  /** Total cobrado en ventas. */
  saleProceeds: Decimal;
  /** Valor de la cartera: valor de mercado de las posiciones abiertas. */
  totalValue: Decimal;
  /** No realizado + realizado + dividendos − comisiones sueltas. */
  totalGain: Decimal;
  missingPrices: number;
}

export function valuePortfolio(state: PortfolioState, prices: ReadonlyMap<string, Decimal>): PortfolioValuation {
  const open = openPositions(state);
  let marketValue = new Decimal(0);
  let pricedCost = new Decimal(0);
  let invested = new Decimal(0);
  let missingPrices = 0;

  const partial = open.map((position) => {
    invested = invested.plus(position.cost);
    const price = prices.get(position.assetId) ?? null;
    if (!price) {
      missingPrices++;
      return { position, price: null, marketValue: null, unrealized: null, unrealizedPct: null };
    }
    const value = position.quantity.times(price);
    const unrealized = value.minus(position.cost);
    marketValue = marketValue.plus(value);
    pricedCost = pricedCost.plus(position.cost);
    return {
      position,
      price,
      marketValue: value,
      unrealized,
      unrealizedPct: position.cost.isZero() ? null : unrealized.div(position.cost),
    };
  });

  const positions: PositionValuation[] = partial
    .map((p) => ({ ...p, weight: p.marketValue && !marketValue.isZero() ? p.marketValue.div(marketValue) : null }))
    .sort((a, b) => (b.marketValue ?? b.position.cost).comparedTo(a.marketValue ?? a.position.cost));

  const unrealized = marketValue.minus(pricedCost);
  return {
    positions,
    invested,
    pricedCost,
    marketValue,
    unrealized,
    unrealizedPct: pricedCost.isZero() ? null : unrealized.div(pricedCost),
    realized: state.realizedGain,
    saleProceeds: state.saleProceeds,
    totalValue: marketValue,
    totalGain: unrealized.plus(state.realizedGain).plus(state.dividends).minus(state.fees),
    missingPrices,
  };
}
