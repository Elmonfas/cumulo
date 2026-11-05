"use client";

import { Share, SquarePlus, X } from "lucide-react";
import { useState, useSyncExternalStore, type ReactNode } from "react";
import { Card } from "@/components/ui/card";
import { isIos, isStandalone } from "@/lib/device";
import { cn } from "@/lib/utils";

const DISMISSED_KEY = "cumulo:install-dismissed";

const noopSubscribe = () => () => {};

function shouldOffer() {
  let dismissed = false;
  try {
    dismissed = localStorage.getItem(DISMISSED_KEY) === "1";
  } catch {}
  return !dismissed && isIos() && !isStandalone();
}

/**
 * Solo en iPhone/iPad con Safari sin instalar: Safari borra los datos de las
 * webs que no se abren en 7 días, y las notificaciones exigen la app instalada.
 */
export function InstallCard({ className }: { className?: string }) {
  // El servidor no sabe qué dispositivo es: allí nunca se pinta.
  const offer = useSyncExternalStore(noopSubscribe, shouldOffer, () => false);
  const [closed, setClosed] = useState(false);

  if (!offer || closed) return null;

  function dismiss() {
    try {
      localStorage.setItem(DISMISSED_KEY, "1");
    } catch {}
    setClosed(true);
  }

  return (
    <Card className={cn("relative grid gap-3", className)} aria-labelledby="install-title">
      <button
        type="button"
        onClick={dismiss}
        aria-label="Cerrar"
        className="absolute top-3 right-3 flex size-9 items-center justify-center rounded-full text-text-muted outline-none hover:bg-surface-2 hover:text-text focus-visible:ring-3 focus-visible:ring-accent/40"
      >
        <X className="size-4" aria-hidden />
      </button>
      <div className="pr-10">
        <h2 id="install-title" className="font-medium">
          Instala cúmulo en tu iPhone
        </h2>
        <p className="mt-1 text-sm text-pretty text-text-muted">
          Safari borra los datos de las webs que no abres en 7 días. Instalada, tu cartera se queda y recibes avisos.
        </p>
      </div>
      <ol className="grid gap-2 text-sm">
        <Step n={1}>
          Toca <Share className="mx-0.5 inline size-4 -translate-y-px text-accent" aria-label="Compartir" /> en la barra de Safari
        </Step>
        <Step n={2}>
          Elige <SquarePlus className="mx-0.5 inline size-4 -translate-y-px text-accent" aria-hidden /> «Añadir a pantalla de inicio»
        </Step>
        <Step n={3}>Abre cúmulo desde su icono</Step>
      </ol>
    </Card>
  );
}

function Step({ n, children }: { n: number; children: ReactNode }) {
  return (
    <li className="flex items-center gap-3">
      <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-accent/15 text-xs font-medium text-accent tabular-nums">
        {n}
      </span>
      <span className="text-pretty">{children}</span>
    </li>
  );
}
