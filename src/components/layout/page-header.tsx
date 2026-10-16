import { ChevronLeft } from "lucide-react";
import Link from "next/link";
import type { ReactNode } from "react";
import { PrivacyToggle } from "@/components/privacy";
import { SettingsLink } from "./settings-link";

interface PageHeaderProps {
  title: string;
  description?: string;
  /** Muestra el acceso a Ajustes en móvil (en desktop está en la sidebar). */
  showSettings?: boolean;
  /** Botón del ojo para ocultar los importes. */
  showPrivacy?: boolean;
  actions?: ReactNode;
  /** Enlace para volver a la sección padre (subpantallas). */
  back?: { href: string; label: string };
}

export function PageHeader({ title, description, showSettings = true, showPrivacy = true, actions, back }: PageHeaderProps) {
  return (
    <header className="mb-4 flex items-start justify-between gap-4 md:mb-5">
      <div className="min-w-0">
        {back && (
          <Link
            href={back.href}
            className="-ml-1 mb-1 inline-flex items-center gap-0.5 rounded-full pr-2 text-sm text-text-muted transition-colors outline-none hover:text-text focus-visible:ring-3 focus-visible:ring-accent/40"
          >
            <ChevronLeft className="size-4" aria-hidden />
            {back.label}
          </Link>
        )}
        <h1 className="text-2xl font-semibold tracking-[-0.01em] md:text-3xl">{title}</h1>
        {description && <p className="mt-1 text-sm text-text-muted">{description}</p>}
      </div>
      <div className="flex shrink-0 items-center gap-2">
        {actions}
        {showPrivacy && <PrivacyToggle />}
        {showSettings && <SettingsLink />}
      </div>
    </header>
  );
}
