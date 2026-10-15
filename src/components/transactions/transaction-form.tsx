"use client";

import Decimal from "decimal.js";
import { Trash2 } from "lucide-react";
import { useMemo, useState, type FormEvent } from "react";
import { Button } from "@/components/ui/button";
import { DecimalField } from "@/components/ui/decimal-field";
import { getRepositories, type Repositories } from "@/data/repositories";
import type { Asset, Transaction, TransactionType } from "@/domain/models";
import { buildPortfolio } from "@/domain/portfolio";
import { useLiveQuery } from "@/hooks/use-live-query";
import { formatCurrency, formatNumber, todayIso } from "@/lib/format";
import { isAssetTransaction, MANUAL_TRANSACTION_TYPES, TRANSACTION_TYPE_LABELS } from "@/lib/labels";
import { parseDecimal, toInputString } from "@/lib/parse";
import { cn } from "@/lib/utils";
import { deleteTransaction, saveTransaction, type TransactionDraft } from "@/services/transactions";
import { AssetPicker } from "./asset-picker";

interface TransactionFormProps {
  transaction?: Transaction;
  asset?: Asset | null;
  onDone: () => void;
}

const listTransactions = (repositories: Repositories) => repositories.transactions.list();

type Field = "asset" | "date" | "quantity" | "price" | "amount" | "fee" | "tax";

