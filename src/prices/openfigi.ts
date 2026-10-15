import "server-only";

/**
 * OpenFIGI: traduce un ISIN a tickers por mercado. Sin clave admite
 * 25 peticiones/minuto; con OPENFIGI_API_KEY, más.
 */
interface FigiRecord {
  ticker?: string;
  exchCode?: string;
  name?: string;
  securityType?: string;
  marketSector?: string;
}

/** Código de mercado de Bloomberg → sufijo de Yahoo. Primero los mercados en EUR. */
const YAHOO_SUFFIX_BY_EXCHANGE: [string, string][] = [
  ["GY", ".DE"],
  ["GR", ".DE"],
  ["GF", ".F"],
  ["GS", ".SG"],
  ["GM", ".MU"],
  ["GD", ".DU"],
  ["NA", ".AS"],
  ["FP", ".PA"],
  ["IM", ".MI"],
  ["SM", ".MC"],
  ["BB", ".BR"],
  ["PL", ".LS"],
  ["ID", ".IR"],
  ["AV", ".VI"],
  ["FH", ".HE"],
  ["LN", ".L"],
  ["SW", ".SW"],
  ["SE", ".SW"],
  ["US", ""],
  ["UN", ""],
  ["UW", ""],
  ["UQ", ""],
];
const PRIORITY = new Map(YAHOO_SUFFIX_BY_EXCHANGE.map(([code], index) => [code, index]));
const SUFFIX = new Map(YAHOO_SUFFIX_BY_EXCHANGE);

export const isIsin = (value: string) => /^[A-Z]{2}[A-Z0-9]{9}\d$/.test(value.trim().toUpperCase());

/** Símbolos de Yahoo candidatos para un ISIN, del mercado preferido al menos. */
export async function yahooSymbolsForIsin(isin: string): Promise<string[]> {
  const key = process.env.OPENFIGI_API_KEY;
  const response = await fetch("https://api.openfigi.com/v3/mapping", {
    method: "POST",
    headers: { "content-type": "application/json", ...(key ? { "x-openfigi-apikey": key } : {}) },
    body: JSON.stringify([{ idType: "ID_ISIN", idValue: isin.toUpperCase() }]),
    next: { revalidate: 86_400 },
    signal: AbortSignal.timeout(8_000),
  });
  if (!response.ok) throw new Error(`OpenFIGI respondió ${response.status}`);
  const [result] = (await response.json()) as [{ data?: FigiRecord[] }];

  const symbols = (result?.data ?? [])
    .filter((r) => r.ticker && r.exchCode && SUFFIX.has(r.exchCode))
    .sort((a, b) => PRIORITY.get(a.exchCode!)! - PRIORITY.get(b.exchCode!)!)
    .map((r) => `${r.ticker!.replace(/\s+/g, "-").replace(/\/$/, "")}${SUFFIX.get(r.exchCode!)}`);
  return [...new Set(symbols)].slice(0, 8);
}
