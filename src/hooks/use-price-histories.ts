"use client";

import Decimal from "decimal.js";
import { useEffect, useState } from "react";
import type { ClosePoint } from "@/domain/history";
import type { Asset } from "@/domain/models";
import { priceKey, type IntradayRange, type PriceHistoryResponse } from "@/prices/types";

const cache = new Map<string, Promise<ClosePoint[]>>();
const MAX_PARALLEL = 4;

/** Cierres diarios en EUR de un activo desde `from` (con caché en memoria). */
export function fetchHistory(asset: Asset, from: string): Promise<ClosePoint[]> {
  const key = `${priceKey(asset.priceSource as "yahoo" | "coingecko", asset.priceSourceId)}|${from}`;
  let promise = cache.get(key);
  if (!promise) {
    promise = fetch(`/api/prices/history?key=${encodeURIComponent(key.split("|")[0])}&from=${from}`)
      .then((r) => (r.ok ? (r.json() as Promise<PriceHistoryResponse>) : Promise.reject(new Error(String(r.status)))))
      .then((body) => body.points.map((p) => ({ date: p.date, close: new Decimal(p.close) })));
    // Un fallo no se cachea: se reintentará en el siguiente render.
    promise.catch(() => cache.delete(key));
    cache.set(key, promise);
  }
  return promise;
}

/** Vida de la caché intradía en memoria: la del CDN, para no pedir de más. */
const INTRADAY_TTL: Record<IntradayRange, number> = { "1D": 60_000, "1W": 300_000, "1M": 900_000 };
const intradayCache = new Map<string, { at: number; promise: Promise<ClosePoint[]> }>();

/** Precios intradía en EUR (fecha = instante ISO) de un activo. */
export function fetchIntraday(asset: Asset, range: IntradayRange): Promise<ClosePoint[]> {
  const key = priceKey(asset.priceSource as "yahoo" | "coingecko", asset.priceSourceId);
  const cacheKey = `${key}|${range}`;
  const cached = intradayCache.get(cacheKey);
  if (cached && Date.now() - cached.at < INTRADAY_TTL[range]) return cached.promise;
  const promise = fetch(`/api/prices/intraday?key=${encodeURIComponent(key)}&range=${range}`)
    .then((r) => (r.ok ? (r.json() as Promise<PriceHistoryResponse>) : Promise.reject(new Error(String(r.status)))))
    .then((body) => body.points.map((p) => ({ date: p.date, close: new Decimal(p.close) })));
  promise.catch(() => intradayCache.delete(cacheKey));
  intradayCache.set(cacheKey, { at: Date.now(), promise });
  return promise;
}

export type HistoriesState =
  | { status: "loading" }
  | { status: "ready"; closes: Map<string, ClosePoint[]>; failed: number };

/**
 * Cierres diarios en EUR desde `from` para los activos con fuente remota. Con
 * `intraday`, en su lugar precios intradía (la fecha de cada punto es un instante ISO).
 */
export function usePriceHistories(assets: Asset[], from: string | null, intraday?: IntradayRange | null): HistoriesState {
  const [state, setState] = useState<HistoriesState & { signature?: string }>({ status: "loading" });
  const remote = assets.filter((a) => a.priceSource !== "manual" && a.priceSourceId);
  const signature = `${intraday ?? from}|${remote.map((a) => a.id).sort().join(",")}`;

  useEffect(() => {
    if (!from) return;
    let cancelled = false;
    const queue = remote.slice();
    const closes = new Map<string, ClosePoint[]>();
    let failed = 0;

    const worker = async () => {
      for (let asset = queue.shift(); asset; asset = queue.shift()) {
        try {
          closes.set(asset.id, await (intraday ? fetchIntraday(asset, intraday) : fetchHistory(asset, from)));
        } catch {
          failed++;
        }
      }
    };
    Promise.all(Array.from({ length: MAX_PARALLEL }, worker)).then(() => {
      if (!cancelled) setState({ status: "ready", closes, failed, signature });
    });
    return () => {
      cancelled = true;
    };
    // `remote` se deriva de `signature`.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [signature]);

  if (!from || state.status !== "ready" || state.signature !== signature) return { status: "loading" };
  return state;
}
