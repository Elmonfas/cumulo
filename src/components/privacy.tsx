"use client";

import { Eye, EyeOff } from "lucide-react";
import { Fragment, type ReactNode } from "react";
import { setAmountsHidden } from "@/lib/format";
import { setPrivacy, usePrivacy } from "@/lib/privacy";
import { cn } from "@/lib/utils";

/**
 * Aplica el modo privado a todo lo que hay dentro. Al cambiarlo se vuelve a
 * montar el contenido para que todas las cifras se formateen de nuevo.
 */
export function PrivacyBoundary({ children }: { children: ReactNode }) {
  const hidden = usePrivacy();
  setAmountsHidden(hidden);
  return <Fragment key={hidden ? "hidden" : "visible"}>{children}</Fragment>;
}

/** Botón del ojo para ocultar o mostrar los importes. */
export function PrivacyToggle({ className }: { className?: string }) {
  const hidden = usePrivacy();
  const Icon = hidden ? EyeOff : Eye;
  return (
    <button
      type="button"
      onClick={() => setPrivacy(!hidden)}
      aria-pressed={hidden}
      aria-label={hidden ? "Mostrar importes" : "Ocultar importes"}
      title={hidden ? "Mostrar importes" : "Ocultar importes"}
      className={cn(
        "flex size-10 shrink-0 items-center justify-center rounded-full border border-border bg-surface transition-colors outline-none hover:text-text focus-visible:ring-3 focus-visible:ring-accent/40",
        hidden ? "text-accent" : "text-text-muted",
        className,
      )}
    >
      <Icon className="size-5" aria-hidden />
    </button>
  );
}
