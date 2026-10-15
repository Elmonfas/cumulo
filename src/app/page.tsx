import { Sparkles } from "lucide-react";
import Link from "next/link";
import { EmptyState } from "@/components/empty-state";
import { PageHeader } from "@/components/layout/page-header";
import { buttonVariants } from "@/components/ui/button";

export default function HomePage() {
  return (
    <>
      <PageHeader title="Inicio" description="Tu patrimonio, de un vistazo." />
      <EmptyState
        icon={Sparkles}
        title="Empieza tu cartera"
        description="Importa el CSV de Trade Republic o registra tu primera operación. Tus datos se guardan solo en este dispositivo."
        actions={
          <Link href="/operaciones" className={buttonVariants({ size: "lg" })}>
            Añadir operaciones
          </Link>
        }
      />
    </>
  );
}
