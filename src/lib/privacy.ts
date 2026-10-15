"use client";

import { useSyncExternalStore } from "react";

/**
 * Preferencia del modo privado (ocultar importes). Vive en localStorage como
 * el tema: es de la interfaz, no un dato financiero.
 */
const KEY = "cumulo:privacy";
const listeners = new Set<() => void>();

function read(): boolean {
  try {
    return localStorage.getItem(KEY) === "1";
  } catch {
    return false;
  }
}

let current: boolean | null = null;

const getSnapshot = () => (current ??= read());

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function setPrivacy(hidden: boolean) {
  current = hidden;
  try {
    if (hidden) localStorage.setItem(KEY, "1");
    else localStorage.removeItem(KEY);
  } catch {
    // Sin almacenamiento: dura lo que la sesión.
  }
  listeners.forEach((l) => l());
}

/** En el servidor (y en la primera pasada de hidratación) siempre visible. */
export function usePrivacy(): boolean {
  return useSyncExternalStore(subscribe, getSnapshot, () => false);
}
