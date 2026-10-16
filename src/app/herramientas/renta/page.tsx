import type { Metadata } from "next";
import { TaxReportScreen } from "@/components/tax/tax-report-screen";

export const metadata: Metadata = { title: "Informe para la Renta" };

export default function TaxReportPage() {
  return <TaxReportScreen />;
}
