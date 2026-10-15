"use client";

import Decimal from "decimal.js";
import { ArrowDownToLine, ArrowLeftRight, ArrowUpFromLine, BadgeEuro, FileUp, Plus, Receipt, type LucideIcon } from "lucide-react";
import Link from "next/link";
import { useMemo, useState } from "react";
import { AssetAvatar } from "@/components/asset-avatar";
import { EmptyState } from "@/components/empty-state";
import { PageHeader } from "@/components/layout/page-header";
import { Button, buttonVariants } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Sheet } from "@/components/ui/sheet";
import type { Repositories } from "@/data/repositories";
import type { Asset, Transaction, TransactionType } from "@/domain/models";
import { buildPortfolio, cashEffect, sortTransactions } from "@/domain/portfolio";
import { useLiveQuery } from "@/hooks/use-live-query";
import { formatCurrency, formatDate, formatMonthYear, formatNumber } from "@/lib/format";
import { isAssetTransaction, TRANSACTION_TYPE_LABELS } from "@/lib/labels";
import { TransactionForm } from "./transaction-form";

const loadData = async (repositories: Repositories) => {
  const [transactions, assets] = await Promise.all([repositories.transactions.list(), repositories.assets.list()]);
  return { transactions, assets: new Map(assets.map((a) => [a.id, a])) };
};

const CASH_ICONS: Partial<Record<TransactionType, LucideIcon>> = {
  deposit: ArrowDownToLine,
  withdrawal: ArrowUpFromLine,
  dividend: BadgeEuro,
  fee: Receipt,
};

type SheetState = { open: false } | { open: true; transaction?: Transaction; key: number };

export function TransactionsScreen() {
  const data = useLiveQuery(loadData);
  const [sheet, setSheet] = useState<SheetState>({ open: false });
  const openNew = () => setSheet({ open: true, key: Date.now() });

  const view = useMemo(() => {
    if (data.status !== "ready") return null;
    const sorted = sortTransactions(data.data.transactions).reverse();
    const groups = new Map<string, Transaction[]>();
    for (const t of sorted) {
      const month = t.date.slice(0, 7);
      groups.set(month, [...(groups.get(month) ?? []), t]);
    }
    let cash: Decimal | null = null;
    try {
      cash = buildPortfolio(data.data.transactions).cash;
    } catch {
      cash = null;
    }
    return { groups: [...groups], cash, count: sorted.length };
  }, [data]);

  const editing = sheet.open ? sheet.transaction : undefined;
  const editingAsset = editing?.assetId && data.status === "ready" ? data.data.assets.get(editing.assetId) ?? null : null;

  return (
    <>
      <PageHeader
        title="Operaciones"
        description="Compras, ventas, depósitos y retiradas."
        actions={
          view && view.count > 0 ? (
            <>
              <Link href="/operaciones/importar" aria-label="Importar CSV" className={buttonVariants({ variant: "outline", size: "icon" })}>
                <FileUp aria-hidden />
              </Link>
              <Button onClick={openNew} className="max-sm:size-10 max-sm:px-0" aria-label="Añadir operación">
                <Plus aria-hidden />
                <span className="max-sm:sr-only">Añadir</span>
              </Button>
            </>
          ) : undefined
        }
      />

      {data.status === "loading" && <ListSkeleton />}
      {data.status === "error" && (
        <Card className="text-sm text-text-muted">No se pudieron leer los datos de este navegador: {data.error.message}</Card>
      )}

      {view && view.count === 0 && (
        <EmptyState
          icon={ArrowLeftRight}
          title="Sin operaciones todavía"
          description="Importa la exportación de transacciones de Trade Republic o añade operaciones a mano."
          actions={
            <>
              <Button size="lg" onClick={openNew}>
                <Plus aria-hidden />
                Añadir operación
              </Button>
              <Link href="/operaciones/importar" className={buttonVariants({ size: "lg", variant: "outline" })}>
                <FileUp aria-hidden />
                Importar CSV
              </Link>
            </>
          }
        />
      )}

      {view && view.count > 0 && data.status === "ready" && (
        <div className="grid grid-cols-[minmax(0,1fr)] gap-4 md:gap-5">
          <div className="grid grid-cols-2 gap-3">
            <Card className="p-4 md:p-5">
              <p className="text-xs text-text-muted">Efectivo</p>
              <p className="mt-1 text-lg font-medium tabular-nums">{view.cash ? formatCurrency(view.cash) : "—"}</p>
            </Card>
            <Card className="p-4 md:p-5">
              <p className="text-xs text-text-muted">Operaciones</p>
              <p className="mt-1 text-lg font-medium tabular-nums">{formatNumber(new Decimal(view.count), 0)}</p>
            </Card>
          </div>

          {view.groups.map(([month, items]) => (
            <section key={month} aria-labelledby={`month-${month}`}>
              <h2 id={`month-${month}`} className="mb-2 px-1 text-sm font-medium text-text-muted first-letter:uppercase">
                {formatMonthYear(month)}
              </h2>
              <Card className="p-1.5 md:p-2">
                <ul>
                  {items.map((t) => (
                    <li key={t.id}>
                      <TransactionRow
                        transaction={t}
                        asset={t.assetId ? data.data.assets.get(t.assetId) : undefined}
                        onSelect={() => setSheet({ open: true, transaction: t, key: Date.now() })}
                      />
                    </li>
                  ))}
                </ul>
              </Card>
            </section>
          ))}
        </div>
      )}

      <Sheet
        open={sheet.open}
        onOpenChange={(open) => !open && setSheet({ open: false })}
        title={editing ? "Editar operación" : "Nueva operación"}
      >
        {sheet.open && (
          <TransactionForm
            key={sheet.key}
            transaction={editing}
            asset={editingAsset}
            onDone={() => setSheet({ open: false })}
          />
        )}
      </Sheet>
    </>
  );
}

function TransactionRow({ transaction: t, asset, onSelect }: { transaction: Transaction; asset?: Asset; onSelect: () => void }) {
  const effect = cashEffect(t);
  const Icon = CASH_ICONS[t.type];
  const title = asset?.name ?? TRANSACTION_TYPE_LABELS[t.type];
  const detail = isAssetTransaction(t.type)
    ? `${formatNumber(new Decimal(t.quantity), Math.min(8, new Decimal(t.quantity).decimalPlaces()))} × ${formatCurrency(t.price)}`
    : undefined;

  return (
    <button
      type="button"
      onClick={onSelect}
      className="flex w-full items-center gap-3 rounded-2xl px-2.5 py-2.5 text-left transition-colors outline-none hover:bg-surface-2 focus-visible:bg-surface-2 focus-visible:ring-3 focus-visible:ring-accent/40"
    >
      {asset ? (
        <AssetAvatar asset={asset} />
      ) : (
        <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-surface-2 text-text-muted" aria-hidden>
          {Icon && <Icon className="size-4.5" />}
        </span>
      )}
      <span className="min-w-0 flex-1">
        <span className="block truncate text-sm font-medium">{title}</span>
        <span className="block truncate text-xs text-text-muted tabular-nums">
          {[TRANSACTION_TYPE_LABELS[t.type], formatDate(t.date), detail].filter(Boolean).join(" · ")}
        </span>
      </span>
      <span className="shrink-0 text-sm font-medium tabular-nums">
        {formatCurrency(effect, { signed: true })}
      </span>
    </button>
  );
}

function ListSkeleton() {
  return (
    <div className="grid gap-3" aria-hidden>
      {[0, 1, 2].map((i) => (
        <div key={i} className="h-16 animate-pulse rounded-card bg-surface" />
      ))}
    </div>
  );
}
