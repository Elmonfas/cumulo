import type { ReactNode } from "react";
import { PrivacyBoundary } from "@/components/privacy";
import { BottomNav } from "./bottom-nav";
import { Sidebar } from "./sidebar";

export function AppShell({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-dvh md:pl-20">
      <a
        href="#contenido"
        className="sr-only z-50 rounded-full bg-accent px-4 py-2 text-sm font-medium text-accent-foreground focus:not-sr-only focus:fixed focus:top-3 focus:left-3"
      >
        Saltar al contenido
      </a>
      <Sidebar />
      <main
        id="contenido"
        tabIndex={-1}
        className="mx-auto w-full max-w-5xl px-4 pt-[calc(env(safe-area-inset-top)+1rem)] pb-[calc(env(safe-area-inset-bottom)+6rem)] outline-none md:px-8 md:pt-8 md:pb-12"
      >
        <PrivacyBoundary>{children}</PrivacyBoundary>
      </main>
      <BottomNav />
    </div>
  );
}
