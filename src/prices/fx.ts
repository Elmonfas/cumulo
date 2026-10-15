import Decimal from "decimal.js";

/**
 * Yahoo cotiza la bolsa de Londres en peniques ("GBp"/"GBX"); se normaliza a
 * la divisa principal antes de convertir.
 */
export function normalizeCurrency(currency: string | undefined, price: Decimal): { currency: string; price: Decimal } {
  if (!currency) return { currency: "EUR", price };
  if (currency === "GBp" || currency === "GBX") return { currency: "GBP", price: price.div(100) };
  if (currency === "ZAc") return { currency: "ZAR", price: price.div(100) };
  if (currency === "ILA") return { currency: "ILS", price: price.div(100) };
  return { currency: currency.toUpperCase(), price };
}

/** Símbolo de Yahoo para el cambio de una divisa a euros. */
export const fxSymbol = (currency: string) => `${currency}EUR=X`;
