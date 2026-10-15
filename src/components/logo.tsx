import { cn } from "@/lib/utils";

/** Marca de cúmulo: una nube de tres burbujas apiladas. */
export function LogoMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 32 32" aria-hidden className={cn("size-8", className)}>
      <rect width="32" height="32" rx="10" className="fill-accent" />
      <g className="fill-accent-foreground" transform="translate(-0.25 0.5)">
        <circle cx="11.5" cy="18.5" r="4.5" />
        <circle cx="17" cy="14" r="6" />
        <circle cx="21.5" cy="19" r="4" />
        <rect x="11.5" y="17" width="10" height="6" />
      </g>
    </svg>
  );
}
