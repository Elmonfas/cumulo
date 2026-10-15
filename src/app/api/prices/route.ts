import { NextResponse, type NextRequest } from "next/server";
import { quoteCoinGecko } from "@/prices/coingecko";
import { parsePriceKey, priceKey, type PriceQuote, type PricesResponse } from "@/prices/types";
import { quoteYahoo } from "@/prices/yahoo";

const MAX_KEYS = 50;

/**
 * GET /api/prices?keys=yahoo:VWCE.DE,coingecko:bitcoin
 * Solo recibe identificadores de cotización; nunca cantidades ni operaciones.
 */
export async function GET(request: NextRequest) {
  const keys = (request.nextUrl.searchParams.get("keys") ?? "").split(",").filter(Boolean);
  if (keys.length === 0 || keys.length > MAX_KEYS) {
    return NextResponse.json({ error: `Entre 1 y ${MAX_KEYS} identificadores.` }, { status: 400 });
  }

  const yahooIds: string[] = [];
  const coingeckoIds: string[] = [];
  const errors: Record<string, string> = {};
  for (const key of keys) {
    const parsed = parsePriceKey(key);
    if (!parsed) errors[key] = "Identificador no válido.";
    else if (parsed.source === "yahoo") yahooIds.push(parsed.id);
    else coingeckoIds.push(parsed.id);
  }

  const quotes: Record<string, PriceQuote> = {};
  const [yahoo, coingecko] = await Promise.allSettled([quoteYahoo(yahooIds), quoteCoinGecko(coingeckoIds)]);

  const collect = (
    source: "yahoo" | "coingecko",
    ids: string[],
    result: PromiseSettledResult<Map<string, PriceQuote>>,
  ) => {
    for (const id of ids) {
      const key = priceKey(source, id);
      if (result.status === "rejected") errors[key] = "La fuente de precios no responde.";
      else {
        const quote = result.value.get(id);
        if (quote) {
          const { price, currency, sourceCurrency, sourcePrice, asOf } = quote;
          quotes[key] = { price, currency, sourceCurrency, sourcePrice, asOf };
        } else errors[key] = "Sin cotización.";
      }
    }
  };
  collect("yahoo", yahooIds, yahoo);
  collect("coingecko", coingeckoIds, coingecko);

  const body: PricesResponse = { quotes, errors };
  return NextResponse.json(body, {
    headers: { "Cache-Control": "public, s-maxage=20, stale-while-revalidate=10" },
  });
}
