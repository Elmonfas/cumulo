import "server-only";
import { searchCoinGecko } from "./coingecko";
import { isIsin, yahooSymbolsForIsin } from "./openfigi";
import type { AssetCandidate, AssetSearchResponse } from "./types";
import { quoteYahoo, searchYahoo } from "./yahoo";

const settled = async <T>(promise: Promise<T>, fallback: T): Promise<T> => {
  try {
    return await promise;
  } catch {
    return fallback;
  }
};

/**
 * Busca valores (Yahoo, y OpenFIGI si la consulta es un ISIN) y criptos
 * (CoinGecko). Los valores se validan con una cotización real y se ordenan
 * poniendo primero los que cotizan en EUR.
 */
export async function searchAssets(rawQuery: string): Promise<AssetSearchResponse> {
  const query = rawQuery.trim();
  const isin = isIsin(query) ? query.toUpperCase() : undefined;

  const [yahooResults, isinSymbols, crypto] = await Promise.all([
    settled(searchYahoo(query), []),
    isin ? settled(yahooSymbolsForIsin(isin), []) : Promise.resolve([]),
    isin ? Promise.resolve([]) : settled(searchCoinGecko(query), []),
  ]);

  const bySymbol = new Map<string, AssetCandidate>();
  for (const symbol of isinSymbols) {
    bySymbol.set(symbol, { name: symbol, ticker: symbol.split(".")[0], type: "stock", priceSource: "yahoo", priceSourceId: symbol });
  }
  for (const candidate of yahooResults) {
    if (!bySymbol.has(candidate.priceSourceId)) bySymbol.set(candidate.priceSourceId, candidate);
  }

  const symbols = [...bySymbol.keys()].slice(0, 12);
  const quotes = await settled(quoteYahoo(symbols), new Map());

  const securities = symbols
    .filter((symbol) => quotes.has(symbol))
    .map((symbol, order) => {
      const base = bySymbol.get(symbol)!;
      const quote = quotes.get(symbol)!;
      const type = quote.quoteType === "ETF" || quote.quoteType === "MUTUALFUND" ? "etf" : base.type;
      return {
        order,
        candidate: {
          ...base,
          name: quote.name ?? base.name,
          type,
          isin: isin ?? base.isin,
          exchange: quote.exchange ?? base.exchange,
          currency: quote.sourceCurrency,
          priceEur: quote.price,
        } satisfies AssetCandidate,
      };
    })
    .sort((a, b) => {
      const eur = Number(b.candidate.currency === "EUR") - Number(a.candidate.currency === "EUR");
      return eur !== 0 ? eur : a.order - b.order;
    })
    .map(({ candidate }) => candidate);

  return { securities, crypto };
}
