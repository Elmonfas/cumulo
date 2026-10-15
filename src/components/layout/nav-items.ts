import { ArrowLeftRight, House, PieChart, Settings, Wrench, type LucideIcon } from "lucide-react";

export interface NavItem {
  href: string;
  label: string;
  icon: LucideIcon;
}

export const PRIMARY_NAV: NavItem[] = [
  { href: "/", label: "Inicio", icon: House },
  { href: "/cartera", label: "Cartera", icon: PieChart },
  { href: "/operaciones", label: "Operaciones", icon: ArrowLeftRight },
  { href: "/herramientas", label: "Herramientas", icon: Wrench },
];

export const SETTINGS_NAV: NavItem = { href: "/ajustes", label: "Ajustes", icon: Settings };

export function isActive(pathname: string, href: string) {
  return href === "/" ? pathname === "/" : pathname === href || pathname.startsWith(`${href}/`);
}
