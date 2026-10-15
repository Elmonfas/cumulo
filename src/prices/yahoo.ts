import "server-only";
import Decimal from "decimal.js";
import YahooFinance from "yahoo-finance2";
import type { AssetType } from "@/domain/models";
import { fxSymbol, normalizeCurrency } from "./fx";
import type { AssetCandidate, PriceHistoryPoint, PriceQuote } from "./types";

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

interface ChartResult {
  meta: { currency?: string };
  quotes: { date: Date; close: number | null }[];
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

const isoDay = (date: Date) => date.toISOString().slice(0, 10);

async function dailyCloses(symbol: string, from: Date): Promise<{ currency: string; points: { date: string; close: Decimal }[] }> {
  const chart = (await yahoo.chart(symbol, { period1: from, interval: "1d" }, { validateResult: false })) as ChartResult;
  const points = chart.quotes
    .filter((q) => typeof q.close === "number")
    .map((q) => ({ date: isoDay(q.date), close: new Decimal(String(q.close)) }));
  return { currency: chart.meta.currency ?? "EUR", points };
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
