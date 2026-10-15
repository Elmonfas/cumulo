import { ShieldCheck } from "lucide-react";
import type { Metadata } from "next";
import { PageHeader } from "@/components/layout/page-header";
import { ThemeSelector } from "@/components/theme-selector";
import { Card } from "@/components/ui/card";

export const metadata: Metadata = { title: "Ajustes" };

export default function SettingsPage() {
  return (
    <>
      <PageHeader title="Ajustes" showSettings={false} />
      <div className="grid gap-4 md:gap-5">
        <Card>
          <h2 className="font-medium">Apariencia</h2>
          <p className="mt-1 mb-4 text-sm text-text-muted">Elige un tema o sigue el de tu dispositivo.</p>
          <ThemeSelector />
        </Card>
        <Card className="flex gap-4">
          <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-accent/15 text-accent">
            <ShieldCheck className="size-5" aria-hidden />
          </span>
          <div>
            <h2 className="font-medium">Tus datos no salen de aquí</h2>
            <p className="mt-1 text-sm text-pretty text-text-muted">
              Operaciones, cantidades y ajustes se guardan solo en este navegador. Para pedir precios únicamente se
              envían tickers o ISIN.
            </p>
          </div>
        </Card>
      </div>
    </>
  );
}
