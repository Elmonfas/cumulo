"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { LogoMark } from "@/components/logo";
import { cn } from "@/lib/utils";
import { isActive, PRIMARY_NAV, SETTINGS_NAV, type NavItem } from "./nav-items";

function SidebarLink({ item, pathname }: { item: NavItem; pathname: string }) {
  const active = isActive(pathname, item.href);
  const Icon = item.icon;
  return (
    <Link
      href={item.href}
      aria-current={active ? "page" : undefined}
      className={cn(
        "group flex w-[4.5rem] flex-col items-center gap-1 rounded-2xl py-2 text-[11px] font-medium transition-colors outline-none focus-visible:ring-3 focus-visible:ring-accent/40",
        active ? "text-accent" : "text-text-muted hover:text-text",
      )}
    >
      <span
        className={cn(
          "flex h-9 w-12 items-center justify-center rounded-full transition-colors",
          active ? "bg-accent/15" : "group-hover:bg-surface-2",
        )}
      >
        <Icon className="size-5" aria-hidden strokeWidth={active ? 2.25 : 1.75} />
      </span>
      {item.label}
    </Link>
  );
}

export function Sidebar() {
  const pathname = usePathname();
  return (
    <aside className="fixed inset-y-0 left-0 z-30 hidden w-20 flex-col items-center border-r border-border bg-surface py-5 md:flex">
      <Link
        href="/"
        aria-label="cúmulo, inicio"
        className="mb-6 rounded-[10px] outline-none focus-visible:ring-3 focus-visible:ring-accent/40"
      >
        <LogoMark className="size-9" />
      </Link>
      <nav aria-label="Principal" className="flex flex-1 flex-col items-center gap-1">
        {PRIMARY_NAV.map((item) => (
          <SidebarLink key={item.href} item={item} pathname={pathname} />
        ))}
      </nav>
      <SidebarLink item={SETTINGS_NAV} pathname={pathname} />
    </aside>
  );
}
