import { CalendarSync, ChevronRight, Landmark, Sparkles, TrendingUp } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { PageHeader } from "@/components/layout/page-header";

export const metadata: Metadata = { title: "Herramientas" };

const TOOLS = [
  {
    href: "/herramientas/tu-ano",
    title: "Tu año en cúmulo",
    description: "Tu resumen del año: meses aportando, mejor mes, mejor compra y más.",
    icon: Sparkles,
  },
  {
    href: "/herramientas/renta",
    title: "Informe para la Renta",
    description: "Ganancias y pérdidas FIFO, regla de los dos meses, dividendos y cuota estimada.",
    icon: Landmark,
  },
  {
    href: "/herramientas/interes-compuesto",
    title: "Interés compuesto",
    description: "Proyecta aportaciones mensuales con o sin inflación.",
    icon: TrendingUp,
  },
  {
    href: "/herramientas/aportaciones",
    title: "Aportaciones periódicas",
    description: "Simula invertir cada mes en un activo con precios reales.",
    icon: CalendarSync,
  },
];

export default function ToolsPage() {
  return (
    <>
      <PageHeader title="Herramientas" description="Análisis y calculadoras para planificar." />
      <ul className="grid gap-4 md:grid-cols-2 md:gap-5">
        {TOOLS.map(({ href, title, description, icon: Icon }) => (
          <li key={href}>
            <Link
              href={href}
              className="flex items-center gap-4 rounded-card border border-border bg-surface p-5 shadow-card transition-colors outline-none hover:bg-surface-2 focus-visible:ring-3 focus-visible:ring-accent/40"
            >
              <span className="flex size-12 shrink-0 items-center justify-center rounded-full bg-accent/15 text-accent">
                <Icon className="size-5" aria-hidden />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block font-medium">{title}</span>
                <span className="block text-sm text-text-muted">{description}</span>
              </span>
              <ChevronRight className="size-5 text-text-muted" aria-hidden />
            </Link>
          </li>
        ))}
      </ul>
    </>
  );
}
