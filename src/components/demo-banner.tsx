"use client";

import { Eye } from "lucide-react";
import { useSyncExternalStore } from "react";
import { Button } from "@/components/ui/button";
import { isDemo } from "@/lib/demo";
import { exitDemo } from "@/services/demo";

const noopSubscribe = () => () => {};

/** Aviso fijo mientras se ve la cartera de ejemplo. */
export function DemoBanner() {
  const demo = useSyncExternalStore(noopSubscribe, isDemo, () => false);
  if (!demo) return null;
  return (
    <div
      role="status"
      className="mb-4 flex items-center gap-3 rounded-full border border-accent/40 bg-accent/10 py-1.5 pr-1.5 pl-4 md:mb-5"
    >
      <Eye className="size-4 shrink-0 text-accent" aria-hidden />
      <p className="min-w-0 flex-1 truncate text-sm">Cartera de ejemplo</p>
      <Button size="sm" onClick={() => exitDemo("/")} className="shrink-0">
        Usar la mía
      </Button>
    </div>
  );
}
