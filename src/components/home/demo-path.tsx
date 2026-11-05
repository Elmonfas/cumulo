"use client";

import { Eye, Loader2 } from "lucide-react";
import { useState } from "react";
import { enterDemo } from "@/services/demo";

/** «Ver un ejemplo»: abre la app con una cartera de ejemplo, sin tocar tus datos. */
export function DemoPath() {
  const [busy, setBusy] = useState(false);
  return (
    <button
      type="button"
      disabled={busy}
      onClick={() => {
        setBusy(true);
        void enterDemo().catch(() => setBusy(false));
      }}
      className="flex items-center gap-3 rounded-card border border-dashed border-border px-5 py-4 text-left transition-colors duration-150 ease-out outline-none hover:border-accent/50 focus-visible:ring-3 focus-visible:ring-accent/40 disabled:opacity-60"
    >
      {busy ? <Loader2 className="size-5 shrink-0 animate-spin text-accent" aria-hidden /> : <Eye className="size-5 shrink-0 text-accent" aria-hidden />}
      <span className="min-w-0 flex-1">
        <span className="block text-sm font-medium">Ver un ejemplo</span>
        <span className="block text-xs text-pretty text-text-muted">Una cartera de muestra para explorar la app. Tus datos no se tocan.</span>
      </span>
    </button>
  );
}
