import { PieChart } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { EmptyState } from "@/components/empty-state";
import { PageHeader } from "@/components/layout/page-header";
import { buttonVariants } from "@/components/ui/button";

export const metadata: Metadata = { title: "Cartera" };

export default function PortfolioPage() {
  return (
    <>
      <PageHeader title="Cartera" description="Posiciones, coste y rentabilidad." />
      <EmptyState
        icon={PieChart}
        title="Aún no tienes posiciones"
        description="Cuando registres o importes operaciones, aquí verás cada activo con su valor y su rentabilidad."
        actions={
          <Link href="/operaciones" className={buttonVariants({ size: "lg" })}>
            Ir a operaciones
          </Link>
        }
      />
    </>
  );
}
