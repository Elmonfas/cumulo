import Decimal from "decimal.js";
import type { Repositories } from "@/data/repositories";
import { dueAlerts } from "@/domain/alerts";
import type { Asset, PriceAlert } from "@/domain/models";
import { formatCurrency } from "@/lib/format";

export async function createAlert(
  repositories: Repositories,
  assetId: string,
  direction: PriceAlert["direction"],
  price: Decimal,
): Promise<PriceAlert> {
  if (!price.gt(0)) throw new RangeError("El precio de la alerta debe ser mayor que 0.");
  return repositories.alerts.add({ assetId, direction, price: price.toString() });
}

export interface TriggeredAlert {
  alert: PriceAlert;
  asset: Asset | undefined;
  price: Decimal;
}

export type Notify = (title: string, body: string, tag: string) => void | Promise<void>;

export function alertMessage(alert: Pick<PriceAlert, "direction" | "price">, assetName: string, price: Decimal) {
  return {
    title: `${assetName} ${alert.direction === "above" ? "ha subido" : "ha bajado"}`,
    body: `Cotiza a ${formatCurrency(price)} (tu alerta: ${alert.direction === "above" ? "sube de" : "baja de"} ${formatCurrency(alert.price)}).`,
  };
}

/**
 * Comprueba las alertas activas con los últimos precios guardados, marca las
 * que se cumplen (se disparan una sola vez) y avisa de cada una.
 */
export async function checkAlerts(repositories: Repositories, notify: Notify, now = new Date()): Promise<TriggeredAlert[]> {
  const [alerts, cache, assets] = await Promise.all([
    repositories.alerts.list(),
    repositories.priceCache.list(),
    repositories.assets.list(),
  ]);
  const prices = new Map(cache.map((p) => [p.assetId, new Decimal(p.price)]));
  const byId = new Map(assets.map((a) => [a.id, a]));
  const triggered: TriggeredAlert[] = [];

  for (const { alert, price } of dueAlerts(alerts, prices)) {
    await repositories.alerts.markTriggered(alert.id, price.toString(), now.toISOString());
    const asset = byId.get(alert.assetId);
    const { title, body } = alertMessage(alert, asset?.name ?? "Un activo", price);
    await notify(title, body, `alert-${alert.id}`);
    triggered.push({ alert, asset, price });
  }
  return triggered;
}
