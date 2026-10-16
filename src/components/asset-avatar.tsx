"use client";

import { useState } from "react";
import type { Asset } from "@/domain/models";
import { cn } from "@/lib/utils";

type AvatarAsset = Pick<Asset, "name" | "ticker"> & Partial<Pick<Asset, "priceSource" | "priceSourceId">>;

/**
 * Logo del activo (vía /api/logo) o sus iniciales sobre el acento. Mientras el
 * logo carga se ven las iniciales, y el logo aparece con un fundido corto.
 */
export function AssetAvatar({ asset, className }: { asset: AvatarAsset; className?: string }) {
  const logoKey =
    asset.priceSource && asset.priceSource !== "manual" && asset.priceSourceId ? `${asset.priceSource}:${asset.priceSourceId}` : null;
  const [failedKey, setFailedKey] = useState<string | null>(null);
  const [loadedKey, setLoadedKey] = useState<string | null>(null);
  const tryLogo = logoKey !== null && failedKey !== logoKey;
  const loaded = tryLogo && loadedKey === logoKey;

  const source = asset.ticker || asset.name;
  const initials = source.replace(/[^A-Za-z0-9]/g, "").slice(0, asset.ticker ? 4 : 2).toUpperCase() || "?";

  return (
    <span
      aria-hidden
      className={cn(
        "relative flex size-10 shrink-0 items-center justify-center overflow-hidden rounded-full font-mono text-[11px] font-semibold tracking-tight transition-colors duration-200",
        loaded ? "bg-white ring-1 ring-border" : "bg-accent/15 text-accent",
        className,
      )}
    >
      {!loaded && initials}
      {tryLogo && (
        // eslint-disable-next-line @next/next/no-img-element -- imagen pequeña servida por /api/logo con caché del CDN
        <img
          src={`/api/logo?key=${encodeURIComponent(logoKey)}`}
          alt=""
          loading="lazy"
          decoding="async"
          className={cn(
            "absolute inset-0 m-auto size-[78%] object-contain transition-opacity duration-200 ease-out",
            loaded ? "opacity-100" : "opacity-0",
          )}
          onLoad={() => setLoadedKey(logoKey)}
          onError={() => setFailedKey(logoKey)}
        />
      )}
    </span>
  );
}
