import type { Asset } from "@/domain/models";
import { cn } from "@/lib/utils";

/** Iniciales del activo sobre un círculo del color de acento. */
export function AssetAvatar({ asset, className }: { asset: Pick<Asset, "name" | "ticker">; className?: string }) {
  const source = asset.ticker || asset.name;
  const initials = source.replace(/[^A-Za-z0-9]/g, "").slice(0, asset.ticker ? 4 : 2).toUpperCase() || "?";
  return (
    <span
      aria-hidden
      className={cn(
        "flex size-10 shrink-0 items-center justify-center rounded-full bg-accent/15 font-mono text-[11px] font-semibold tracking-tight text-accent",
        className,
      )}
    >
      {initials}
    </span>
  );
}
