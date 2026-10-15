import type { Metadata } from "next";
import { TransactionsScreen } from "@/components/transactions/transactions-screen";

export const metadata: Metadata = { title: "Operaciones" };

export default function TransactionsPage() {
  return <TransactionsScreen />;
}
