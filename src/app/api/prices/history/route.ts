import { NextResponse, type NextRequest } from "next/server";
import { coinSymbol, historyCoinGecko } from "@/prices/coingecko";
import { daysBetween } from "@/domain/returns";
import { mergeOlderHistory } from "@/prices/merge-history";
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
  // Fechas imposibles o fuera de rango (antes de 1970 o en el futuro) no llegan a la fuente.
  if (Number.isNaN(from.getTime()) || from.getUTCFullYear() < 1970 || from.getTime() > Date.now()) {
    return NextResponse.json({ error: "Fecha no válida." }, { status: 400 });
  }

  try {
    const points = parsed.source === "yahoo" ? await historyYahoo(parsed.id, from) : await historyCrypto(parsed.id, from, fromParam);
    const body: PriceHistoryResponse = { key, points };
    return NextResponse.json(body, {
      headers: { "Cache-Control": "public, s-maxage=3600, stale-while-revalidate=86400" },
    });
  } catch {
    return NextResponse.json({ error: "La fuente de precios no responde." }, { status: 502 });
  }
}

/**
 * CoinGecko gratis solo da 365 días. Si se pide más, el tramo antiguo se
 * completa con el par XXX-EUR de Yahoo, validado contra CoinGecko en el día
 * de unión (ver mergeOlderHistory). Si algo falla, se queda lo de CoinGecko.
 */
async function historyCrypto(id: string, from: Date, fromDay: string) {
  const recent = await historyCoinGecko(id, from);
  // Unos días de margen: CoinGecko puede empezar uno o dos días después de lo pedido.
  if (recent.length === 0 || daysBetween(fromDay, recent[0].date) <= 3) return recent;
  try {
    const symbol = await coinSymbol(id);
    if (!symbol) return recent;
    const older = await historyYahoo(`${symbol}-EUR`, from);
    return mergeOlderHistory(older, recent);
  } catch {
    return recent;
  }
}
