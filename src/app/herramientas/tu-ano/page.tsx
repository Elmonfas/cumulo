import type { Metadata } from "next";
import { YearScreen } from "@/components/year/year-screen";

export const metadata: Metadata = { title: "Tu año en cúmulo" };

export default function YearPage() {
  return <YearScreen />;
}
