import type { Metadata } from "next";
import { GoalsScreen } from "@/components/goals/goals-screen";

export const metadata: Metadata = { title: "Objetivos" };

export default function GoalsPage() {
  return <GoalsScreen />;
}
