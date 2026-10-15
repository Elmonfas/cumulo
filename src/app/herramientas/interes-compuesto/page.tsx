import { TrendingUp } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { EmptyState } from "@/components/empty-state";
import { PageHeader } from "@/components/layout/page-header";
import { buttonVariants } from "@/components/ui/button";

export const metadata: Metadata = { title: "Interés compuesto" };

export default function CompoundInterestPage() {
  return (
    <>
      <PageHeader title="Interés compuesto" description="Capitalización mensual con aportaciones." />
      <EmptyState
        icon={TrendingUp}
        title="La calculadora está en camino"
        description="Podrás simular capital inicial, aportación mensual, rentabilidad e inflación."
        actions={
          <Link href="/herramientas" className={buttonVariants({ size: "lg", variant: "outline" })}>
            Volver a herramientas
          </Link>
        }
        footnote="Llega en la Fase 1."
      />
    </>
  );
}
