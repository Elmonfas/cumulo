import type { Metadata } from "next";
import { QuickAddScreen } from "@/components/quick-add/quick-add-screen";

export const metadata: Metadata = { title: "Añadir lo que tengo" };

export default function QuickAddPage() {
  return <QuickAddScreen />;
}
