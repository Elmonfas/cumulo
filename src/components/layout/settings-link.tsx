"use client";

import Link from "next/link";
import type { Repositories } from "@/data/repositories";
import { useLiveQuery } from "@/hooks/use-live-query";
import { SETTINGS_NAV } from "./nav-items";

const loadSettings = (repositories: Repositories) => repositories.settings.get();

/** Acceso a Ajustes en la cabecera móvil; muestra la foto de perfil si existe. */
export function SettingsLink() {
  const settings = useLiveQuery(loadSettings);
  const avatar = settings.status === "ready" ? settings.data.avatar : undefined;
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
