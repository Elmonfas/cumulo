"use client";

import Decimal from "decimal.js";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { getRepositories, type Repositories } from "@/data/repositories";
import type { Asset, PriceCacheEntry, Transaction } from "@/domain/models";
import { buildPortfolio, type PortfolioState } from "@/domain/portfolio";
import { valuePortfolio, type PortfolioValuation } from "@/domain/valuation";
import { showNotification } from "@/lib/notifications";
import { checkAlerts } from "@/services/alerts";
import { refreshPrices } from "@/services/prices";
import { useLiveQuery } from "./use-live-query";

const REFRESH_INTERVAL_MS = 120_000;

const loadAll = async (repositories: Repositories) => {
  const [transactions, assets, prices] = await Promise.all([
    repositories.transactions.list(),
    repositories.assets.list(),
    repositories.priceCache.list(),
  ]);
  return { transactions, assets, prices };
};

export interface PortfolioData {
  transactions: Transaction[];
  assets: Map<string, Asset>;
  prices: Map<string, PriceCacheEntry>;
  state: PortfolioState;
  valuation: PortfolioValuation;
  /** Hora de la cotización más antigua entre las posiciones abiertas. */
  oldestQuote: string | null;
}

export type PortfolioStatus =
  | { status: "loading" }
  | { status: "error"; error: Error }
  | { status: "ready"; data: PortfolioData };

/**
 * Cartera valorada con los últimos precios guardados. Refresca precios al
 * montarse y cada 2 minutos mientras la pestaña está visible.
 */
export function usePortfolio() {
  const live = useLiveQuery(loadAll);
  const [refreshing, setRefreshing] = useState(false);
  const [failedIds, setFailedIds] = useState<string[]>([]);
  const assetsRef = useRef<Asset[]>([]);

  const result: PortfolioStatus = useMemo(() => {
    if (live.status !== "ready") return live;
    const { transactions, assets, prices } = live.data;
    let state: PortfolioState;
    try {
      state = buildPortfolio(transactions);
    } catch (error) {
      return { status: "error", error: error as Error };
    }
    const priceMap = new Map(prices.map((p) => [p.assetId, p]));
    const valuation = valuePortfolio(state, new Map(prices.map((p) => [p.assetId, new Decimal(p.price)])));
    const quoteTimes = valuation.positions
      .map((p) => priceMap.get(p.position.assetId)?.updatedAt)
      .filter((t): t is string => Boolean(t))
      .sort();
    return {
      status: "ready",
      data: {
        transactions,
        assets: new Map(assets.map((a) => [a.id, a])),
        prices: priceMap,
        state,
        valuation,
        oldestQuote: quoteTimes[0] ?? null,
      },
    };
  }, [live]);

  const heldAssetIds = result.status === "ready" ? result.data.valuation.positions.map((p) => p.position.assetId).join(",") : "";
  useEffect(() => {
    if (result.status === "ready") {
      const held = new Set(heldAssetIds.split(","));
      assetsRef.current = [...result.data.assets.values()].filter((a) => held.has(a.id));
    }
  }, [result, heldAssetIds]);

  const refresh = useCallback(async (force = false) => {
    if (assetsRef.current.length === 0) return;
    setRefreshing(true);
    try {
      const repositories = getRepositories();
      const { failed } = await refreshPrices(repositories, assetsRef.current, { force });
      setFailedIds(failed);
      await checkAlerts(repositories, showNotification);
    } finally {
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    if (!heldAssetIds) return;
    void refresh();
    const timer = setInterval(() => {
      if (document.visibilityState === "visible") void refresh();
    }, REFRESH_INTERVAL_MS);
    const onVisible = () => document.visibilityState === "visible" && void refresh();
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      clearInterval(timer);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [heldAssetIds, refresh]);

  return { ...result, refreshing, failedIds, refresh } as PortfolioStatus & {
    refreshing: boolean;
    failedIds: string[];
    refresh: (force?: boolean) => Promise<void>;
  };
}
