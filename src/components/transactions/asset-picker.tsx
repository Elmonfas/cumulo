"use client";

import { Loader2, Plus, Search, X } from "lucide-react";
import { useCallback, useId, useState } from "react";
import { AssetAvatar } from "@/components/asset-avatar";
import { Button } from "@/components/ui/button";
import { getRepositories, type Repositories } from "@/data/repositories";
import type { Asset, AssetType } from "@/domain/models";
import { useAssetSearch } from "@/hooks/use-asset-search";
import { useLiveQuery } from "@/hooks/use-live-query";
import { formatCurrency } from "@/lib/format";
import { ASSET_TYPE_LABELS } from "@/lib/labels";
import { cn } from "@/lib/utils";
import type { AssetCandidate } from "@/prices/types";
import { createManualAsset, ensureAsset } from "@/services/transactions";

interface AssetPickerProps {
  value: Asset | null;
  onChange: (asset: Asset | null) => void;
  error?: string | null;
}

const listAssets = (repositories: Repositories) => repositories.assets.list();

function matches(asset: Asset, query: string) {
  const q = query.toLowerCase();
  return [asset.name, asset.ticker, asset.isin, asset.priceSourceId].some((field) => field?.toLowerCase().includes(q));
}

export function AssetPicker({ value, onChange, error }: AssetPickerProps) {
  const [query, setQuery] = useState("");
  const [busy, setBusy] = useState(false);
  const [manualOpen, setManualOpen] = useState(false);
  const inputId = useId();
  const assets = useLiveQuery(listAssets);
  const search = useAssetSearch(query);

  const pick = useCallback(
    async (load: () => Promise<Asset>) => {
      setBusy(true);
      try {
        onChange(await load());
        setQuery("");
        setManualOpen(false);
      } finally {
        setBusy(false);
      }
    },
    [onChange],
  );

  if (value) {
    return (
      <div className="grid min-w-0 grid-cols-[minmax(0,1fr)] gap-1.5">
        <span className="text-sm font-medium">Activo</span>
        <div className="flex items-center gap-3 rounded-2xl border border-border bg-surface-2 p-2.5 pr-2">
          <AssetAvatar asset={value} />
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium">{value.name}</p>
            <p className="truncate text-xs text-text-muted">
              {[ASSET_TYPE_LABELS[value.type], value.ticker, value.isin].filter(Boolean).join(" · ")}
            </p>
          </div>
          <Button variant="ghost" size="icon-sm" aria-label="Cambiar activo" onClick={() => onChange(null)}>
            <X aria-hidden />
          </Button>
        </div>
      </div>
    );
  }

  const trimmed = query.trim();
  const local = assets.status === "ready" && trimmed ? assets.data.filter((a) => matches(a, trimmed)).slice(0, 5) : [];
  const localSources = new Set(local.map((a) => `${a.priceSource}:${a.priceSourceId}`));
  const remote =
    search.status === "ready"
      ? [...search.result.securities, ...search.result.crypto].filter(
          (c) => !localSources.has(`${c.priceSource}:${c.priceSourceId}`),
        )
      : [];

  return (
    <div className="grid min-w-0 grid-cols-[minmax(0,1fr)] gap-1.5">
      <label htmlFor={inputId} className="text-sm font-medium">
        Activo
      </label>
      <div
        className={cn(
          "flex h-12 items-center gap-2 rounded-2xl border bg-surface-2 px-4 focus-within:border-accent focus-within:ring-3 focus-within:ring-accent/20",
          error ? "border-accent" : "border-border",
        )}
      >
        <Search className="size-4 shrink-0 text-text-muted" aria-hidden />
        <input
          id={inputId}
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Nombre, ticker o ISIN"
          autoComplete="off"
          size={1}
          className="w-full min-w-0 bg-transparent text-base outline-none placeholder:text-text-muted"
        />
        {(search.status === "loading" || busy) && <Loader2 className="size-4 shrink-0 animate-spin text-text-muted" aria-hidden />}
      </div>
      {error && <p className="text-xs text-accent">{error}</p>}
      {!trimmed && <p className="text-xs text-text-muted">Consejo: busca por ISIN para encontrar el listado en euros.</p>}

      {trimmed && (
        <div className="grid grid-cols-[minmax(0,1fr)] gap-1" role="listbox" aria-label="Resultados">
          {local.map((asset) => (
            <ResultRow
              key={asset.id}
              title={asset.name}
              subtitle={[ASSET_TYPE_LABELS[asset.type], asset.ticker, "En tu cartera"].filter(Boolean).join(" · ")}
              asset={asset}
              disabled={busy}
              onSelect={() => pick(async () => asset)}
            />
          ))}
          {remote.map((candidate) => (
            <ResultRow
              key={`${candidate.priceSource}:${candidate.priceSourceId}`}
              title={candidate.name}
              subtitle={candidateSubtitle(candidate)}
              asset={candidate}
              disabled={busy}
              onSelect={() => pick(() => ensureAsset(getRepositories(), candidate))}
            />
          ))}
          {search.status === "ready" && local.length === 0 && remote.length === 0 && (
            <p className="px-1 py-2 text-sm text-text-muted">Sin resultados para «{trimmed}».</p>
          )}
          {search.status === "error" && (
            <p className="px-1 py-2 text-sm text-text-muted">No se pudo buscar ahora. Puedes crear el activo a mano.</p>
          )}
          {search.status !== "loading" && trimmed.length >= 2 && !manualOpen && (
            <button
              type="button"
              onClick={() => setManualOpen(true)}
              className="flex items-center gap-3 rounded-2xl px-2.5 py-2 text-left text-sm text-accent transition-colors outline-none hover:bg-surface-2 focus-visible:ring-3 focus-visible:ring-accent/40"
            >
              <span className="flex size-10 items-center justify-center rounded-full border border-dashed border-accent/50">
                <Plus className="size-4" aria-hidden />
              </span>
              Crear «{trimmed}» a mano (precio manual)
            </button>
          )}
          {manualOpen && (
            <ManualAssetForm
              defaultName={trimmed}
              disabled={busy}
              onCancel={() => setManualOpen(false)}
              onCreate={(name, type) => pick(() => createManualAsset(getRepositories(), { name, type }))}
            />
          )}
        </div>
      )}
    </div>
  );
}

