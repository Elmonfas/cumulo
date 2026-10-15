import type { Repositories } from "./types";

type Listener = () => void;

/**
 * Avisa a la UI cuando cambian los datos. Es independiente del backend: el
 * envoltorio de abajo emite tras cualquier método que escribe.
 */
const listeners = new Set<Listener>();
let version = 0;

export function subscribeToDataChanges(listener: Listener) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function getDataVersion() {
  return version;
}

export function notifyDataChanged() {
  version++;
  listeners.forEach((listener) => listener());
}

const READ_METHODS = new Set(["list", "listByAsset", "get", "existingImportHashes", "findBySource", "exportAll"]);

/** Envuelve cada repositorio para notificar tras las escrituras. */
export function withChangeEvents(repositories: Repositories): Repositories {
  const wrap = <T extends object>(repository: T): T =>
    new Proxy(repository, {
      get(target, property, receiver) {
        const value = Reflect.get(target, property, receiver);
        if (typeof value !== "function" || READ_METHODS.has(String(property))) return value;
        return async (...args: unknown[]) => {
          const result = await value.apply(target, args);
          notifyDataChanged();
          return result;
        };
      },
    });

  return {
    assets: wrap(repositories.assets),
    transactions: wrap(repositories.transactions),
    priceCache: wrap(repositories.priceCache),
    settings: wrap(repositories.settings),
    backup: wrap(repositories.backup),
  };
}
