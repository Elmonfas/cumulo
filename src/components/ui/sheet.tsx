"use client";

import { Dialog } from "@base-ui/react/dialog";
import { X } from "lucide-react";
import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

interface SheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description?: string;
  children: ReactNode;
  footer?: ReactNode;
  className?: string;
}

/** Hoja inferior en móvil y diálogo centrado en desktop. */
export function Sheet({ open, onOpenChange, title, description, children, footer, className }: SheetProps) {
  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Backdrop className="fixed inset-0 z-40 min-h-dvh bg-black/40 transition-opacity duration-200 data-ending-style:opacity-0 data-starting-style:opacity-0 dark:bg-black/60" />
        <Dialog.Popup
          className={cn(
            "fixed inset-x-0 bottom-0 z-50 flex max-h-[92dvh] flex-col rounded-t-[1.75rem] border border-b-0 border-border bg-surface text-text outline-none transition-[transform,opacity] duration-200 ease-out data-ending-style:translate-y-full data-starting-style:translate-y-full",
            "md:inset-x-auto md:bottom-auto md:top-1/2 md:left-1/2 md:max-h-[85dvh] md:w-[30rem] md:-translate-x-1/2 md:-translate-y-1/2 md:rounded-card md:border-b md:data-ending-style:translate-y-[-48%] md:data-ending-style:opacity-0 md:data-starting-style:translate-y-[-48%] md:data-starting-style:opacity-0",
            className,
          )}
        >
          <div className="mx-auto mt-2.5 h-1 w-10 shrink-0 rounded-full bg-border md:hidden" aria-hidden />
          <header className="flex items-start justify-between gap-4 px-5 pt-3 pb-2 md:px-6 md:pt-6">
            <div className="min-w-0">
              <Dialog.Title className="text-lg font-semibold">{title}</Dialog.Title>
              {description && <Dialog.Description className="mt-0.5 text-sm text-text-muted">{description}</Dialog.Description>}
            </div>
            <Dialog.Close
              aria-label="Cerrar"
              className="-mr-1 flex size-9 shrink-0 items-center justify-center rounded-full text-text-muted transition-colors outline-none hover:bg-surface-2 hover:text-text focus-visible:ring-3 focus-visible:ring-accent/40"
            >
              <X className="size-5" aria-hidden />
            </Dialog.Close>
          </header>
          <div
            className={cn(
              "min-h-0 flex-1 overflow-y-auto overscroll-contain px-5 md:px-6",
              footer ? "pb-4" : "pb-[calc(env(safe-area-inset-bottom)+1.25rem)] md:pb-6",
            )}
          >
            {children}
          </div>
          {footer && (
            <footer className="flex flex-col-reverse gap-2 border-t border-border px-5 pt-3 pb-[calc(env(safe-area-inset-bottom)+0.75rem)] sm:flex-row sm:justify-end md:px-6 md:pb-6">
              {footer}
            </footer>
          )}
        </Dialog.Popup>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
