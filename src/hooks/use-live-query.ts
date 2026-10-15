"use client";

import { useEffect, useState, useSyncExternalStore } from "react";
import { getDataVersion, getRepositories, subscribeToDataChanges, type Repositories } from "@/data/repositories";

type LiveState<T> = { status: "loading" } | { status: "ready"; data: T } | { status: "error"; error: Error };

/**
 * Ejecuta una consulta sobre los repositorios y la repite cuando cambian los
 * datos. `query` debe ser estable (useCallback o definida fuera del componente).
 */
export function useLiveQuery<T>(query: (repositories: Repositories) => Promise<T>): LiveState<T> {
  const version = useSyncExternalStore(subscribeToDataChanges, getDataVersion, () => 0);
  const [state, setState] = useState<LiveState<T>>({ status: "loading" });

  useEffect(() => {
    let cancelled = false;
    query(getRepositories()).then(
      (data) => !cancelled && setState({ status: "ready", data }),
      (error: unknown) =>
        !cancelled && setState({ status: "error", error: error instanceof Error ? error : new Error(String(error)) }),
    );
    return () => {
      cancelled = true;
    };
  }, [query, version]);

  return state;
}
