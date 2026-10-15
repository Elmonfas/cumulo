import { formatDate, formatTime, todayIso } from "./format";

/**
 * Texto sobre lo recientes que son los precios.
 *
 * La hora de cada precio es la de la cotización en la fuente, no la de la
 * petición: con la bolsa cerrada, el último precio es el del cierre y no
 * cambia hasta que vuelve a abrir, aunque la app pregunte cada 30 s.
 */

export interface QuoteInfo {
  /** Ticker o nombre corto. */
  label: string;
  /** Hora de la cotización (ISO). */
  updatedAt: string;
}

/** Más antigua que esto se considera "con el cierre" (mercado cerrado o sin negociar). */
export const LIVE_WINDOW_MS = 30 * 60_000;

/** "de las 17:35" (hoy) o "del 15 oct 2026, 17:35". */
function fromWhen(iso: string, now: Date) {
  const date = new Date(iso);
  const day = todayIso(date);
  return day === todayIso(now) ? `de las ${formatTime(date)}` : `del ${formatDate(day)}, ${formatTime(date)}`;
}

function names(labels: string[]) {
  const unique = [...new Set(labels)];
  if (unique.length <= 2) return unique.join(" y ");
  if (unique.length === 3) return `${unique[0]}, ${unique[1]} y ${unique[2]}`;
  return `${unique.slice(0, 2).join(", ")} y ${unique.length - 2} más`;
}

export function describeFreshness(quotes: readonly QuoteInfo[], now = new Date()): string | null {
  if (quotes.length === 0) return null;
  const isLive = (q: QuoteInfo) => now.getTime() - new Date(q.updatedAt).getTime() < LIVE_WINDOW_MS;
  const live = quotes.filter(isLive);
  const closed = quotes.filter((q) => !isLive(q));

  if (closed.length === 0) return "Precios al momento";

  // Una sola hora solo si todos cerraron a la vez (± 10 min); si no, cada uno con su cierre.
  const times = closed.map((q) => new Date(q.updatedAt).getTime()).sort((a, b) => a - b);
  const sameClose = times[times.length - 1] - times[0] <= 10 * 60_000;
  const lastPrice = sameClose ? `el último precio ${fromWhen(new Date(times[times.length - 1]).toISOString(), now)}` : "su último precio de cierre";
  const closedText =
    closed.length === quotes.length
      ? `Mercados cerrados: ${lastPrice}`
      : `${names(closed.map((q) => q.label))} con ${lastPrice} (su mercado está cerrado)`;

  return live.length > 0 ? `${closedText} · ${names(live.map((q) => q.label))} al momento` : closedText;
}
