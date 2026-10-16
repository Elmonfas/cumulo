import { NextResponse, type NextRequest } from "next/server";
import { coinSymbol, intradayCoinGecko } from "@/prices/coingecko";
import { INTRADAY_RANGES, parsePriceKey, type IntradayRange, type PriceHistoryResponse } from "@/prices/types";
import { intradayYahoo } from "@/prices/yahoo";

const CACHE_SECONDS: Record<IntradayRange, number> = { "1D": 60, "1W": 300, "1M": 900 };

/**
 * GET /api/prices/intraday?key=coingecko:bitcoin&range=1W
 * Precios en EUR con hora exacta (5 min, 30 min o 1 h). Solo recibe el identificador.
 */
export async function GET(request: NextRequest) {
  const parsed = parsePriceKey(request.nextUrl.searchParams.get("key") ?? "");
  const range = request.nextUrl.searchParams.get("range") as IntradayRange | null;
  if (!parsed || !range || !INTRADAY_RANGES.includes(range)) {
    return NextResponse.json({ error: "Parámetros no válidos." }, { status: 400 });
  }
  try {
    const points = parsed.source === "yahoo" ? await intradayYahoo(parsed.id, range) : await intradayCrypto(parsed.id, range);
    const body: PriceHistoryResponse = { key: `${parsed.source}:${parsed.id}`, points };
    const seconds = CACHE_SECONDS[range];
    return NextResponse.json(body, {
      headers: { "Cache-Control": `public, s-maxage=${seconds}, stale-while-revalidate=${seconds * 4}` },
    });
  } catch {
    return NextResponse.json({ error: "La fuente de precios no responde." }, { status: 502 });
  }
}

/** CoinGecko y, si falla (p. ej. por límite de uso), el par XXX-EUR de Yahoo. */
async function intradayCrypto(id: string, range: IntradayRange) {
  try {
    return await intradayCoinGecko(id, range);
  } catch (error) {
    const symbol = await coinSymbol(id).catch(() => null);
    if (!symbol) throw error;
    return intradayYahoo(`${symbol}-EUR`, range);
  }
}
