import type Decimal from "decimal.js";
import { formatPercent } from "@/lib/format";
import { cn } from "@/lib/utils";

/** Píldora de variación: "↗ 2,4 %" sobre verde/rojo al 15 %. */
export function VariationBadge({ ratio, className }: { ratio: Decimal | null; className?: string }) {
  if (!ratio) return null;
  const rounded = ratio.toDecimalPlaces(3);
  const flat = rounded.isZero();
  const up = rounded.isPositive();
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium whitespace-nowrap tabular-nums",
        flat ? "bg-surface-2 text-text-muted" : up ? "bg-positive/15 text-positive" : "bg-negative/15 text-negative",
        className,
      )}
    >
      <span aria-hidden>{flat ? "→" : up ? "↗" : "↘"}</span>
      <span className="sr-only">{flat ? "sin cambios" : up ? "sube" : "baja"}</span>
      {formatPercent(ratio.abs(), { signed: false })}
    </span>
  );
}

/** Importe con color solo según el signo de la variación. */
export function VariationAmount({ value, format, className }: { value: Decimal; format: (v: Decimal) => string; className?: string }) {
  return (
    <span
      className={cn(
        "tabular-nums",
        value.isZero() ? "text-text" : value.isPositive() ? "text-positive" : "text-negative",
        className,
      )}
    >
      {format(value)}
    </span>
  );
}