function candidateSubtitle(candidate: AssetCandidate) {
  const parts = [ASSET_TYPE_LABELS[candidate.type], candidate.priceSourceId.toUpperCase(), candidate.exchange];
  if (candidate.currency && candidate.currency !== "EUR") parts.push(candidate.currency);
  if (candidate.priceEur) parts.push(formatCurrency(candidate.priceEur));
  return parts.filter(Boolean).join(" · ");
}

function ResultRow({
  title,
  subtitle,
  asset,
  disabled,
  onSelect,
}: {
  title: string;
  subtitle: string;
  asset: Pick<Asset, "name" | "ticker">;
  disabled: boolean;
  onSelect: () => void;
}) {
  return (
    <button
      type="button"
      role="option"
      aria-selected={false}
      disabled={disabled}
      onClick={onSelect}
      className="flex w-full min-w-0 items-center gap-3 rounded-2xl px-2.5 py-2 text-left transition-colors outline-none hover:bg-surface-2 focus-visible:bg-surface-2 focus-visible:ring-3 focus-visible:ring-accent/40 disabled:opacity-50"
    >
      <AssetAvatar asset={asset} />
      <span className="min-w-0 flex-1">
        <span className="block truncate text-sm font-medium">{title}</span>
        <span className="block truncate text-xs text-text-muted tabular-nums">{subtitle}</span>
      </span>
    </button>
  );
}

const MANUAL_TYPES: AssetType[] = ["stock", "etf", "crypto", "other"];

function ManualAssetForm({
  defaultName,
  disabled,
  onCancel,
  onCreate,
}: {
  defaultName: string;
  disabled: boolean;
  onCancel: () => void;
  onCreate: (name: string, type: AssetType) => void;
}) {
  const [name, setName] = useState(defaultName);
  const [type, setType] = useState<AssetType>("other");
  return (
    <div className="grid gap-3 rounded-2xl border border-border p-3">
      <input
        aria-label="Nombre del activo"
        value={name}
        onChange={(e) => setName(e.target.value)}
        className="h-11 rounded-xl border border-border bg-surface-2 px-3 text-base outline-none focus:border-accent"
      />
      <div className="flex flex-wrap gap-1.5" role="radiogroup" aria-label="Tipo de activo">
        {MANUAL_TYPES.map((t) => (
          <button
            key={t}
            type="button"
            role="radio"
            aria-checked={type === t}
            onClick={() => setType(t)}
            className={cn(
              "h-8 rounded-full border px-3 text-sm transition-colors outline-none focus-visible:ring-3 focus-visible:ring-accent/40",
              type === t ? "border-accent bg-accent/15 text-accent" : "border-border text-text-muted hover:text-text",
            )}
          >
            {ASSET_TYPE_LABELS[t]}
          </button>
        ))}
      </div>
      <p className="text-xs text-text-muted">Sin fuente de precios: podrás poner su precio a mano en Cartera.</p>
      <div className="flex justify-end gap-2">
        <Button variant="ghost" size="sm" onClick={onCancel}>
          Cancelar
        </Button>
        <Button size="sm" disabled={disabled || !name.trim()} onClick={() => onCreate(name.trim(), type)}>
          Crear activo
        </Button>
      </div>
    </div>
  );
}
