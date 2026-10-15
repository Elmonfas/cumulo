"use client";

import { AssetAvatar } from "@/components/asset-avatar";
import { LogoMark } from "@/components/logo";
import type { Asset } from "@/domain/models";
import { cn } from "@/lib/utils";

/**
 * Fila de activos sobre la gráfica principal: "Total" y cada posición
 * abierta. Cambia la gráfica al instante (los históricos ya están cargados).
 */
export function AssetSwitcher({
  assets,
  value,
  onChange,
}: {
  assets: Asset[];
  value: string | null;
  onChange: (assetId: string | null) => void;
}) {
  if (assets.length < 2) return null;
  return (
    <div role="radiogroup" aria-label="Ver la gráfica de" className="-mx-1 flex snap-x gap-1 overflow-x-auto px-1 pt-1 pb-2 [scrollbar-width:none]">
      <Chip label="Total" selected={value === null} onClick={() => onChange(null)}>
        <span className="flex size-10 items-center justify-center rounded-full bg-accent/15">
          <LogoMark className="size-6" />
        </span>
      </Chip>
      {assets.map((asset) => (
        <Chip
          key={asset.id}
          label={(asset.ticker ?? asset.name).split(".")[0].slice(0, 6)}
          title={asset.name}
          selected={value === asset.id}
          onClick={() => onChange(asset.id)}
        >
          <AssetAvatar asset={asset} />
        </Chip>
      ))}
    </div>
  );
}

function Chip({
  label,
  title,
  selected,
  onClick,
  children,
}: {
  label: string;
  title?: string;
  selected: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      role="radio"
      aria-checked={selected}
      aria-label={title ?? label}
      title={title ?? label}
      onClick={onClick}
      className="group flex w-14 shrink-0 snap-start flex-col items-center gap-1 rounded-2xl py-1 outline-none focus-visible:ring-3 focus-visible:ring-accent/40"
    >
      <span
        className={cn(
          "rounded-full p-0.5 ring-2 transition-[box-shadow,transform] duration-200 ease-out",
          selected ? "scale-105 ring-accent" : "ring-transparent group-hover:ring-border",
        )}
      >
        {children}
      </span>
      <span className={cn("max-w-full truncate text-[11px] font-medium transition-colors", selected ? "text-accent" : "text-text-muted")}>
        {label}
      </span>
    </button>
  );
}
