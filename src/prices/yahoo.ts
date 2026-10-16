import "server-only";
import Decimal from "decimal.js";
import YahooFinance from "yahoo-finance2";
import type { AssetType } from "@/domain/models";
import { type ChartResult, closesFromChart, convertSeries, intradayFromChart } from "./chart-closes";
import { fxSymbol, normalizeCurrency } from "./fx";
import type { AssetCandidate, IntradayRange, PriceHistoryPoint, PriceQuote } from "./types";

/**
 * Cliente de Yahoo Finance (yahoo-finance2). Es una API no oficial y gratuita:
 * sin clave, con límites de uso no publicados. Por eso todo lo que pasa por
 * aquí se cachea en el CDN y el cliente guarda el último precio conocido.
 */
const yahoo = new YahooFinance({ suppressNotices: ["yahooSurvey"] });

interface SearchQuote {
  symbol: string;
  isYahooFinance?: boolean;
  quoteType?: string;
  longname?: string;
  shortname?: string;
  exchange?: string;
  exchDisp?: string;
}

const TYPE_BY_QUOTE_TYPE: Record<string, AssetType> = {
  EQUITY: "stock",
  ETF: "etf",
  MUTUALFUND: "etf",
};

export async function searchYahoo(query: string): Promise<AssetCandidate[]> {
  const result = (await yahoo.search(query, { quotesCount: 10, newsCount: 0 }, { validateResult: false })) as {
    quotes?: SearchQuote[];
  };
  const candidates: AssetCandidate[] = [];
  for (const quote of result.quotes ?? []) {
    if (!quote.isYahooFinance || !quote.quoteType) continue;
    const type = TYPE_BY_QUOTE_TYPE[quote.quoteType];
    if (!type) continue;
    const name = quote.longname || quote.shortname || quote.symbol;
    candidates.push({
      name: String(name),
      ticker: quote.symbol.split(".")[0],
      type,
      priceSource: "yahoo",
      priceSourceId: quote.symbol,
      exchange: quote.exchDisp ?? quote.exchange,
    });
  }
  return candidates;
}

interface RawQuote {
  symbol: string;
  price: Decimal;
  currency: string;
  asOf: Date;
  name?: string;
  quoteType?: string;
  exchange?: string;
}

async function rawQuotes(symbols: string[]): Promise<Map<string, RawQuote>> {
  const map = new Map<string, RawQuote>();
  if (symbols.length === 0) return map;
  const quotes = await yahoo.quote(symbols, { return: "array" }, { validateResult: false });
  for (const q of quotes) {
    if (typeof q.regularMarketPrice !== "number") continue;
    map.set(q.symbol, {
      symbol: q.symbol,
      price: new Decimal(String(q.regularMarketPrice)),
      currency: q.currency ?? "EUR",
      asOf: q.regularMarketTime instanceof Date ? q.regularMarketTime : new Date(),
      name: q.longName ?? q.shortName,
      quoteType: q.quoteType,
      exchange: q.fullExchangeName ?? q.exchange,
    });
  }
  return map;
}

/**
 * Cambio a EUR por divisa. Se pide cada par por separado porque Yahoo devuelve
 * algunos con otro símbolo (USDEUR=X llega como "EUR=X").
 */
async function fxRates(currencies: string[]): Promise<Map<string, Decimal>> {
  const entries = await Promise.all(
    currencies.map(async (currency) => {
      const quotes = await rawQuotes([fxSymbol(currency)]);
      const [quote] = quotes.values();
      return [currency, quote?.price] as const;
    }),
  );
  return new Map(entries.filter((e): e is readonly [string, Decimal] => e[1] !== undefined));
}

