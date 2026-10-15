import Decimal from "decimal.js";
import type { PriceAlert } from "./models";

/** ¿Se cumple la alerta con este precio? "Sube de" incluye el propio precio; "baja de", también. */
export function isAlertMet(alert: Pick<PriceAlert, "direction" | "price">, price: Decimal): boolean {
  return alert.direction === "above" ? price.gte(alert.price) : price.lte(alert.price);
}

/** Alertas activas que se cumplen con los precios dados. */
export function dueAlerts(alerts: readonly PriceAlert[], prices: ReadonlyMap<string, Decimal>): { alert: PriceAlert; price: Decimal }[] {
  const due: { alert: PriceAlert; price: Decimal }[] = [];
  for (const alert of alerts) {
    if (alert.triggeredAt) continue;
    const price = prices.get(alert.assetId);
    if (price && isAlertMet(alert, price)) due.push({ alert, price });
  }
  return due;
}
