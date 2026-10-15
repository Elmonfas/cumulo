"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { SETTINGS_NAV } from "./nav-items";

/** Marca local: solo si hay foto merece la pena cargar IndexedDB en la cabecera. */
export const HAS_AVATAR_KEY = "cumulo:has-avatar";

export function rememberAvatar(hasAvatar: boolean) {
  try {
    if (hasAvatar) localStorage.setItem(HAS_AVATAR_KEY, "1");
    else localStorage.removeItem(HAS_AVATAR_KEY);
  } catch {
    // Sin almacenamiento: la cabecera mostrará el icono.
  }
}

function mayHaveAvatar() {
  try {
    return localStorage.getItem(HAS_AVATAR_KEY) === "1";
  } catch {
    return false;
  }
}

/**
 * Acceso a Ajustes en la cabecera móvil; muestra la foto de perfil si existe.
 * Los repositorios se importan bajo demanda, y solo si hay foto, para no
 * cargar IndexedDB en páginas que no lo usan (p. ej. la calculadora).
 */
export function SettingsLink() {
  const [avatar, setAvatar] = useState<string | undefined>();

  useEffect(() => {
    if (!mayHaveAvatar()) return;
    let unsubscribe: (() => void) | undefined;
    let cancelled = false;
    import("@/data/repositories").then(({ getRepositories, subscribeToDataChanges }) => {
      if (cancelled) return;
      const load = () =>
        getRepositories()
          .settings.get()
          .then((s) => {
            if (cancelled) return;
            setAvatar(s.avatar);
            if (!s.avatar) rememberAvatar(false);
          });
      void load();
      unsubscribe = subscribeToDataChanges(() => void load());
    });
    return () => {
      cancelled = true;
      unsubscribe?.();
    };
  }, []);

  const Icon = SETTINGS_NAV.icon;
  return (
    <Link
      href={SETTINGS_NAV.href}
      aria-label={SETTINGS_NAV.label}
      className="flex size-10 items-center justify-center overflow-hidden rounded-full border border-border bg-surface text-text-muted transition-colors outline-none hover:text-text focus-visible:ring-3 focus-visible:ring-accent/40 md:hidden"
    >
      {avatar ? (
        // eslint-disable-next-line @next/next/no-img-element -- dataURL local
        <img src={avatar} alt="" className="size-full object-cover" />
      ) : (
        <Icon className="size-5" aria-hidden />
      )}
    </Link>
  );
}
