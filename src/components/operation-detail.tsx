import Decimal from "decimal.js";
import type { ReactNode } from "react";
import { VariationAmount, VariationBadge } from "@/components/variation-badge";
import type { Transaction } from "@/domain/models";
import { buyDetail, sellDetail } from "@/domain/performance";
import type { PortfolioState } from "@/domain/portfolio";
import { formatCurrency, formatNumber, formatPercent, todayIso } from "@/lib/format";
import { cn } from "@/lib/utils";

const qty = (q: Decimal) => formatNumber(q, Math.min(8, q.decimalPlaces()));
const signed = (v: Decimal) => formatCurrency(v, { signed: true });

/** Cifras de una compra o venta concreta, sin adornos. */
export function OperationDetail({
  transaction: t,
  state,
  price,
  className,
}: {
  transaction: Transaction;
  state: PortfolioState;
  price: Decimal | null;
  className?: string;
}) {
  const rows: [string, ReactNode][] = [];

  if (t.type === "buy") {
    const d = buyDetail(state, t, price, todayIso());
    rows.push(["Pagaste", formatCurrency(d.cost)]);
    rows.push(["Precio de compra", formatCurrency(t.price)]);
    rows.push([
      "Cantidad",
      d.soldQuantity.gt(0) ? `${qty(d.remainingQuantity)} de ${qty(d.quantity)} (vendidas ${qty(d.soldQuantity)})` : qty(d.quantity),
    ]);
    if (d.remainingQuantity.isZero()) {
      rows.push(["Vale hoy", "Vendida del todo"]);
    } else {
      rows.push(["Vale hoy", d.currentValue ? formatCurrency(d.currentValue) : "Sin precio"]);
      rows.push([
        "Ganancia",
        d.gain ? (
          <span className="inline-flex items-center gap-2">
            <VariationAmount value={d.gain} format={signed} />
            <VariationBadge ratio={d.gainPct} />
          </span>
        ) : (
          "—"
        ),
      ]);
    }
    rows.push(["Días en cartera", formatNumber(new Decimal(d.daysHeld), 0)]);
    rows.push([
      "Rentabilidad anual",
      d.annualized ? (
        <VariationAmount value={d.annualized} format={(v) => formatPercent(v)} />
      ) : (
        <span className="text-text-muted">{d.remainingQuantity.isZero() ? "—" : "Menos de 1 año"}</span>
      ),
    ]);
  } else if (t.type === "sell") {
    const d = sellDetail(state, t);
    if (d) {
      rows.push(["Cobraste", formatCurrency(d.proceeds)]);
      rows.push(["Precio de venta", formatCurrency(t.price)]);
      rows.push(["Cantidad", qty(new Decimal(t.quantity))]);
      rows.push(["Coste de lo vendido (FIFO)", formatCurrency(d.cost)]);
      rows.push([
        "Ganancia",
        <span key="g" className="inline-flex items-center gap-2">
          <VariationAmount value={d.gain} format={signed} />
          <VariationBadge ratio={d.gainPct} />
        </span>,
      ]);
    }
  }

  if (rows.length === 0) return null;
  return (
    <dl className={cn("divide-y divide-border rounded-2xl bg-surface-2 px-4", className)}>
      {rows.map(([label, value]) => (
        <div key={label} className="flex items-center justify-between gap-4 py-2.5 text-sm">
          <dt className="text-text-muted">{label}</dt>
          <dd className="text-right font-medium tabular-nums">{value}</dd>
        </div>
      ))}
    </dl>
  );
}
