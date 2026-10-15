"use client";

import Decimal from "decimal.js";
import { Bell, BellOff, Trash2 } from "lucide-react";
import { useCallback, useState, useSyncExternalStore, type FormEvent } from "react";
import { Button } from "@/components/ui/button";
import { DecimalField } from "@/components/ui/decimal-field";
import { getRepositories, type Repositories } from "@/data/repositories";
import type { PriceAlert } from "@/domain/models";
import { useLiveQuery } from "@/hooks/use-live-query";
import { formatCurrency, formatDate, formatTime } from "@/lib/format";
import { notificationPermission, requestNotificationPermission, showNotification } from "@/lib/notifications";
import { parseDecimal } from "@/lib/parse";
import { cn } from "@/lib/utils";
import { checkAlerts, createAlert } from "@/services/alerts";

const noopSubscribe = () => () => {};

/** Alertas de precio de un activo: crear, ver y borrar. */
export function PriceAlerts({ assetId, currentPrice }: { assetId: string; currentPrice: string | null }) {
  const query = useCallback((repositories: Repositories) => repositories.alerts.listByAsset(assetId), [assetId]);
  const alerts = useLiveQuery(query);
  const [direction, setDirection] = useState<PriceAlert["direction"]>("above");
  const [price, setPrice] = useState("");
  const [error, setError] = useState<string | null>(null);
  const permissionAtLoad = useSyncExternalStore(noopSubscribe, notificationPermission, () => "default" as const);
  const [permission, setPermission] = useState<string | null>(null);
  const effectivePermission = permission ?? permissionAtLoad;

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    const value = parseDecimal(price);
    if (!value || !value.gt(0)) {
      setError("Introduce un precio mayor que 0.");
      return;
    }
    setError(null);
    const repositories = getRepositories();
    await createAlert(repositories, assetId, direction, value);
    setPrice("");
    // Si ya se cumple con el precio actual, avisa en el momento.
    await checkAlerts(repositories, showNotification);
  }

  const sorted = alerts.status === "ready" ? [...alerts.data].sort((a, b) => Number(Boolean(a.triggeredAt)) - Number(Boolean(b.triggeredAt))) : [];

  return (
    <section aria-labelledby="price-alerts" className="grid gap-3 rounded-2xl border border-border p-4">
      <div className="flex items-center justify-between gap-3">
        <h3 id="price-alerts" className="text-sm font-medium">
          Alertas de precio
        </h3>
        {effectivePermission === "granted" ? (
          <span className="flex items-center gap-1 text-xs text-text-muted">
            <Bell className="size-3.5" aria-hidden />
            Avisos activados
          </span>
        ) : effectivePermission === "unsupported" ? (
          <span className="flex items-center gap-1 text-xs text-text-muted">
            <BellOff className="size-3.5" aria-hidden />
            Sin avisos en este navegador
          </span>
        ) : (
          <Button variant="ghost" size="sm" onClick={async () => setPermission(await requestNotificationPermission())}>
            <Bell aria-hidden />
            Activar avisos
          </Button>
        )}
      </div>

      {sorted.length > 0 && (
        <ul className="grid gap-1.5">
          {sorted.map((a) => (
            <li
              key={a.id}
              className={cn("flex items-center gap-3 rounded-xl bg-surface-2 px-3 py-2 text-sm", a.triggeredAt && "opacity-70")}
            >
              <span className="min-w-0 flex-1">
                <span className="block font-medium tabular-nums">
                  {a.direction === "above" ? "Sube de" : "Baja de"} {formatCurrency(a.price)}
                </span>
                <span className="block text-xs text-text-muted tabular-nums">
                  {a.triggeredAt
                    ? `Se cumplió el ${formatDate(a.triggeredAt.slice(0, 10))} a las ${formatTime(a.triggeredAt)} (${formatCurrency(a.triggeredPrice ?? a.price)})`
                    : "Activa"}
                </span>
              </span>
              <Button
                variant="ghost"
                size="icon-sm"
                aria-label="Borrar alerta"
                onClick={() => void getRepositories().alerts.remove(a.id)}
              >
                <Trash2 aria-hidden />
              </Button>
            </li>
          ))}
        </ul>
      )}

      <form onSubmit={onSubmit} className="grid gap-3">
        <div role="radiogroup" aria-label="Condición" className="grid grid-cols-2 gap-1 rounded-full bg-surface-2 p-1">
          {(["above", "below"] as const).map((d) => (
            <button
              key={d}
              type="button"
              role="radio"
              aria-checked={direction === d}
              onClick={() => setDirection(d)}
              className={cn(
                "h-8 rounded-full text-xs font-medium transition-colors outline-none focus-visible:ring-3 focus-visible:ring-accent/40",
                direction === d ? "bg-accent text-accent-foreground" : "text-text-muted hover:text-text",
              )}
            >
              {d === "above" ? "Si sube de" : "Si baja de"}
            </button>
          ))}
        </div>
        <DecimalField
          label="Precio"
          suffix="€"
          value={price}
          onValueChange={setPrice}
          error={error}
          placeholder={currentPrice ? new Decimal(currentPrice).toFixed(2).replace(".", ",") : "0,00"}
          hint="Avisa una vez, con la app abierta: no hay servidor que vigile tus datos."
        />
        <Button type="submit" variant="secondary">
          Crear alerta
        </Button>
      </form>
    </section>
  );
}
