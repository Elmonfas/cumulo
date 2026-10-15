"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { SETTINGS_NAV } from "./nav-items";

/**
 * Acceso a Ajustes en la cabecera móvil; muestra la foto de perfil si existe.
 * Los repositorios se importan bajo demanda para no cargar IndexedDB en
 * páginas que no lo usan (p. ej. la calculadora).
 */
export function SettingsLink() {
  const [avatar, setAvatar] = useState<string | undefined>();

  useEffect(() => {
    let unsubscribe: (() => void) | undefined;
    let cancelled = false;
    import("@/data/repositories").then(({ getRepositories, subscribeToDataChanges }) => {
      if (cancelled) return;
      const load = () =>
        getRepositories()
          .settings.get()
          .then((s) => !cancelled && setAvatar(s.avatar));
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
