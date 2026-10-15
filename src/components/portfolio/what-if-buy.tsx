"use client";

import Decimal from "decimal.js";
import { ChevronDown, Calculator } from "lucide-react";
import { useMemo, useState } from "react";
import { DecimalField } from "@/components/ui/decimal-field";
import { VariationAmount, VariationBadge } from "@/components/variation-badge";
import { simulateBuy } from "@/domain/what-if";
import { formatCurrency, formatPercent, formatQuantity } from "@/lib/format";
import { parseDecimal, toInputString } from "@/lib/parse";
import { cn } from "@/lib/utils";

interface WhatIfBuyProps {
  quantity: Decimal;
  cost: Decimal;
  averageCost: Decimal;
  marketPrice: Decimal | null;
  /** Valor de mercado del resto de la cartera. */
  otherValue: Decimal;
}

/** "¿Y si compro más?": precio medio, coste y peso tras una compra hipotética. */
export function WhatIfBuy({ quantity, cost, averageCost, marketPrice, otherValue }: WhatIfBuyProps) {
  const [mode, setMode] = useState<"amount" | "quantity">("amount");
  const [value, setValue] = useState("");
  const [price, setPrice] = useState(marketPrice ? toInputString(marketPrice.toDecimalPlaces(4)) : "");
  const [fee, setFee] = useState("1");

  const result = useMemo(() => {
    const v = parseDecimal(value);
    const p = parseDecimal(price);
    const f = parseDecimal(fee || "0");
    if (!v || !p || !f) return null;
    return simulateBuy({
      quantity,
      cost,
      otherValue,
      marketPrice: marketPrice ?? p,
      buy: mode === "amount" ? { amount: v } : { quantity: v },
      price: p,
      fee: f,
    });
  }, [value, price, fee, mode, quantity, cost, otherValue, marketPrice]);

  return (
    <details className="group rounded-2xl border border-border">
      <summary className="flex cursor-pointer list-none items-center gap-3 rounded-2xl px-4 py-3 text-sm font-medium outline-none focus-visible:ring-3 focus-visible:ring-accent/40 [&::-webkit-details-marker]:hidden">
        <Calculator className="size-4 text-accent" aria-hidden />
        <span className="flex-1">¿Y si compro más?</span>
        <ChevronDown className="size-4 text-text-muted transition-transform group-open:rotate-180" aria-hidden />
      </summary>
      <div className="grid grid-cols-[minmax(0,1fr)] gap-3 px-4 pb-4">
        <div role="radiogroup" aria-label="Simular por" className="grid grid-cols-2 gap-1 rounded-full bg-surface-2 p-1">
          {(["amount", "quantity"] as const).map((m) => (
            <button
              key={m}
              type="button"
              role="radio"
              aria-checked={mode === m}
              onClick={() => setMode(m)}
              className={cn(
                "h-8 rounded-full text-xs font-medium transition-colors outline-none focus-visible:ring-3 focus-visible:ring-accent/40",
                mode === m ? "bg-accent text-accent-foreground" : "text-text-muted hover:text-text",
              )}
            >
              {m === "amount" ? "Por importe" : "Por cantidad"}
            </button>
          ))}
        </div>
        <div className="grid grid-cols-3 gap-2">
          <DecimalField
            label={mode === "amount" ? "Gastas" : "Compras"}
            suffix={mode === "amount" ? "€" : "uds"}
            value={value}
            onValueChange={setValue}
            placeholder={mode === "amount" ? "500" : "1"}
          />
          <DecimalField label="Precio" suffix="€" value={price} onValueChange={setPrice} />
          <DecimalField label="Comisión" suffix="€" value={fee} onValueChange={setFee} />
        </div>

        {result ? (
          <dl className="divide-y divide-border rounded-2xl bg-surface-2 px-4 text-sm">
            <Row
              label="Compras"
              value={`${formatQuantity(result.addedQuantity.toDecimalPlaces(6))} uds · ${formatCurrency(result.spent)}`}
            />
            <Row
              label="Precio medio"
              value={
                <span className="inline-flex items-center gap-2">
                  <span className="text-text-muted">{formatCurrency(averageCost)} →</span>
                  {formatCurrency(result.averageCost)}
                  {result.averageChange && <VariationBadge ratio={result.averageChange} />}
                </span>
              }
            />
            <Row label="Coste total" value={formatCurrency(result.cost)} />
            {result.weightAfter && (
              <Row
                label="Peso en la cartera"
                value={`${result.weightBefore ? formatPercent(result.weightBefore, { signed: false }) : "0 %"} → ${formatPercent(result.weightAfter, { signed: false })}`}
              />
            )}
            <Row
              label="No realizado después"
              value={<VariationAmount value={result.unrealizedAfter} format={(v) => formatCurrency(v, { signed: true })} />}
            />
          </dl>
        ) : (
          <p className="text-xs text-text-muted">Escribe cuánto gastarías o cuántas participaciones comprarías.</p>
        )}
      </div>
    </details>
  );
}

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-3 py-2.5">
      <dt className="text-text-muted">{label}</dt>
      <dd className="text-right font-medium tabular-nums">{value}</dd>
    </div>
  );
}
