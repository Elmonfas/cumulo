"use client";

import { BellRing, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { getRepositories, type Repositories } from "@/data/repositories";
import { useLiveQuery } from "@/hooks/use-live-query";
import { formatCurrency, formatDate } from "@/lib/format";

const loadTriggered = async (repositories: Repositories) => {
  const [alerts, assets] = await Promise.all([repositories.alerts.list(), repositories.assets.list()]);
  const names = new Map(assets.map((a) => [a.id, a.name]));
  return alerts
    .filter((a) => a.triggeredAt)
    .sort((a, b) => (a.triggeredAt! < b.triggeredAt! ? 1 : -1))
    .map((a) => ({ ...a, assetName: names.get(a.assetId) ?? "Activo" }));
};

/** Alertas cumplidas, por si no llegó la notificación. Se descartan borrándolas. */
export function TriggeredAlerts({ className }: { className?: string }) {
  const triggered = useLiveQuery(loadTriggered);
  if (triggered.status !== "ready" || triggered.data.length === 0) return null;
  return (
    <Card className={className} role="status">
      <h2 className="flex items-center gap-2 font-medium">
        <BellRing className="size-4 text-accent" aria-hidden />
        Alertas cumplidas
      </h2>
      <ul className="mt-2 divide-y divide-border">
        {triggered.data.map((a) => (
          <li key={a.id} className="flex items-center gap-3 py-2 text-sm">
            <span className="min-w-0 flex-1">
              <span className="block truncate font-medium">{a.assetName}</span>
              <span className="block text-xs text-text-muted tabular-nums">
                {a.direction === "above" ? "Subió de" : "Bajó de"} {formatCurrency(a.price)} · {formatCurrency(a.triggeredPrice ?? a.price)} el{" "}
                {formatDate(a.triggeredAt!.slice(0, 10))}
              </span>
            </span>
            <Button variant="ghost" size="icon-sm" aria-label="Descartar alerta" onClick={() => void getRepositories().alerts.remove(a.id)}>
              <X aria-hidden />
            </Button>
          </li>
        ))}
      </ul>
    </Card>
  );
}