/** Cotizaciones convertidas a EUR. Los símbolos sin datos no aparecen. */
export async function quoteYahoo(symbols: string[]): Promise<Map<string, PriceQuote & { name?: string; quoteType?: string; exchange?: string }>> {
  const raw = await rawQuotes(symbols);
  const normalized = new Map([...raw].map(([symbol, q]) => [symbol, { ...q, ...normalizeCurrency(q.currency, q.price) }]));

  const foreign = [...new Set([...normalized.values()].map((q) => q.currency).filter((c) => c !== "EUR"))];
  const fx = await fxRates(foreign);

  const result = new Map<string, PriceQuote & { name?: string; quoteType?: string; exchange?: string }>();
  for (const [symbol, q] of normalized) {
    const rate = q.currency === "EUR" ? new Decimal(1) : fx.get(q.currency);
    if (!rate) continue;
    result.set(symbol, {
      price: q.price.times(rate).toString(),
      currency: "EUR",
      sourceCurrency: q.currency,
      sourcePrice: q.price.toString(),
      asOf: q.asOf.toISOString(),
      name: q.name,
      quoteType: q.quoteType,
      exchange: q.exchange,
    });
  }
  return result;
}

async function dailyCloses(symbol: string, from: Date): Promise<{ currency: string; points: { date: string; close: Decimal }[] }> {
  const chart = (await yahoo.chart(symbol, { period1: from, interval: "1d" }, { validateResult: false })) as ChartResult;
  return { currency: chart.meta.currency ?? "EUR", points: closesFromChart(chart) };
}

/** Cierres diarios en EUR desde `from`. */
export async function historyYahoo(symbol: string, from: Date): Promise<PriceHistoryPoint[]> {
  const { currency: rawCurrency, points } = await dailyCloses(symbol, from);
  const { currency } = normalizeCurrency(rawCurrency, new Decimal(1));
  const divisor = normalizeCurrency(rawCurrency, new Decimal(1)).price;

  if (currency === "EUR") return points.map((p) => ({ date: p.date, close: p.close.times(divisor).toString() }));

  // Conversión con el cambio del mismo día (o el último conocido antes).
  const fx = await dailyCloses(fxSymbol(currency), new Date(from.getTime() - 7 * 86_400_000));
  const result: PriceHistoryPoint[] = [];
  let i = 0;
  let rate: Decimal | undefined;
  for (const p of points) {
    while (i < fx.points.length && fx.points[i].date <= p.date) rate = fx.points[i++].close;
    if (rate) result.push({ date: p.date, close: p.close.times(divisor).times(rate).toString() });
  }
  return result;
}

const INTRADAY: Record<IntradayRange, { interval: "5m" | "30m" | "60m"; days: number }> = {
  // 5 días hacia atrás: con el mercado cerrado (fin de semana) sigue habiendo una sesión que mostrar.
  "1D": { interval: "5m", days: 5 },
  "1W": { interval: "30m", days: 9 },
  "1M": { interval: "60m", days: 33 },
};

async function intradayChart(symbol: string, range: IntradayRange) {
  const { interval, days } = INTRADAY[range];
  const period1 = new Date(Date.now() - days * 86_400_000);
  const chart = (await yahoo.chart(symbol, { period1, interval }, { validateResult: false })) as ChartResult;
  return { currency: chart.meta.currency ?? "EUR", points: intradayFromChart(chart) };
}

/** Precios intradía en EUR con su hora exacta. */
export async function intradayYahoo(symbol: string, range: IntradayRange): Promise<PriceHistoryPoint[]> {
  const { currency: rawCurrency, points } = await intradayChart(symbol, range);
  const { currency, price: divisor } = normalizeCurrency(rawCurrency, new Decimal(1));
  const scaled = points.map((p) => ({ date: p.date, close: p.close.times(divisor) }));
  if (currency === "EUR") return scaled.map((p) => ({ date: p.date, close: p.close.toString() }));

  const fx = await intradayChart(fxSymbol(currency), range);
  return convertSeries(scaled, fx.points).map((p) => ({ date: p.date, close: p.close.toString() }));
}
