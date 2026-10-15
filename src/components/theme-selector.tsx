"use client";

import { Monitor, Moon, Sun, type LucideIcon } from "lucide-react";
import type { KeyboardEvent } from "react";
import type { ThemePreference } from "@/lib/theme";
import { cn } from "@/lib/utils";
import { useThemeStore } from "@/stores/theme-store";

const OPTIONS: { value: ThemePreference; label: string; icon: LucideIcon }[] = [
  { value: "light", label: "Claro", icon: Sun },
  { value: "dark", label: "Oscuro", icon: Moon },
  { value: "system", label: "Sistema", icon: Monitor },
];

export function ThemeSelector() {
  const preference = useThemeStore((s) => s.preference);
  const hydrated = useThemeStore((s) => s.hydrated);
  const setPreference = useThemeStore((s) => s.setPreference);

  function onKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    const step = event.key === "ArrowRight" || event.key === "ArrowDown" ? 1 : event.key === "ArrowLeft" || event.key === "ArrowUp" ? -1 : 0;
    if (!step) return;
    event.preventDefault();
    const index = OPTIONS.findIndex((o) => o.value === preference);
    const next = OPTIONS[(index + step + OPTIONS.length) % OPTIONS.length];
    setPreference(next.value);
    (event.currentTarget as HTMLDivElement).querySelector<HTMLButtonElement>(`[data-value="${next.value}"]`)?.focus();
  }

  return (
    <div
      role="radiogroup"
      aria-label="Tema"
      onKeyDown={onKeyDown}
      className={cn(
        "grid grid-cols-3 gap-1 rounded-full border border-border bg-surface-2 p-1 transition-opacity",
        !hydrated && "opacity-0",
      )}
    >
      {OPTIONS.map(({ value, label, icon: Icon }) => {
        const checked = preference === value;
        return (
          <button
            key={value}
            type="button"
            role="radio"
            data-value={value}
            aria-checked={checked}
            tabIndex={checked ? 0 : -1}
            onClick={() => setPreference(value)}
            className={cn(
              "flex h-10 items-center justify-center gap-2 rounded-full text-sm font-medium transition-colors outline-none focus-visible:ring-3 focus-visible:ring-accent/40",
              checked ? "bg-surface text-accent shadow-card dark:bg-accent/15" : "text-text-muted hover:text-text",
            )}
          >
            <Icon className="size-4" aria-hidden />
            {label}
          </button>
        );
      })}
    </div>
  );
}
