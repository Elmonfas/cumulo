import type { ReactNode } from "react";
import { BottomNav } from "./bottom-nav";
import { Sidebar } from "./sidebar";

export function AppShell({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-dvh md:pl-20">
      <Sidebar />
      <main className="mx-auto w-full max-w-5xl px-4 pt-[calc(env(safe-area-inset-top)+1rem)] pb-[calc(env(safe-area-inset-bottom)+6rem)] md:px-8 md:pt-8 md:pb-12">
        {children}
      </main>
      <BottomNav />
    </div>
  );
}
