import Decimal from "decimal.js";
import type { PriceHistoryPoint } from "./types";

/** Diferencia máxima admitida entre dos fuentes el mismo día para darlas por el mismo activo. */
export const MAX_SOURCE_GAP = new Decimal("0.05");

/**
 * Une un histórico antiguo (otra fuente) con el reciente de la fuente
 * principal. Solo se aceptan los puntos antiguos si, en el primer día del
 * reciente (o el último anterior), ambas fuentes difieren menos de
 * `MAX_SOURCE_GAP`: así un ticker que en la otra fuente es otro activo no
 * contamina la serie.
 */
export function mergeOlderHistory(older: readonly PriceHistoryPoint[], recent: readonly PriceHistoryPoint[]): PriceHistoryPoint[] {
  if (recent.length === 0) return [...recent];
  const firstRecent = recent[0];
  const before = older.filter((p) => p.date < firstRecent.date);
  if (before.length === 0) return [...recent];

  const anchor = older.find((p) => p.date === firstRecent.date) ?? before[before.length - 1];
  const reference = new Decimal(firstRecent.close);
  if (reference.isZero()) return [...recent];
  const gap = new Decimal(anchor.close).minus(reference).abs().div(reference);
  return gap.lte(MAX_SOURCE_GAP) ? [...before, ...recent] : [...recent];
}
