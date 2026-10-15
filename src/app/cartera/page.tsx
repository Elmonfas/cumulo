import type { Metadata } from "next";
import { PortfolioScreen } from "@/components/portfolio/portfolio-screen";

export const metadata: Metadata = { title: "Cartera" };

export default function PortfolioPage() {
  return <PortfolioScreen />;
}
