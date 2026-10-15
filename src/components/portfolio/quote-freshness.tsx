import { formatDate, formatTime, todayIso } from "@/lib/format";
import { cn } from "@/lib/utils";

/** "Precios de las 18:05" o "Precios del 14 oct 2026, 17:35", con avisos de fallos. */
export function QuoteFreshness({
  oldest,
  failed,
  missing,
  className,
}: {
  oldest: string | null;
  failed: number;
  missing: number;
  className?: string;
}) {
  const parts: string[] = [];
  if (oldest) {
    const date = new Date(oldest);
    const day = todayIso(date);
    parts.push(day === todayIso() ? `Precios de las ${formatTime(date)}` : `Precios del ${formatDate(day)}, ${formatTime(date)}`);
  }
  if (failed > 0) parts.push(`${failed} sin actualizar: se muestra el último precio guardado`);
  if (missing > 0) parts.push(`${missing} ${missing === 1 ? "activo" : "activos"} sin precio`);
  if (parts.length === 0) return null;
  return <p className={cn("text-xs text-pretty text-text-muted", className)}>{parts.join(" · ")}</p>;
}
