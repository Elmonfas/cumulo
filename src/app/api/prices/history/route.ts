import { NextResponse, type NextRequest } from "next/server";
import { historyCoinGecko } from "@/prices/coingecko";
import { parsePriceKey, type PriceHistoryResponse } from "@/prices/types";
import { historyYahoo } from "@/prices/yahoo";

/**
 * GET /api/prices/history?key=yahoo:VWCE.DE&from=2025-01-01
 * Cierres diarios en EUR. Solo recibe el identificador y la fecha de inicio.
 */
export async function GET(request: NextRequest) {
  const key = request.nextUrl.searchParams.get("key") ?? "";
  const fromParam = request.nextUrl.searchParams.get("from") ?? "";
  const parsed = parsePriceKey(key);
  if (!parsed || !/^\d{4}-\d{2}-\d{2}$/.test(fromParam)) {
    return NextResponse.json({ error: "Parámetros no válidos." }, { status: 400 });
  }
  const from = new Date(`${fromParam}T00:00:00Z`);

  try {
    const points = parsed.source === "yahoo" ? await historyYahoo(parsed.id, from) : await historyCoinGecko(parsed.id, from);
    const body: PriceHistoryResponse = { key, points };
    return NextResponse.json(body, {
      headers: { "Cache-Control": "public, s-maxage=3600, stale-while-revalidate=86400" },
    });
  } catch {
    return NextResponse.json({ error: "La fuente de precios no responde." }, { status: 502 });
  }
}
