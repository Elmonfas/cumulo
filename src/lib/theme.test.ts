import { beforeEach, describe, expect, it, vi } from "vitest";
import { readStoredTheme, resolveTheme, THEME_STORAGE_KEY, themeInitScript } from "./theme";
import { useThemeStore } from "@/stores/theme-store";

function mockSystemDark(dark: boolean) {
  vi.stubGlobal(
    "matchMedia",
    vi.fn().mockImplementation((query: string) => ({
      matches: dark && query === "(prefers-color-scheme: dark)",
      media: query,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    })),
  );
}

describe("tema", () => {
  beforeEach(() => {
    localStorage.clear();
    document.documentElement.className = "";
    useThemeStore.setState({ preference: "system", hydrated: false });
  });

  it("resuelve 'sistema' según la preferencia del sistema", () => {
    expect(resolveTheme("system", true)).toBe("dark");
    expect(resolveTheme("system", false)).toBe("light");
    expect(resolveTheme("dark", false)).toBe("dark");
    expect(resolveTheme("light", true)).toBe("light");
  });

  it("ignora valores guardados no válidos", () => {
    localStorage.setItem(THEME_STORAGE_KEY, "sepia");
    expect(readStoredTheme()).toBe("system");
  });

  it("persiste la elección y la aplica al <html>", () => {
    mockSystemDark(false);
    useThemeStore.getState().setPreference("dark");
    expect(localStorage.getItem(THEME_STORAGE_KEY)).toBe("dark");
    expect(document.documentElement).toHaveClass("dark");

    useThemeStore.getState().setPreference("light");
    expect(document.documentElement).not.toHaveClass("dark");
  });

  it("recupera la elección guardada al hidratar", () => {
    mockSystemDark(false);
    localStorage.setItem(THEME_STORAGE_KEY, "dark");
    useThemeStore.getState().hydrate();
    expect(useThemeStore.getState()).toMatchObject({ preference: "dark", hydrated: true });
    expect(document.documentElement).toHaveClass("dark");
  });

  it("el script inicial aplica el mismo tema que el store", () => {
    for (const [stored, systemDark, expected] of [
      ["dark", false, true],
      ["light", true, false],
      ["system", true, true],
      [null, false, false],
    ] as const) {
      mockSystemDark(systemDark);
      document.documentElement.className = "";
      if (stored) localStorage.setItem(THEME_STORAGE_KEY, stored);
      else localStorage.removeItem(THEME_STORAGE_KEY);
      new Function(themeInitScript)();
      expect(document.documentElement.classList.contains("dark")).toBe(expected);
    }
  });
});
