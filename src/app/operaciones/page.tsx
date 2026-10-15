import { ArrowLeftRight, FileUp, Plus } from "lucide-react";
import type { Metadata } from "next";
import { EmptyState } from "@/components/empty-state";
import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";

export const metadata: Metadata = { title: "Operaciones" };

export default function TransactionsPage() {
  return (
    <>
      <PageHeader title="Operaciones" description="Compras, ventas, depósitos y retiradas." />
      <EmptyState
        icon={ArrowLeftRight}
        title="Sin operaciones todavía"
        description="Importa la exportación de transacciones de Trade Republic o añade operaciones a mano."
        actions={
          <>
            <Button size="lg" disabled>
              <FileUp aria-hidden />
              Importar CSV
            </Button>
            <Button size="lg" variant="outline" disabled>
              <Plus aria-hidden />
              Añadir operación
            </Button>
          </>
        }
        footnote="El registro manual llega en la Fase 2 y el importador en la Fase 3."
      />
    </>
  );
}
