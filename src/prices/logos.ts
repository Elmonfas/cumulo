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
const MAX_BYTES = 512 * 1024;
/**
 * Solo imágenes rasterizadas: un SVG servido desde nuestro dominio podría
 * llevar scripts, así que nunca se reenvía.
 */
const ALLOWED_TYPES = new Set(["image/png", "image/jpeg", "image/webp", "image/gif", "image/x-icon", "image/vnd.microsoft.icon"]);

export interface LogoImage {
  body: ArrayBuffer;
  type: string;
}

/** La fuente no respondió (timeout, 5xx): no se debe cachear como "sin logo". */
export class LogoUnavailableError extends Error {}

async function fetchImage(url: string): Promise<LogoImage | null> {
  let response: Response;
  try {
    response = await fetch(url, { signal: AbortSignal.timeout(TIMEOUT), next: { revalidate: 2_592_000 } });
  } catch {
    throw new LogoUnavailableError(url);
  }
  if (response.status >= 500 || response.status === 429) throw new LogoUnavailableError(url);
  try {
    const type = (response.headers.get("content-type") ?? "").split(";")[0].trim().toLowerCase();
    if (!response.ok || !ALLOWED_TYPES.has(type)) return null;
    const declared = Number(response.headers.get("content-length") ?? 0);
    if (declared > MAX_BYTES) return null;
    const body = await response.arrayBuffer();
    // Algunas fuentes devuelven una imagen vacía de relleno.
    return body.byteLength > 200 && body.byteLength <= MAX_BYTES ? { body, type } : null;
  } catch {
    return null;
  }
}

async function coingeckoImageUrl(id: string): Promise<string | null> {
  const key = process.env.COINGECKO_DEMO_API_KEY;
  let response: Response;
  try {
    response = await fetch(`https://api.coingecko.com/api/v3/search?query=${encodeURIComponent(id)}`, {
      headers: { accept: "application/json", ...(key ? { "x-cg-demo-api-key": key } : {}) },
      signal: AbortSignal.timeout(TIMEOUT),
      next: { revalidate: 2_592_000 },
    });
  } catch {
    throw new LogoUnavailableError(id);
  }
  if (response.status >= 500 || response.status === 429) throw new LogoUnavailableError(id);
  if (!response.ok) return null;
  try {
    const { coins } = (await response.json()) as { coins: { id: string; large?: string; thumb?: string }[] };
    const coin = coins.find((c) => c.id === id);
    const url = coin?.large ?? coin?.thumb;
    // Solo se sigue la URL si apunta a las imágenes de CoinGecko.
    return url && /^https:\/\/([a-z0-9-]+\.)*coingecko\.com\//i.test(url) ? url : null;
  } catch {
    return null;
  }
}

/** Logo del activo; null si no hay. Lanza LogoUnavailableError si la fuente falla. */
export async function findLogo(source: RemotePriceSource, id: string): Promise<LogoImage | null> {
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
