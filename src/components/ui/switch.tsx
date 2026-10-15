"use client";

import { cn } from "@/lib/utils";

interface SwitchProps {
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
  label: string;
  description?: string;
  className?: string;
}

export function Switch({ checked, onCheckedChange, label, description, className }: SwitchProps) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={() => onCheckedChange(!checked)}
      className={cn(
        "flex w-full items-center justify-between gap-4 rounded-2xl text-left outline-none focus-visible:ring-3 focus-visible:ring-accent/40",
        className,
      )}
    >
      <span className="min-w-0">
        <span className="block text-sm font-medium">{label}</span>
        {description && <span className="block text-xs text-text-muted">{description}</span>}
      </span>
      <span
        aria-hidden
        className={cn(
          "relative h-7 w-12 shrink-0 rounded-full border transition-colors",
          checked ? "border-accent bg-accent" : "border-border bg-surface-2",
        )}
      >
        <span
          className={cn(
            "absolute top-0.5 left-0.5 size-5.5 rounded-full shadow-sm transition-transform",
            checked ? "translate-x-5 bg-accent-foreground" : "bg-text-muted",
          )}
        />
      </span>
    </button>
  );
}
