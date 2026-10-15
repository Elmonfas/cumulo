import type { Metadata } from "next";
import { CompoundInterestCalculator } from "@/components/compound-interest/calculator";
import { PageHeader } from "@/components/layout/page-header";

export const metadata: Metadata = { title: "Interés compuesto" };

export default function CompoundInterestPage() {
  return (
    <>
      <PageHeader title="Interés compuesto" description="Capitalización mensual con aportaciones." />
      <CompoundInterestCalculator />
    </>
  );
}
