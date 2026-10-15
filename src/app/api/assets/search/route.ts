import { NextResponse, type NextRequest } from "next/server";
import { searchAssets } from "@/prices/search";

// Solo recibe el texto buscado (nombre, ticker o ISIN); nunca datos de la cartera.
export async function GET(request: NextRequest) {
  const query = request.nextUrl.searchParams.get("q")?.trim() ?? "";
  if (query.length < 2 || query.length > 64) {
    return NextResponse.json({ error: "La búsqueda debe tener entre 2 y 64 caracteres." }, { status: 400 });
  }
  const result = await searchAssets(query);
  return NextResponse.json(result, {
    headers: { "Cache-Control": "public, s-maxage=3600, stale-while-revalidate=86400" },
  });
}
