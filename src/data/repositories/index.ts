import Dexie from "dexie";
import { DEMO_DATABASE, isDemo } from "@/lib/demo";
import { createDatabase } from "../db";
import { withChangeEvents } from "./change-events";
import { createDexieRepositories } from "./dexie";
import type { Repositories } from "./types";

export type * from "./types";
export { getDataVersion, subscribeToDataChanges } from "./change-events";

let instance: Repositories | null = null;

/** Repositorios de la app. Solo en el cliente: los datos viven en IndexedDB (otra base en el modo demo). */
export function getRepositories(): Repositories {
  if (typeof window === "undefined") {
    throw new Error("Los repositorios solo están disponibles en el navegador.");
  }
  if (!instance) {
    const demo = isDemo();
    // Al salir del modo demo, su base sobra.
    if (!demo) void Dexie.delete(DEMO_DATABASE).catch(() => undefined);
    instance = withChangeEvents(createDexieRepositories(createDatabase(demo ? DEMO_DATABASE : undefined)));
  }
  return instance;
}
