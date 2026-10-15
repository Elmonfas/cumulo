"use client";

import { RefreshCw } from "lucide-react";
import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";

function relative(fromIso: string | null, now: number) {
  if (!fromIso) return "sin actualizar";
  const seconds = Math.max(0, Math.round((now - Date.parse(fromIso)) / 1000));
  if (seconds < 5) return "ahora";
  if (seconds < 60) return `hace ${seconds} s`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `hace ${minutes} min`;
  return `hace ${Math.floor(minutes / 60)} h`;
}

/**
 * Botón para pedir precios al momento, con cuándo se actualizaron por última
 * vez. Con la app abierta se refrescan solos cada 30 s.
 */
export function RefreshPricesButton({
  refreshing,
  lastFetchedAt,
  onRefresh,
  className,
}: {
  refreshing: boolean;
  lastFetchedAt: string | null;
  onRefresh: () => void;
  className?: string;
}) {
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);

  return (
    <button
      type="button"
      onClick={onRefresh}
      disabled={refreshing}
      aria-label={refreshing ? "Actualizando precios" : `Actualizar precios (última actualización ${relative(lastFetchedAt, now)})`}
      className={cn(
        "inline-flex h-8 shrink-0 items-center gap-1.5 rounded-full border border-border bg-surface-2 px-3 text-xs font-medium text-text transition-colors outline-none hover:border-accent/50 focus-visible:ring-3 focus-visible:ring-accent/40 disabled:opacity-70",
        className,
      )}
    >
      <RefreshCw className={cn("size-3.5 text-accent", refreshing && "animate-spin")} aria-hidden />
      <span>{refreshing ? "Actualizando…" : "Actualizar"}</span>
      {!refreshing && <span className="text-text-muted tabular-nums">· {relative(lastFetchedAt, now)}</span>}
    </button>
  );
}
