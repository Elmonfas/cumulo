import { create } from "zustand";
import {
  applyTheme,
  readStoredTheme,
  resolveTheme,
  storeTheme,
  systemPrefersDark,
  type ThemePreference,
} from "@/lib/theme";

interface ThemeState {
  preference: ThemePreference;
  /** false hasta leer localStorage en el cliente; evita desajustes de hidratación. */
  hydrated: boolean;
  hydrate: () => void;
  setPreference: (preference: ThemePreference) => void;
}

export const useThemeStore = create<ThemeState>((set) => ({
  preference: "system",
  hydrated: false,
  hydrate: () => {
    const preference = readStoredTheme();
    applyTheme(resolveTheme(preference, systemPrefersDark()));
    set({ preference, hydrated: true });
  },
  setPreference: (preference) => {
    storeTheme(preference);
    applyTheme(resolveTheme(preference, systemPrefersDark()));
    set({ preference });
  },
}));
