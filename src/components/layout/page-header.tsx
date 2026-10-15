import Link from "next/link";
import type { ReactNode } from "react";
import { SETTINGS_NAV } from "./nav-items";

interface PageHeaderProps {
  title: string;
  description?: string;
  /** Muestra el acceso a Ajustes en móvil (en desktop está en la sidebar). */
  showSettings?: boolean;
  actions?: ReactNode;
}

export function PageHeader({ title, description, showSettings = true, actions }: PageHeaderProps) {
  const SettingsIcon = SETTINGS_NAV.icon;
  return (
    <header className="mb-4 flex items-start justify-between gap-4 md:mb-5">
      <div className="min-w-0">
        <h1 className="text-2xl font-semibold tracking-[-0.01em] md:text-3xl">{title}</h1>
        {description && <p className="mt-1 text-sm text-text-muted">{description}</p>}
      </div>
      <div className="flex shrink-0 items-center gap-2">
        {actions}
        {showSettings && (
          <Link
            href={SETTINGS_NAV.href}
            aria-label={SETTINGS_NAV.label}
            className="flex size-10 items-center justify-center rounded-full border border-border bg-surface text-text-muted transition-colors outline-none hover:text-text focus-visible:ring-3 focus-visible:ring-accent/40 md:hidden"
          >
            <SettingsIcon className="size-5" aria-hidden />
          </Link>
        )}
      </div>
    </header>
  );
}
