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

const NAME_MAX = 24;
/** Coletillas que no ayudan a reconocer el activo en una notificación. */
const NOISE = /^(ucits|etf|etc|acc|accumulating|accumulation|dist|distributing|inc|usd|eur|gbp|hedged|plc|sa|s\.a\.|ag|nv|se|corp|corporation|ltd|class|[a-z])$/i;

/**
 * Nombre corto para la notificación: sin paréntesis ni coletillas de fondo
 * («UCITS ETF USD Acc») y, si aún es largo, cortado por palabras con «…».
 */
export function shortAssetName(name: string, max = NAME_MAX): string {
  const words = name.replace(/\([^)]*\)/g, " ").split(/\s+/).filter(Boolean);
  const ucits = words.findIndex((w) => /^ucits$/i.test(w));
  const kept = ucits > 0 ? words.slice(0, ucits) : words;
  while (kept.length > 1 && (NOISE.test(kept.at(-1)!) || /^[-–·,]$/.test(kept.at(-1)!))) kept.pop();
  const clean = kept.join(" ") || name.trim();
  if (clean.length <= max) return clean;
  let cut = "";
  for (const word of clean.split(" ")) {
    if ((cut ? cut.length + 1 : 0) + word.length > max - 1) break;
    cut = cut ? `${cut} ${word}` : word;
  }
  return `${(cut || clean.slice(0, max - 1)).replace(/[\s,.\-–·]+$/, "")}…`;
}

/** Una sola línea, como cualquier app: «Bitcoin ha subido de 80.000,00 €». */
export function alertMessage(alert: Pick<PriceAlert, "direction" | "price">, assetName: string) {
  return {
    title: `${shortAssetName(assetName)} ${alert.direction === "above" ? "ha subido de" : "ha bajado de"} ${formatCurrency(alert.price, { reveal: true })}`,
    body: "",
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
    const { title, body } = alertMessage(alert, asset?.name ?? "Un activo");
    await notify(title, body, `alert-${alert.id}`);
    triggered.push({ alert, asset, price });
  }
  return triggered;
}
