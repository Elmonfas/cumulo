import { createDatabase } from "../db";
import { createDexieRepositories } from "./dexie";
import type { Repositories } from "./types";

export type * from "./types";

let instance: Repositories | null = null;

/** Repositorios de la app. Solo en el cliente: los datos viven en IndexedDB. */
export function getRepositories(): Repositories {
  if (typeof window === "undefined") {
    throw new Error("Los repositorios solo están disponibles en el navegador.");
  }
  instance ??= createDexieRepositories(createDatabase());
  return instance;
}
