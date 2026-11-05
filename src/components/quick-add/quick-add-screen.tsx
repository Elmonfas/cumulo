"use client";

import Decimal from "decimal.js";
import { Check, FileUp } from "lucide-react";
import Link from "next/link";
import { useMemo, useState, type FormEvent } from "react";
import { AssetAvatar } from "@/components/asset-avatar";
import { PageHeader } from "@/components/layout/page-header";
import { AssetPicker } from "@/components/transactions/asset-picker";
import { Button, buttonVariants } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { DecimalField } from "@/components/ui/decimal-field";
import { getRepositories } from "@/data/repositories";
import type { Asset } from "@/domain/models";
import { formatCurrency, formatQuantity, todayIso } from "@/lib/format";
import { parseDecimal } from "@/lib/parse";
import { cn } from "@/lib/utils";
import { saveQuickPosition } from "@/services/transactions";

interface Added {
  asset: Asset;
  quantity: Decimal;
  cost: Decimal;
}

type Field = "asset" | "quantity" | "price" | "date";

/** Alta rápida: lo que tienes hoy, activo a activo, sin historial. */
export function QuickAddScreen() {
  const [asset, setAsset] = useState<Asset | null>(null);
  const [quantity, setQuantity] = useState("");
  const [price, setPrice] = useState("");
  const [date, setDate] = useState(todayIso());
  const [showErrors, setShowErrors] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [added, setAdded] = useState<Added[]>([]);

  const parsed = useMemo(() => {
    const errors: Partial<Record<Field, string>> = {};
    const q = parseDecimal(quantity);
    const p = parseDecimal(price);
    if (!asset) errors.asset = "Elige un activo.";
    if (!q || q.lte(0)) errors.quantity = "Mayor que 0.";
    if (!p || p.lte(0)) errors.price = "Mayor que 0.";
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) errors.date = "Elige una fecha.";
    else if (date > todayIso()) errors.date = "No puede ser futura.";
    const ok = Object.keys(errors).length === 0;
    return { errors, quantity: ok ? q! : null, price: ok ? p! : null, cost: ok ? q!.times(p!) : null };
  }, [asset, quantity, price, date]);

  const errors = showErrors ? parsed.errors : {};
  const total = added.reduce((sum, a) => sum.plus(a.cost), new Decimal(0));

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    setShowErrors(true);
    setSubmitError(null);
    if (!asset || !parsed.quantity || !parsed.price || !parsed.cost) return;
    setSaving(true);
    try {
      const result = await saveQuickPosition(getRepositories(), {
        assetId: asset.id,
        quantity: parsed.quantity.toString(),
        averagePrice: parsed.price.toString(),
        date,
      });
      if (!result.ok) {
        setSubmitError(result.message);
        return;
      }
      setAdded((list) => [{ asset, quantity: parsed.quantity!, cost: parsed.cost! }, ...list]);
      // Listo para el siguiente activo; la fecha se mantiene.
      setAsset(null);
      setQuantity("");
      setPrice("");
      setShowErrors(false);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="mx-auto grid w-full max-w-xl grid-cols-[minmax(0,1fr)] gap-4 md:gap-5">
      <PageHeader
        title="Añadir lo que tengo"
        description="Busca cada activo y pon cuántos tienes y su precio medio. Lo verás en tu cartera al momento."
        back={{ href: "/", label: "Inicio" }}
      />

      <Card>
        <form onSubmit={onSubmit} className="grid grid-cols-[minmax(0,1fr)] gap-4" noValidate>
          <AssetPicker value={asset} onChange={setAsset} error={errors.asset} />
          <div className="grid grid-cols-2 gap-3">
            <DecimalField label="Cantidad" value={quantity} onValueChange={setQuantity} error={errors.quantity} placeholder="0" />
            <DecimalField
              label="Precio medio"
              suffix="€"
              value={price}
              onValueChange={setPrice}
              error={errors.price}
              placeholder="0,00"
            />
          </div>
          <p className="-mt-2 text-xs text-pretty text-text-muted">
            Los dos datos aparecen en tu bróker, en el detalle de cada posición. El precio medio ya incluye las comisiones.
          </p>

          <div className="grid gap-1.5">
            <label htmlFor="quick-date" className="text-sm font-medium">
              Fecha de compra
            </label>
            <input
              id="quick-date"
              type="date"
              value={date}
              max={todayIso()}
              onChange={(e) => setDate(e.target.value)}
              className={cn(
                "h-12 w-full rounded-2xl border bg-surface-2 px-4 text-base tabular-nums outline-none focus:border-accent focus:ring-3 focus:ring-accent/20",
                errors.date ? "border-accent" : "border-border",
              )}
            />
            <p className={cn("text-xs", errors.date ? "text-accent" : "text-text-muted")}>
              {errors.date ?? "Si compraste en varias veces, pon la primera o deja hoy."}
            </p>
          </div>

          <div className="flex items-baseline justify-between rounded-2xl bg-surface-2 px-4 py-3">
            <span className="text-sm text-text-muted">Invertido</span>
            <span className="text-lg font-medium tabular-nums">{parsed.cost ? formatCurrency(parsed.cost) : "—"}</span>
          </div>

          {submitError && (
            <p role="alert" className="rounded-2xl border border-accent/40 bg-accent/10 px-4 py-3 text-sm text-pretty">
              {submitError}
            </p>
          )}

          <Button type="submit" size="lg" disabled={saving}>
            {added.length ? "Añadir otro" : "Añadir a la cartera"}
          </Button>
        </form>
      </Card>

      {added.length > 0 && (
        <Card className="grid grid-cols-[minmax(0,1fr)] gap-4" aria-live="polite">
          <div className="flex items-baseline justify-between gap-4">
            <h2 className="font-medium">
              {added.length === 1 ? "1 posición añadida" : `${added.length} posiciones añadidas`}
            </h2>
            <span className="text-sm text-text-muted tabular-nums">{formatCurrency(total)}</span>
          </div>
          <ul className="grid gap-3">
            {added.map((a, i) => (
              <li key={`${a.asset.id}-${i}`} className="flex items-center gap-3">
                <AssetAvatar asset={a.asset} />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">{a.asset.name}</p>
                  <p className="text-xs text-text-muted tabular-nums">{formatQuantity(a.quantity)} uds</p>
                </div>
                <span className="text-sm font-medium tabular-nums">{formatCurrency(a.cost)}</span>
                <Check className="size-4 shrink-0 text-accent" aria-hidden />
              </li>
            ))}
          </ul>
          <Link href="/cartera" className={buttonVariants({ size: "lg" })}>
            Ver mi cartera
          </Link>
        </Card>
      )}

      <p className="flex gap-2 px-1 text-xs text-pretty text-text-muted">
        <FileUp className="mt-px size-4 shrink-0" aria-hidden />
        <span>
          ¿Quieres la Renta y las gráficas desde tu primera compra?{" "}
          <Link href="/operaciones/importar" className="text-accent underline-offset-2 hover:underline">
            Importa el historial de Trade Republic
          </Link>
          .
        </span>
      </p>
    </div>
  );
}
