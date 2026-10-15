"use client";

import { useEffect, useState } from "react";
import type { PortfolioData } from "@/hooks/use-portfolio";
import { describeFreshness, type QuoteInfo } from "@/lib/freshness";
import { cn } from "@/lib/utils";

/** Hora de la cotización de cada posición abierta (o de una sola si se indica). */
export function quotesOf(data: PortfolioData, assetId?: string | null): QuoteInfo[] {
  return data.valuation.positions
    .filter((p) => !assetId || p.position.assetId === assetId)
    .map((p) => {
      const asset = data.assets.get(p.position.assetId);
      const cached = data.prices.get(p.position.assetId);
      return cached && asset && asset.priceSource !== "manual"
        ? { label: (asset.ticker ?? asset.name).split(".")[0], updatedAt: cached.updatedAt }
        : null;
    })
    .filter((q): q is QuoteInfo => q !== null);
}

/**
 * "VWCE y SAP con el último precio de las 17:35 (su mercado está cerrado) ·
 * BTC al momento". Se recalcula cada 30 s.
 */
export function QuoteFreshness({
  quotes,
  failed,
  missing,
  className,
}: {
  quotes: QuoteInfo[];
  failed: number;
  missing: number;
  className?: string;
}) {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 30_000);
    return () => clearInterval(timer);
  }, []);

  const parts: string[] = [];
  const freshness = describeFreshness(quotes, now);
  if (freshness) parts.push(freshness);
  if (failed > 0) parts.push(`${failed} sin actualizar: se muestra el último precio guardado`);
  if (missing > 0) parts.push(`${missing} ${missing === 1 ? "activo" : "activos"} sin precio`);
  if (parts.length === 0) return null;
  return <p className={cn("text-xs text-pretty text-text-muted", className)}>{parts.join(" · ")}</p>;
}
