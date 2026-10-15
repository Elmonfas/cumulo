"use client";

import { useEffect, useState } from "react";
import type { AssetSearchResponse } from "@/prices/types";

type SearchState =
  | { status: "idle" }
  | { status: "loading"; query: string }
  | { status: "ready"; query: string; result: AssetSearchResponse }
  | { status: "error"; query: string };

const DEBOUNCE_MS = 300;
const cache = new Map<string, AssetSearchResponse>();

/** Busca en /api/assets/search con espera de 300ms y caché en memoria. */
export function useAssetSearch(rawQuery: string): SearchState {
  const query = rawQuery.trim();
  const [state, setState] = useState<SearchState>({ status: "idle" });

  useEffect(() => {
    if (query.length < 2) return;
    const cached = cache.get(query.toLowerCase());
    const controller = new AbortController();
    const timer = setTimeout(
      async () => {
        if (cached) {
          setState({ status: "ready", query, result: cached });
          return;
        }
        setState({ status: "loading", query });
        try {
          const response = await fetch(`/api/assets/search?q=${encodeURIComponent(query)}`, { signal: controller.signal });
          if (!response.ok) throw new Error(String(response.status));
          const result = (await response.json()) as AssetSearchResponse;
          cache.set(query.toLowerCase(), result);
          setState({ status: "ready", query, result });
        } catch (error) {
          if (!controller.signal.aborted) setState({ status: "error", query });
          void error;
        }
      },
      cached ? 0 : DEBOUNCE_MS,
    );
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [query]);

  if (query.length < 2) return { status: "idle" };
  // Mientras llega la respuesta de una consulta nueva, se muestra como cargando.
  if (state.status !== "idle" && state.query !== query) return { status: "loading", query };
  return state;
}
