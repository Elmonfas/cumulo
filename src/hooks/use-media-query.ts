"use client";

import { useCallback, useSyncExternalStore } from "react";

/** ¿Cumple la pantalla esta media query? En el servidor, siempre no (vista móvil). */
export function useMediaQuery(query: string): boolean {
  const subscribe = useCallback(
    (onChange: () => void) => {
      const media = window.matchMedia(query);
      media.addEventListener("change", onChange);
      return () => media.removeEventListener("change", onChange);
    },
    [query],
  );
  return useSyncExternalStore(subscribe, () => window.matchMedia(query).matches, () => false);
}

/** Escritorio ancho (Tailwind `xl`, 1280 px): vistas propias de PC sin tocar el móvil. */
export const useWideScreen = () => useMediaQuery("(min-width: 80rem)");