export function TransactionForm({ transaction, asset: initialAsset = null, onDone }: TransactionFormProps) {
  const editing = Boolean(transaction);
  const initialType = transaction?.type ?? "buy";
  const [type, setType] = useState<TransactionType>(initialType);
  const [asset, setAsset] = useState<Asset | null>(initialAsset);
  const [date, setDate] = useState(transaction?.date.slice(0, 10) ?? todayIso());
  const [quantity, setQuantity] = useState(transaction && isAssetTransaction(initialType) ? toInputString(transaction.quantity) : "");
  const [price, setPrice] = useState(transaction && isAssetTransaction(initialType) ? toInputString(transaction.price) : "");
  const [amount, setAmount] = useState(
    transaction && !isAssetTransaction(initialType) ? toInputString(new Decimal(transaction.quantity).times(transaction.price)) : "",
  );
  const [fee, setFee] = useState(transaction ? toInputString(transaction.fee) : "0");
  const [tax, setTax] = useState(transaction ? toInputString(transaction.tax) : "0");
  const [showErrors, setShowErrors] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const transactions = useLiveQuery(listTransactions);
  const forAsset = isAssetTransaction(type);
  // Tipos que no se pueden crear a mano (dividendos, comisiones importadas) se editan con su tipo.
  const types = MANUAL_TRANSACTION_TYPES.includes(initialType) ? MANUAL_TRANSACTION_TYPES : [initialType];

  const parsed = useMemo(() => {
    const errors: Partial<Record<Field, string>> = {};
    const q = parseDecimal(quantity);
    const p = parseDecimal(price);
    const a = parseDecimal(amount);
    const f = parseDecimal(fee || "0");
    const t = parseDecimal(tax || "0");
    if (forAsset) {
      if (!asset) errors.asset = "Elige un activo.";
      if (!q || q.lte(0)) errors.quantity = "Mayor que 0.";
      if (!p || p.isNegative()) errors.price = "0 o más.";
    } else if (!a || a.lte(0)) {
      errors.amount = "Introduce un importe mayor que 0.";
    }
    if (!f || f.isNegative()) errors.fee = "0 o más.";
    if (!t || t.isNegative()) errors.tax = "0 o más.";
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) errors.date = "Elige una fecha.";
    else if (date > todayIso()) errors.date = "No puede ser futura.";

    let total: Decimal | null = null;
    if (Object.keys(errors).length === 0) {
      const gross = forAsset ? q!.times(p!) : a!;
      const charges = f!.plus(t!);
      total = type === "sell" || type === "deposit" ? gross.minus(charges) : gross.plus(charges);
    }
    const draft: TransactionDraft | null =
      Object.keys(errors).length === 0
        ? {
            type,
            assetId: forAsset ? asset!.id : undefined,
            date,
            quantity: forAsset ? q!.toString() : "1",
            price: forAsset ? p!.toString() : a!.toString(),
            fee: f!.toString(),
            tax: t!.toString(),
          }
        : null;
    return { errors, total, draft };
  }, [quantity, price, amount, fee, tax, forAsset, asset, date, type]);

  const holding = useMemo(() => {
    if (type !== "sell" || !asset || transactions.status !== "ready") return null;
    const others = transactions.data.filter((t) => t.id !== transaction?.id);
    try {
      return buildPortfolio(others).positions.get(asset.id)?.quantity ?? new Decimal(0);
    } catch {
      return null;
    }
  }, [type, asset, transactions, transaction?.id]);

  const errors = showErrors ? parsed.errors : {};

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    setShowErrors(true);
    setSubmitError(null);
    if (!parsed.draft) return;
    setSaving(true);
    try {
      const result = await saveTransaction(getRepositories(), parsed.draft, transaction?.id);
      if (result.ok) onDone();
      else setSubmitError(result.message);
    } finally {
      setSaving(false);
    }
  }

  async function onDelete() {
    if (!transaction) return;
    if (!confirmDelete) {
      setConfirmDelete(true);
      return;
    }
    setSaving(true);
    const result = await deleteTransaction(getRepositories(), transaction.id);
    setSaving(false);
    if (result.ok) onDone();
    else {
      setConfirmDelete(false);
      setSubmitError(result.message);
    }
  }

  const totalLabel = type === "sell" ? "Recibes" : type === "deposit" ? "Entra en cuenta" : type === "withdrawal" ? "Sale de la cuenta" : "Total";

  return (
    <form id="transaction-form" onSubmit={onSubmit} className="grid grid-cols-[minmax(0,1fr)] gap-4 pt-1" noValidate>
      <div
        role="radiogroup"
        aria-label="Tipo de operación"
        className={cn("grid gap-1 rounded-full border border-border bg-surface-2 p-1", types.length > 1 ? "grid-cols-4" : "grid-cols-1")}
      >
        {types.map((t) => (
          <button
            key={t}
            type="button"
            role="radio"
            aria-checked={type === t}
            onClick={() => {
              setType(t);
              setSubmitError(null);
            }}
            className={cn(
              "h-9 rounded-full text-[13px] font-medium transition-colors outline-none focus-visible:ring-3 focus-visible:ring-accent/40",
              type === t ? "bg-surface text-accent shadow-card dark:bg-accent/15" : "text-text-muted hover:text-text",
            )}
          >
            {TRANSACTION_TYPE_LABELS[t]}
          </button>
        ))}
      </div>

      {forAsset && <AssetPicker value={asset} onChange={setAsset} error={errors.asset} />}

      <div className="grid gap-1.5">
        <label htmlFor="transaction-date" className="text-sm font-medium">
          Fecha
        </label>
        <input
          id="transaction-date"
          type="date"
          value={date}
          max={todayIso()}
          onChange={(e) => setDate(e.target.value)}
          className={cn(
            "h-12 w-full rounded-2xl border bg-surface-2 px-4 text-base tabular-nums outline-none focus:border-accent focus:ring-3 focus:ring-accent/20",
            errors.date ? "border-accent" : "border-border",
          )}
        />
        {errors.date && <p className="text-xs text-accent">{errors.date}</p>}
      </div>

      {forAsset ? (
        <div className="grid grid-cols-2 gap-3">
          <DecimalField
            label="Cantidad"
            value={quantity}
            onValueChange={setQuantity}
            error={errors.quantity}
            hint={holding ? `Tienes ${formatNumber(holding, Math.min(8, holding.decimalPlaces()))}` : undefined}
            placeholder="0"
          />
          <DecimalField label="Precio" suffix="€" value={price} onValueChange={setPrice} error={errors.price} placeholder="0,00" />
        </div>
      ) : (
        <DecimalField label="Importe" suffix="€" value={amount} onValueChange={setAmount} error={errors.amount} placeholder="0,00" />
      )}

      <div className="grid grid-cols-2 gap-3">
        <DecimalField label="Comisión" suffix="€" value={fee} onValueChange={setFee} error={errors.fee} />
        <DecimalField label="Impuestos" suffix="€" value={tax} onValueChange={setTax} error={errors.tax} />
      </div>

      <div className="flex items-baseline justify-between rounded-2xl bg-surface-2 px-4 py-3">
        <span className="text-sm text-text-muted">{totalLabel}</span>
        <span className="text-lg font-medium tabular-nums">{parsed.total ? formatCurrency(parsed.total) : "—"}</span>
      </div>

      {submitError && (
        <p role="alert" className="rounded-2xl border border-accent/40 bg-accent/10 px-4 py-3 text-sm text-pretty">
          {submitError}
        </p>
      )}

      <div className="flex flex-col-reverse gap-2 pt-1 sm:flex-row sm:items-center">
        {editing && (
          <Button type="button" variant={confirmDelete ? "secondary" : "ghost"} onClick={onDelete} disabled={saving} className="sm:mr-auto">
            <Trash2 aria-hidden />
            {confirmDelete ? "Pulsa otra vez para borrar" : "Borrar"}
          </Button>
        )}
        <Button type="submit" size="lg" disabled={saving} className="sm:ml-auto sm:min-w-40">
          {editing ? "Guardar cambios" : "Añadir operación"}
        </Button>
      </div>
    </form>
  );
}
