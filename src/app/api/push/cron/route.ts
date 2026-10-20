import Decimal from "decimal.js";
import { NextResponse, type NextRequest } from "next/server";
import { quoteCoinGecko } from "@/prices/coingecko";
import { parsePriceKey } from "@/prices/types";
import { quoteYahoo } from "@/prices/yahoo";
import { runPushCron } from "@/push/cron";
import { noStore } from "@/push/http";
import { getPushStore } from "@/push/redis-store";
import { pushConfigured, sendPush } from "@/push/send";

export const maxDuration = 60;

/** Precios en EUR por clave; una fuente caída solo deja fuera sus alertas en esta pasada. */
async function quote(keys: string[]): Promise<Map<string, Decimal>> {
  const yahoo: string[] = [];
  const coingecko: string[] = [];
  for (const key of keys) {
    const parsed = parsePriceKey(key);
    if (parsed?.source === "yahoo") yahoo.push(parsed.id);
    else if (parsed?.source === "coingecko") coingecko.push(parsed.id);
  }
  const prices = new Map<string, Decimal>();
  const [y, c] = await Promise.allSettled([
    yahoo.length > 0 ? quoteYahoo(yahoo) : Promise.resolve(new Map()),
    coingecko.length > 0 ? quoteCoinGecko(coingecko) : Promise.resolve(new Map()),
  ]);
  if (y.status === "fulfilled") for (const [id, q] of y.value) prices.set(`yahoo:${id}`, new Decimal(q.price));
  if (c.status === "fulfilled") for (const [id, q] of c.value) prices.set(`coingecko:${id}`, new Decimal(q.price));
  return prices;
}

/**
 * GET /api/push/cron — lo llama GitHub Actions cada 15 minutos (y Vercel Cron
 * una vez al día, de respaldo) con `Authorization: Bearer $CRON_SECRET`.
 */
export async function GET(request: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (!secret || request.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "No autorizado." }, { status: 401, headers: noStore });
  }
  if (!pushConfigured()) return NextResponse.json({ error: "Falta VAPID_PRIVATE_KEY." }, { status: 503, headers: noStore });
  const summary = await runPushCron({ store: getPushStore(), quote, send: sendPush, now: new Date() });
  return NextResponse.json(summary, { headers: noStore });
}
