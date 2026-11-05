import { ChevronRight, FileUp, ListPlus, ShieldCheck, type LucideIcon } from "lucide-react";
import Link from "next/link";
import { RestoreBackup } from "@/components/backup/restore-backup";
import { Card } from "@/components/ui/card";

/** Inicio sin datos: elegir cómo empezar. */
export function Welcome() {
  return (
    <div className="grid grid-cols-[minmax(0,1fr)] gap-4 md:gap-5">
      <div className="px-1">
        <h2 className="text-2xl font-medium tracking-tight text-balance">¿Cómo quieres empezar?</h2>
        <p className="mt-1 text-sm text-pretty text-text-muted">Elige una opción. Puedes combinarlas después.</p>
      </div>

      <div className="grid grid-cols-[minmax(0,1fr)] gap-4 md:grid-cols-2 md:gap-5">
        <Path
          href="/cartera/anadir"
          icon={ListPlus}
          title="Añadir lo que tengo"
          description="Cantidad y precio medio de cada activo. Tu cartera, con precios en vivo, en 30 segundos."
          badge="Lo más rápido"
        />
        <Path
          href="/operaciones/importar"
          icon={FileUp}
          title="Tengo Trade Republic"
          description="Importa todo tu historial con el archivo que exporta la app. Para la Renta y las gráficas completas."
        />
      </div>

      <Card className="flex flex-wrap items-center justify-between gap-3 py-4 md:py-4">
        <p className="text-sm text-pretty text-text-muted">¿Ya usabas cúmulo en otro dispositivo?</p>
        <RestoreBackup label="Restaurar copia" variant="secondary" replacesData={false} />
      </Card>

      <p className="flex items-center justify-center gap-2 px-1 text-center text-xs text-pretty text-text-muted">
        <ShieldCheck className="size-4 shrink-0" aria-hidden />
        Tus datos se guardan solo en este dispositivo. Nunca te pediremos la contraseña de tu bróker.
      </p>
    </div>
  );
}

function Path({
  href,
  icon: Icon,
  title,
  description,
  badge,
}: {
  href: string;
  icon: LucideIcon;
  title: string;
  description: string;
  badge?: string;
}) {
  return (
    <Link
      href={href}
      className="group flex items-start gap-4 rounded-card border border-border bg-surface p-5 shadow-card transition-colors duration-150 ease-out outline-none hover:border-accent/50 focus-visible:ring-3 focus-visible:ring-accent/40 md:p-6"
    >
      <span className="flex size-12 shrink-0 items-center justify-center rounded-full bg-accent/15 text-accent">
        <Icon className="size-5" aria-hidden />
      </span>
      <span className="min-w-0 flex-1">
        <span className="flex flex-wrap items-center gap-2">
          <span className="font-medium">{title}</span>
          {badge && <span className="rounded-full bg-accent/15 px-2 py-0.5 text-[11px] font-medium text-accent">{badge}</span>}
        </span>
        <span className="mt-1 block text-sm text-pretty text-text-muted">{description}</span>
      </span>
      <ChevronRight
        className="mt-3 size-5 shrink-0 text-text-muted transition-transform duration-150 ease-out group-hover:translate-x-0.5"
        aria-hidden
      />
    </Link>
  );
}
