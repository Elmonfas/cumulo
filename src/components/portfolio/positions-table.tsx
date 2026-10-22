"use client";

import type Decimal from "decimal.js";
import { ArrowDown, ArrowUp } from "lucide-react";
import { AssetAvatar } from "@/components/asset-avatar";
import { Card } from "@/components/ui/card";
import { VariationAmount, VariationBadge } from "@/components/variation-badge";
import type { PositionValuation } from "@/domain/valuation";
import type { PortfolioData } from "@/hooks/use-portfolio";
import { formatCurrency, formatPercent, formatQuantity } from "@/lib/format";
import { ASSET_TYPE_LABELS } from "@/lib/labels";
import { cn } from "@/lib/utils";

export type SortKey = "name" | "quantity" | "price" | "value" | "weight" | "return";
export interface SortState {
  key: SortKey;
  desc: boolean;
}

// Cantidad y peso tienen columna propia solo en pantallas muy anchas (2xl); si no, van bajo el nombre.
// Tabla de ancho fijo: las cifras tienen su ancho y el nombre se queda con el resto (cortado con «…»).
// Nunca hay scroll horizontal.
const COLUMNS: { key: SortKey; label: string; align: "left" | "right"; className?: string }[] = [
  { key: "name", label: "Activo", align: "left" },
  { key: "quantity", label: "Cantidad", align: "right", className: "hidden w-32 2xl:table-cell" },
  { key: "price", label: "Precio", align: "right", className: "w-28" },
  { key: "value", label: "Valor", align: "right", className: "w-28" },
  { key: "weight", label: "Peso", align: "right", className: "hidden w-20 2xl:table-cell" },
  { key: "return", label: "Rentabilidad", align: "right", className: "w-32" },
];

const metric = (p: PositionValuation, key: Exclude<SortKey, "name">): Decimal | null =>
  ({
    quantity: p.position.quantity,
    price: p.price,
    value: p.marketValue,
    weight: p.weight,
    return: p.unrealizedPct,
  })[key] ?? null;

/** Ordena las posiciones; las que no tienen el dato van siempre al final. */
export function sortPositions(positions: readonly PositionValuation[], { key, desc }: SortState, data: PortfolioData) {
  const name = (p: PositionValuation) => data.assets.get(p.position.assetId)?.name ?? "";
  return [...positions].sort((a, b) => {
    if (key === "name") return (desc ? -1 : 1) * name(a).localeCompare(name(b), "es");
    const x = metric(a, key);
    const y = metric(b, key);
    if (!x || !y) return x ? -1 : y ? 1 : 0;
    return (desc ? -1 : 1) * x.comparedTo(y);
  });
}

/** Posiciones abiertas en tabla ordenable (solo escritorio ancho). */
export function PositionsTable({
  positions,
  data,
  sort,
  onSort,
  selected,
  onSelect,
}: {
  positions: readonly PositionValuation[];
  data: PortfolioData;
  sort: SortState;
  onSort: (sort: SortState) => void;
  selected: string | null;
  onSelect: (assetId: string) => void;
}) {
  return (
    <Card className="overflow-hidden p-0 md:p-0">
      <table className="w-full table-fixed text-sm tabular-nums">
        <caption className="sr-only">Posiciones abiertas. Usa ↑ y ↓ para cambiar de posición.</caption>
        <thead>
          <tr className="border-b border-border text-xs text-text-muted">
            {COLUMNS.map((c) => {
              const active = sort.key === c.key;
              const Arrow = sort.desc ? ArrowDown : ArrowUp;
              return (
                <th
                  key={c.key}
                  scope="col"
                  aria-sort={active ? (sort.desc ? "descending" : "ascending") : "none"}
                  className={cn("px-2.5 py-2.5 font-medium first:pl-4 last:pr-4", c.align === "right" ? "text-right" : "text-left", c.className)}
                >
                  <button
                    type="button"
                    onClick={() => onSort({ key: c.key, desc: active ? !sort.desc : c.key !== "name" })}
                    className={cn(
                      "inline-flex items-center gap-1 rounded-full outline-none hover:text-text focus-visible:ring-3 focus-visible:ring-accent/40",
                      active && "text-text",
                    )}
                  >
                    {c.label}
                    <Arrow className={cn("size-3", !active && "invisible")} aria-hidden />
                  </button>
                </th>
              );
            })}
          </tr>
        </thead>
        <tbody>
          {positions.map((p) => {
            const asset = data.assets.get(p.position.assetId);
            const isSelected = p.position.assetId === selected;
            return (
              <tr
                key={p.position.assetId}
                id={`posicion-${p.position.assetId}`}
                tabIndex={0}
                aria-selected={isSelected}
                onClick={() => onSelect(p.position.assetId)}
                onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && (e.preventDefault(), onSelect(p.position.assetId))}
                className={cn(
                  "cursor-pointer border-b border-border transition-colors outline-none last:border-0 focus-visible:bg-surface-2",
                  isSelected ? "bg-accent/10" : "hover:bg-surface-2",
                )}
              >
                <td className="py-2.5 pr-2.5 pl-4">
                  <span className="flex min-w-0 items-center gap-3 overflow-hidden">
                    {asset && <AssetAvatar asset={asset} />}
                    <span className="min-w-0 flex-1">
                      <span className={cn("block truncate font-medium", isSelected && "text-accent")}>{asset?.name ?? "Activo"}</span>
                      <span className="block truncate text-xs text-text-muted">
                        {asset ? ASSET_TYPE_LABELS[asset.type] : ""}
                        <span className="2xl:hidden">
                          {" · "}
                          {formatQuantity(p.position.quantity)} uds{p.weight ? ` · ${formatPercent(p.weight, { signed: false })}` : ""}
                        </span>
                      </span>
                    </span>
                  </span>
                </td>
                <td className="hidden px-2.5 text-right 2xl:table-cell">{formatQuantity(p.position.quantity)}</td>
                <td className="px-2.5 text-right whitespace-nowrap">{p.price ? formatCurrency(p.price) : <span className="text-text-muted">—</span>}</td>
                <td className="px-2.5 text-right font-medium whitespace-nowrap">
                  {p.marketValue ? formatCurrency(p.marketValue) : <span className="text-text-muted">Sin precio</span>}
                </td>
                <td className="hidden px-2.5 text-right 2xl:table-cell">{p.weight ? formatPercent(p.weight, { signed: false }) : "—"}</td>
                <td className="py-2.5 pr-4 pl-2.5 text-right">
                  {p.unrealized ? (
                    <span className="flex flex-col items-end gap-1">
                      <VariationBadge ratio={p.unrealizedPct} />
                      <VariationAmount value={p.unrealized} format={(v) => formatCurrency(v, { signed: true })} className="text-xs" />
                    </span>
                  ) : (
                    <span className="text-text-muted">—</span>
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </Card>
  );
}
