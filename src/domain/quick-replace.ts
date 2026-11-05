/**
 * Al importar el historial de un bróker, las altas rápidas (cantidad y precio
 * medio) de los mismos activos sobran: el archivo trae las compras reales. Aquí
 * se decide cuáles se proponen sustituir; la persona puede cambiarlo.
 */

export interface AssetLike {
  name: string;
  isin?: string;
  ticker?: string;
  type?: string;
}

export interface QuickEntry {
  transactionId: string;
  asset: AssetLike;
}

// Palabras de las que se omiten los nombres de fondos y que no los distinguen.
const NOISE = new Set(["ucits", "etf", "acc", "dist", "inc", "plc", "usd", "eur", "shares", "class", "the", "sa", "ag", "corp", "co", "ltd"]);

/** Nombre comparable: sin tildes, mayúsculas, signos ni palabras de relleno. */
export function normalizeAssetName(name: string): string {
  return name
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/\([^)]*\)/g, " ")
    .split(/[^a-z0-9]+/)
    .filter((w) => w.length > 1 && !NOISE.has(w))
    .join(" ");
}

function sameAsset(a: AssetLike, b: AssetLike): boolean {
  if (a.isin && b.isin) return a.isin.toUpperCase() === b.isin.toUpperCase();
  if (a.type === "crypto" && b.type === "crypto" && a.ticker && b.ticker) return a.ticker.toUpperCase() === b.ticker.toUpperCase();
  const x = normalizeAssetName(a.name);
  const y = normalizeAssetName(b.name);
  if (!x || !y) return false;
  if (x === y) return true;
  // Un nombre recortado: vale si al otro solo le sobra una palabra (no «… high dividend yield»).
  const [short, long] = x.length <= y.length ? [x, y] : [y, x];
  return short.length >= 6 && long.startsWith(short) && long.split(" ").length - short.split(" ").length <= 1;
}

/** Ids de las altas rápidas cuyo activo aparece en el archivo. */
export function suggestQuickReplacements(quick: readonly QuickEntry[], fileAssets: readonly AssetLike[]): Set<string> {
  return new Set(quick.filter((q) => fileAssets.some((f) => sameAsset(q.asset, f))).map((q) => q.transactionId));
}
