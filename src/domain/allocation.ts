import Decimal from "decimal.js";
import type { AssetType } from "./models";
import type { PortfolioValuation } from "./valuation";

export interface AllocationSlice {
  key: string;
  value: Decimal;
  /** Proporción sobre el total (suma 1). */
  share: Decimal;
}

function toSlices(entries: [string, Decimal][]): AllocationSlice[] {
  const total = entries.reduce((sum, [, v]) => sum.plus(v), new Decimal(0));
  if (total.isZero()) return [];
  return entries
    .filter(([, v]) => v.gt(0))
    .sort((a, b) => b[1].comparedTo(a[1]))
    .map(([key, value]) => ({ key, value, share: value.div(total) }));
}

/** Valor de mercado por tipo de activo. */
export function allocationByType(valuation: PortfolioValuation, typeOf: (assetId: string) => AssetType): AllocationSlice[] {
  const byType = new Map<string, Decimal>();
  for (const p of valuation.positions) {
    if (!p.marketValue) continue;
    const type = typeOf(p.position.assetId);
    byType.set(type, (byType.get(type) ?? new Decimal(0)).plus(p.marketValue));
  }
  return toSlices([...byType]);
}

/** Valor de mercado por activo; a partir de `max` se agrupan en "other". */
export function allocationByAsset(valuation: PortfolioValuation, max = 6): AllocationSlice[] {
  const slices = toSlices(valuation.positions.filter((p) => p.marketValue).map((p) => [p.position.assetId, p.marketValue!]));
  if (slices.length <= max) return slices;
  const head = slices.slice(0, max - 1);
  const rest = slices.slice(max - 1);
  return [
    ...head,
    {
      key: "other",
      value: rest.reduce((sum, s) => sum.plus(s.value), new Decimal(0)),
      share: rest.reduce((sum, s) => sum.plus(s.share), new Decimal(0)),
    },
  ];
}
