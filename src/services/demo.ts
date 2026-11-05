import Decimal from "decimal.js";
import Dexie from "dexie";
import { createDatabase } from "@/data/db";
import { createDexieRepositories } from "@/data/repositories/dexie";
import { BACKUP_FORMAT, BACKUP_VERSION, type BackupData } from "@/domain/backup";
import { DEFAULT_SETTINGS, type Asset, type Transaction } from "@/domain/models";
import { DEMO_DATABASE, setDemoFlag } from "@/lib/demo";

/**
 * Cartera de ejemplo: dos años aportando 150 € al mes a un ETF global, tres
 * acciones (una vendida en parte) y algo de cripto. Precios aproximados a los
 * de mercado en cada fecha; el valor actual sale de los precios en vivo.
 */
const ASSETS: Asset[] = [
  { id: "demo-vwce", name: "Vanguard FTSE All-World UCITS ETF USD Acc", ticker: "VWCE", isin: "IE00BK5BQT80", type: "etf", priceSource: "yahoo", priceSourceId: "VWCE.DE" },
  { id: "demo-aapl", name: "Apple Inc.", ticker: "APC", isin: "US0378331005", type: "stock", priceSource: "yahoo", priceSourceId: "APC.DE" },
  { id: "demo-amzn", name: "Amazon.com, Inc.", ticker: "AMZ", isin: "US0231351067", type: "stock", priceSource: "yahoo", priceSourceId: "AMZ.DE" },
  { id: "demo-btc", name: "Bitcoin", ticker: "BTC", type: "crypto", priceSource: "coingecko", priceSourceId: "bitcoin" },
  { id: "demo-eth", name: "Ethereum", ticker: "ETH", type: "crypto", priceSource: "coingecko", priceSourceId: "ethereum" },
];

const MONTHLY = new Decimal(150);
const FIRST_MONTH = { year: 2024, month: 11 };
const MONTHS = 24;

const trade = (id: string, assetId: string, type: "buy" | "sell", date: string, quantity: string, price: string, fee = "1"): Transaction => ({
  id,
  assetId,
  type,
  date,
  quantity,
  price,
  fee,
  tax: "0",
  origin: "manual",
});

export function buildDemoData(now = new Date()): BackupData {
  const transactions: Transaction[] = [];
  // Aportación periódica: el día 5 de cada mes, de 118 € a 168 € por participación.
  for (let i = 0; i < MONTHS; i++) {
    const year = FIRST_MONTH.year + Math.floor((FIRST_MONTH.month - 1 + i) / 12);
    const month = ((FIRST_MONTH.month - 1 + i) % 12) + 1;
    const price = new Decimal(118).plus(new Decimal(50).times(i).div(MONTHS - 1)).toDecimalPlaces(2);
    const quantity = MONTHLY.minus(1).div(price).toDecimalPlaces(4, Decimal.ROUND_DOWN);
    const date = `${year}-${String(month).padStart(2, "0")}-05`;
    transactions.push(trade(`demo-vwce-${i}`, "demo-vwce", "buy", date, quantity.toString(), price.toString()));
  }
  transactions.push(
    trade("demo-aapl-1", "demo-aapl", "buy", "2025-02-12", "4", "218.40"),
    trade("demo-aapl-2", "demo-aapl", "sell", "2026-01-20", "1", "236.10"),
    trade("demo-amzn-1", "demo-amzn", "buy", "2025-04-08", "3", "158.30"),
    trade("demo-btc-1", "demo-btc", "buy", "2025-01-15", "0.01", "94100", "0.94"),
    trade("demo-btc-2", "demo-btc", "buy", "2025-08-04", "0.005", "97500", "0.49"),
    trade("demo-eth-1", "demo-eth", "buy", "2025-06-10", "0.25", "2350", "0.59"),
  );
  return {
    format: BACKUP_FORMAT,
    version: BACKUP_VERSION,
    exportedAt: now.toISOString(),
    assets: ASSETS,
    transactions: transactions.sort((a, b) => a.date.localeCompare(b.date)),
    priceCache: [],
    settings: DEFAULT_SETTINGS,
    alerts: [],
    watchlist: [],
    goals: [],
  };
}

/** Prepara la base de ejemplo y abre la app con ella. */
export async function enterDemo() {
  await Dexie.delete(DEMO_DATABASE);
  const db = createDatabase(DEMO_DATABASE);
  await createDexieRepositories(db).backup.importAll(buildDemoData());
  db.close();
  setDemoFlag(true);
  // Recarga completa a propósito: la app abre la otra base de datos desde el arranque.
  // eslint-disable-next-line @next/next/no-location-assign-relative-destination
  window.location.assign("/");
}

/** Vuelve a los datos de la persona. La base de ejemplo se borra al arrancar (ver getRepositories). */
export function exitDemo(to = "/") {
  setDemoFlag(false);
  window.location.assign(to);
}
