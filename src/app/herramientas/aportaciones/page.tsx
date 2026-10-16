import type { Metadata } from "next";
import { DcaSimulator } from "@/components/dca/dca-simulator";
import { PageHeader } from "@/components/layout/page-header";

export const metadata: Metadata = { title: "Aportaciones periódicas" };

export default function DcaPage() {
  return (
    <>
      <PageHeader
        title="Aportaciones periódicas"
        description="¿Y si hubieras invertido cada mes? Con precios reales."
        back={{ href: "/herramientas", label: "Herramientas" }}
      />
      <DcaSimulator />
    </>
  );
}
