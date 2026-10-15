import { NextResponse, type NextRequest } from "next/server";
import { findLogo } from "@/prices/logos";
import { parsePriceKey } from "@/prices/types";

/** GET /api/logo?key=yahoo:AAPL — solo recibe el identificador del activo. */
export async function GET(request: NextRequest) {
  const parsed = parsePriceKey(request.nextUrl.searchParams.get("key") ?? "");
  if (!parsed) return new NextResponse(null, { status: 400 });

  const logo = await findLogo(parsed.source, parsed.id);
  if (!logo) {
    // Se cachea también el "no hay logo" para no repetir la búsqueda.
    return new NextResponse(null, { status: 404, headers: { "Cache-Control": "public, s-maxage=604800" } });
  }
  return new NextResponse(logo.body, {
    headers: {
      "Content-Type": logo.type,
      "Cache-Control": "public, max-age=604800, s-maxage=2592000, stale-while-revalidate=2592000",
    },
  });
}
