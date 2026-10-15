import type { Metadata } from "next";
import { ImportScreen } from "@/components/import/import-screen";

export const metadata: Metadata = { title: "Importar CSV" };

export default function ImportPage() {
  return <ImportScreen />;
}
