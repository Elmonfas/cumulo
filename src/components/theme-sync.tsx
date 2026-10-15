"use client";

import { useEffect } from "react";
import { applyTheme, resolveTheme } from "@/lib/theme";
import { useThemeStore } from "@/stores/theme-store";

/** Hidrata la preferencia y sigue los cambios del sistema mientras el modo es "sistema". */
export function ThemeSync() {
  const preference = useThemeStore((s) => s.preference);
  const hydrate = useThemeStore((s) => s.hydrate);

  useEffect(() => {
    hydrate();
  }, [hydrate]);

  useEffect(() => {
    if (preference !== "system") return;
    const media = window.matchMedia("(prefers-color-scheme: dark)");
    const onChange = () => applyTheme(resolveTheme("system", media.matches));
    media.addEventListener("change", onChange);
    return () => media.removeEventListener("change", onChange);
  }, [preference]);

  return null;
}
