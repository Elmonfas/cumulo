import "server-only";
import type { RemotePriceSource } from "./types";

/**
 * Logos de activos. El navegador solo habla con /api/logo; el servidor busca
 * la imagen y el CDN la guarda, así ningún tercero ve qué activos consultas.
 *
 * - Acciones y ETF: Financial Modeling Prep (gratis, sin clave), primero con
 *   el símbolo completo (VWCE.DE) y después con el base (SAP).
 * - Cripto: imagen de CoinGecko.
 */
const TIMEOUT = 8_000;

async function fetchImage(url: string): Promise<{ body: ArrayBuffer; type: string } | null> {
  try {
    const response = await fetch(url, { signal: AbortSignal.timeout(TIMEOUT), next: { revalidate: 2_592_000 } });
    const type = response.headers.get("content-type") ?? "";
    if (!response.ok || !type.startsWith("image/")) return null;
    const body = await response.arrayBuffer();
    // Algunas fuentes devuelven una imagen vacía de relleno.
    return body.byteLength > 200 ? { body, type } : null;
  } catch {
    return null;
  }
}

async function coingeckoImageUrl(id: string): Promise<string | null> {
  const key = process.env.COINGECKO_DEMO_API_KEY;
  try {
    const response = await fetch(`https://api.coingecko.com/api/v3/search?query=${encodeURIComponent(id)}`, {
      headers: { accept: "application/json", ...(key ? { "x-cg-demo-api-key": key } : {}) },
      signal: AbortSignal.timeout(TIMEOUT),
      next: { revalidate: 2_592_000 },
    });
    if (!response.ok) return null;
    const { coins } = (await response.json()) as { coins: { id: string; large?: string; thumb?: string }[] };
    const coin = coins.find((c) => c.id === id);
    return coin?.large ?? coin?.thumb ?? null;
  } catch {
    return null;
  }
}

export async function findLogo(source: RemotePriceSource, id: string) {
  if (source === "coingecko") {
    const url = await coingeckoImageUrl(id);
    return url ? fetchImage(url) : null;
  }
  const symbols = [...new Set([id.toUpperCase(), id.split(".")[0].toUpperCase()])];
  for (const symbol of symbols) {
    const image = await fetchImage(`https://financialmodelingprep.com/image-stock/${encodeURIComponent(symbol)}.png`);
    if (image) return image;
  }
  return null;
}
