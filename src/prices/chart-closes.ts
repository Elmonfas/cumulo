import Decimal from "decimal.js";

export interface ChartResult {
  meta: { currency?: string; regularMarketPrice?: number; regularMarketTime?: Date | string | number };
  quotes: { date: Date; close: number | null }[];
}

const isoDay = (date: Date) => date.toISOString().slice(0, 10);

/**
 * Cierres diarios de un gráfico de Yahoo. Yahoo deja a `null` el cierre de la
 * última sesión durante horas (a veces hasta la siguiente apertura); ese día
 * se completa con el último precio de mercado, o la gráfica se saltaría ayer.
 */
export function closesFromChart(chart: ChartResult): { date: string; close: Decimal }[] {
  const points = chart.quotes
    .filter((q) => typeof q.close === "number")
    .map((q) => ({ date: isoDay(new Date(q.date)), close: new Decimal(String(q.close)) }));

  const { regularMarketPrice: price, regularMarketTime: time } = chart.meta;
  if (typeof price === "number" && time !== undefined) {
    const raw = typeof time === "number" && time < 1e12 ? time * 1000 : time;
    const date = new Date(raw);
    if (!Number.isNaN(date.getTime())) {
      const day = isoDay(date);
      if (!points.length || points[points.length - 1].date < day) points.push({ date: day, close: new Decimal(String(price)) });
    }
  }
  return points;
}
