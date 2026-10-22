"use client";

import Decimal from "decimal.js";
import {
  ArrowDownToLine,
  ArrowLeftRight,
  ArrowUpFromLine,
  BadgeEuro,
  Download,
  FileUp,
  Pencil,
  Percent,
  Plus,
  Receipt,
  Search,
  X,
  type LucideIcon,
} from "lucide-react";
import dynamic from "next/dynamic";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { AssetAvatar } from "@/components/asset-avatar";
import { EmptyState } from "@/components/empty-state";
import { PageHeader } from "@/components/layout/page-header";
import { Button, buttonVariants } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Sheet } from "@/components/ui/sheet";
import { getRepositories, type Repositories } from "@/data/repositories";
import type { Asset, Transaction, TransactionType } from "@/domain/models";
import { buildPortfolio, sortTransactions, transactionTotal } from "@/domain/portfolio";
import { useLiveQuery } from "@/hooks/use-live-query";
import { useWideScreen } from "@/hooks/use-media-query";
import { usePortfolio } from "@/hooks/use-portfolio";
import { OperationDetail } from "@/components/operation-detail";
import { ShareButton } from "@/components/share/share-sheet";
import { buildOperationCard } from "@/lib/share-builders";
import { formatCurrency, formatDate, formatMonthYear, formatQuantity, todayIso } from "@/lib/format";
import { CASH_TRANSACTION_TYPES, isAssetTransaction, TRANSACTION_TYPE_LABELS } from "@/lib/labels";
import { downloadText } from "@/lib/image";
import { transactionsCsv } from "@/lib/transactions-csv";
import { cn } from "@/lib/utils";

// El formulario (y su buscador) solo se descarga al abrir la hoja.
const TransactionForm = dynamic(() => import("./transaction-form").then((m) => m.TransactionForm), { ssr: false });

const loadData = async (repositories: Repositories) => {
  const [transactions, assets] = await Promise.all([repositories.transactions.list(), repositories.assets.list()]);
  return { transactions, assets: new Map(assets.map((a) => [a.id, a])) };
};

const CASH_ICONS: Partial<Record<TransactionType, LucideIcon>> = {
  deposit: ArrowDownToLine,
  withdrawal: ArrowUpFromLine,
  dividend: BadgeEuro,
  interest: Percent,
  fee: Receipt,
};

type Filter = "all" | "buy" | "sell" | "dividend" | "interest";
const FILTERS: { key: Filter; label: string }[] = [
  { key: "all", label: "Todas" },
  { key: "buy", label: "Compras" },
  { key: "sell", label: "Ventas" },
  { key: "dividend", label: "Dividendos" },
  { key: "interest", label: "Intereses" },
];

/** Para buscar sin tildes ni mayúsculas: "Telefónica" encuentra "telefonica". */
const normalize = (text: string) =>
  text
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase();

/** Clave nueva en cada apertura para que el formulario empiece limpio. */
let sheetKey = 0;
const nextSheetKey = () => ++sheetKey;

type SheetState =
  | { open: false }
  | { open: true; mode: "new"; key: number }
  | { open: true; mode: "detail" | "edit"; transaction: Transaction; key: number };

export function TransactionsScreen() {
  const data = useLiveQuery(loadData);
  const portfolio = usePortfolio();
  const [sheet, setSheet] = useState<SheetState>({ open: false });
  const wide = useWideScreen();
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<Filter>("all");
  const openNew = () => setSheet({ open: true, mode: "new", key: nextSheetKey() });
  const openTransaction = (t: Transaction) =>
    setSheet({
      open: true,
      mode: isAssetTransaction(t.type) || t.type === "dividend" || t.type === "interest" ? "detail" : "edit",
      transaction: t,
      key: nextSheetKey(),
    });

  const view = useMemo(() => {
    if (data.status !== "ready") return null;
    // Depósitos y retiradas ya no forman parte de la cartera: se ocultan.
    const legacyCash = data.data.transactions.filter((t) => CASH_TRANSACTION_TYPES.includes(t.type));
    const sorted = sortTransactions(data.data.transactions.filter((t) => !CASH_TRANSACTION_TYPES.includes(t.type))).reverse();
    const needle = normalize(query.trim());
    const visible = sorted.filter((t) => {
      if (filter !== "all" && t.type !== filter) return false;
      if (!needle) return true;
      const asset = t.assetId ? data.data.assets.get(t.assetId) : undefined;
      const haystack = [asset?.name, asset?.ticker, asset?.isin, TRANSACTION_TYPE_LABELS[t.type], formatDate(t.date)].filter(Boolean).join(" ");
      return normalize(haystack).includes(needle);
    });
    const groups = new Map<string, Transaction[]>();
    for (const t of visible) {
      const month = t.date.slice(0, 7);
      groups.set(month, [...(groups.get(month) ?? []), t]);
    }
    let totals: { bought: Decimal; proceeds: Decimal } | null = null;
    try {
      const state = buildPortfolio(data.data.transactions);
      totals = { bought: state.bought, proceeds: state.saleProceeds };
    } catch {
      totals = null;
    }
    const present = new Set(sorted.map((t) => t.type));
    return { groups: [...groups], totals, count: sorted.length, visibleCount: visible.length, legacyCash, sorted, present };
  }, [data, query, filter]);

  function exportCsv() {
    if (!view || data.status !== "ready") return;
    downloadText(`cumulo-operaciones-${todayIso()}.csv`, transactionsCsv([...view.sorted].reverse(), data.data.assets), "text/csv;charset=utf-8");
  }

  const editing = sheet.open && sheet.mode !== "new" ? sheet.transaction : undefined;
  const editingAsset = editing?.assetId && data.status === "ready" ? data.data.assets.get(editing.assetId) ?? null : null;

  const panelTitle = !sheet.open || sheet.mode === "new"
            ? "Nueva operación"
            : sheet.mode === "detail"
              ? `${TRANSACTION_TYPE_LABELS[sheet.transaction.type]} del ${formatDate(sheet.transaction.date)}`
              : "Editar operación";
  const panelBody = (
    <>
        {sheet.open && sheet.mode === "detail" && (
          <div className="grid grid-cols-[minmax(0,1fr)] gap-4 pt-1">
            {editingAsset && (
              <div className="flex items-center gap-3">
                <AssetAvatar asset={editingAsset} />
                <p className="min-w-0 truncate font-medium">{editingAsset.name}</p>
              </div>
            )}
            {portfolio.status === "ready" ? (
              <OperationDetail
                transaction={sheet.transaction}
                state={portfolio.data.state}
                price={
                  sheet.transaction.assetId
                    ? (portfolio.data.valuation.positions.find((p) => p.position.assetId === sheet.transaction.assetId)?.price ?? null)
                    : null
                }
              />
            ) : (
              <div className="h-40 animate-pulse rounded-2xl bg-surface-2" aria-hidden />
            )}
            {portfolio.status === "ready" && isAssetTransaction(sheet.transaction.type) && (
              <ShareButton
                title="Compartir operación"
                fileName={`cumulo-${sheet.transaction.type === "buy" ? "compra" : "venta"}-${sheet.transaction.date.slice(0, 10)}`}
                build={(o) => buildOperationCard(portfolio.data, sheet.transaction, o)}
                label="Compartir operación"
                className="h-12 text-sm"
              />
            )}
            <Button variant="secondary" size="lg" onClick={() => setSheet({ ...sheet, mode: "edit", key: nextSheetKey() })}>
              <Pencil aria-hidden />
              Editar o borrar
            </Button>
          </div>
        )}
        {sheet.open && sheet.mode !== "detail" && (
          <TransactionForm
            key={sheet.key}
            transaction={editing}
            asset={editingAsset}
            onDone={() => setSheet({ open: false })}
          />
        )}
    </>
  );

  // Atajos de escritorio: N abre una operación nueva y Esc cierra el panel.
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.metaKey || event.ctrlKey || event.altKey) return;
      const target = event.target as HTMLElement | null;
      if (target?.closest("input, textarea, select, [contenteditable], [role=dialog]")) return;
      if (event.key === "n" || event.key === "N") {
        event.preventDefault();
        openNew();
      } else if (event.key === "Escape" && wide) setSheet({ open: false });
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  return (
    <>
      <PageHeader
        title="Operaciones"
        description="Compras, ventas y dividendos."
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
          description="Importa la exportación de transacciones de Trade Republic o añade tus compras y ventas a mano."
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
          {view.legacyCash.length > 0 && (
            <Card className="flex flex-col gap-3 sm:flex-row sm:items-center">
              <p className="flex-1 text-sm text-pretty text-text-muted">
                Tienes {view.legacyCash.length} {view.legacyCash.length === 1 ? "depósito o retirada antiguo" : "depósitos o retiradas antiguos"}. La
                cartera ya no lleva efectivo, así que no cuentan para nada.
              </p>
              <Button
                variant="secondary"
                size="sm"
                onClick={async () => {
                  const repositories = getRepositories();
                  for (const t of view.legacyCash) await repositories.transactions.remove(t.id);
                }}
              >
                Borrarlos
              </Button>
            </Card>
          )}
          {/* Escritorio: totales, buscador y filtros en una franja. */}
          <div className="grid grid-cols-[minmax(0,1fr)] gap-4 md:gap-5 xl:grid-cols-[minmax(0,2fr)_minmax(0,3fr)] xl:items-center">
          <div className="grid grid-cols-2 gap-3">
            <Card className="p-4 md:p-5">
              <p className="text-xs text-text-muted">Total comprado</p>
              <p className="mt-1 text-lg font-medium tabular-nums">{view.totals ? formatCurrency(view.totals.bought) : "—"}</p>
            </Card>
            <Card className="p-4 md:p-5">
              <p className="text-xs text-text-muted">Cobrado en ventas</p>
              <p className="mt-1 text-lg font-medium tabular-nums">{view.totals ? formatCurrency(view.totals.proceeds) : "—"}</p>
            </Card>
          </div>

          <div className="grid gap-3">
            <div className="flex items-center gap-2">
              <label className="relative min-w-0 flex-1">
                <span className="sr-only">Buscar operaciones</span>
                <Search className="pointer-events-none absolute top-1/2 left-4 size-4 -translate-y-1/2 text-text-muted" aria-hidden />
                <input
                  type="search"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Buscar por activo, ticker o ISIN"
                  className="h-11 w-full rounded-full border border-border bg-surface pr-10 pl-10 text-base outline-none placeholder:text-text-muted focus:border-accent focus:ring-3 focus:ring-accent/20 md:text-sm [&::-webkit-search-cancel-button]:hidden"
                />
                {query && (
                  <button
                    type="button"
                    onClick={() => setQuery("")}
                    aria-label="Borrar búsqueda"
                    className="absolute top-1/2 right-2 flex size-7 -translate-y-1/2 items-center justify-center rounded-full text-text-muted outline-none hover:bg-surface-2 hover:text-text focus-visible:ring-3 focus-visible:ring-accent/40"
                  >
                    <X className="size-4" aria-hidden />
                  </button>
                )}
              </label>
              <Button variant="outline" size="icon" onClick={exportCsv} aria-label="Exportar operaciones a CSV" title="Exportar CSV">
                <Download aria-hidden />
              </Button>
            </div>
            <div role="radiogroup" aria-label="Tipo de operación" className="flex gap-1.5 overflow-x-auto pb-0.5 [scrollbar-width:none]">
              {FILTERS.filter((f) => f.key === "all" || f.key === "buy" || f.key === "sell" || view.present.has(f.key)).map((f) => (
                <button
                  key={f.key}
                  type="button"
                  role="radio"
                  aria-checked={filter === f.key}
                  onClick={() => setFilter(f.key)}
                  className={cn(
                    "h-8 shrink-0 rounded-full border px-3.5 text-xs font-medium transition-colors outline-none focus-visible:ring-3 focus-visible:ring-accent/40",
                    filter === f.key
                      ? "border-accent bg-accent text-accent-foreground"
                      : "border-border bg-surface text-text-muted hover:text-text",
                  )}
                >
                  {f.label}
                </button>
              ))}
            </div>
          </div>
          </div>

          {view.visibleCount === 0 && (
            <Card className="py-10 text-center text-sm text-text-muted">
              Ninguna operación coincide con la búsqueda.
              <button
                type="button"
                onClick={() => {
                  setQuery("");
                  setFilter("all");
                }}
                className="mt-2 block w-full font-medium text-accent outline-none hover:underline focus-visible:underline"
              >
                Ver todas
              </button>
            </Card>
          )}

          {/* Escritorio: tabla a la izquierda y el detalle o el formulario a la derecha. */}
          <div className="grid grid-cols-[minmax(0,1fr)] gap-4 md:gap-5 xl:grid-cols-[minmax(0,3fr)_minmax(0,2fr)] xl:items-start">
          <div className="grid grid-cols-[minmax(0,1fr)] gap-4 md:gap-5">
          {wide && view.visibleCount > 0 && (
            <TransactionsTable
              groups={view.groups}
              assets={data.data.assets}
              selectedId={sheet.open && sheet.mode !== "new" ? sheet.transaction.id : null}
              onSelect={openTransaction}
            />
          )}
          {!wide && view.groups.map(([month, items]) => (
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
                        onSelect={() => openTransaction(t)}
                      />
                    </li>
                  ))}
                </ul>
              </Card>
            </section>
          ))}
          </div>

          {wide && (
            <Card aria-label={sheet.open ? panelTitle : "Detalle"} className="sticky top-8 max-h-[calc(100dvh-4rem)] overflow-y-auto">
              {sheet.open ? (
                <>
                  <div className="mb-3 flex items-center justify-between gap-3">
                    <h2 className="truncate font-medium">{panelTitle}</h2>
                    <Button variant="ghost" size="icon-sm" aria-label="Cerrar" onClick={() => setSheet({ open: false })}>
                      <X aria-hidden />
                    </Button>
                  </div>
                  {panelBody}
                </>
              ) : (
                <div className="flex flex-col items-center gap-3 py-10 text-center">
                  <p className="text-sm text-pretty text-text-muted">Elige una operación para ver su detalle, o añade una nueva.</p>
                  <Button onClick={openNew}>
                    <Plus aria-hidden />
                    Nueva operación
                  </Button>
                  <p className="text-xs text-text-muted">
                    Atajo: <kbd className="rounded border border-border px-1.5 py-0.5 font-mono text-[11px]">N</kbd>
                  </p>
                </div>
              )}
            </Card>
          )}
          </div>
        </div>
      )}

      <Sheet
        open={!wide && sheet.open}
        onOpenChange={(open) => !open && setSheet({ open: false })}
        title={panelTitle}
      >
        {panelBody}
      </Sheet>
    </>
  );
}

function TransactionRow({ transaction: t, asset, onSelect }: { transaction: Transaction; asset?: Asset; onSelect: () => void }) {
  const total = transactionTotal(t);
  const Icon = CASH_ICONS[t.type];
  const title = asset?.name ?? TRANSACTION_TYPE_LABELS[t.type];
  const detail = isAssetTransaction(t.type)
    ? `${formatQuantity(t.quantity)} × ${formatCurrency(t.price)}`
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
        {t.type === "sell" || t.type === "dividend" || t.type === "interest" ? `+${formatCurrency(total)}` : formatCurrency(total)}
      </span>
    </button>
  );
}

/** Operaciones en tabla, agrupadas por mes con su título fijo arriba (solo escritorio ancho). */
function TransactionsTable({
  groups,
  assets,
  selectedId,
  onSelect,
}: {
  groups: [string, Transaction[]][];
  assets: Map<string, Asset>;
  selectedId: string | null;
  onSelect: (t: Transaction) => void;
}) {
  const cell = "px-2.5 py-2.5 text-right whitespace-nowrap";
  return (
    <Card className="p-0 md:p-0">
      <table className="w-full text-sm tabular-nums">
        <caption className="sr-only">Operaciones por mes</caption>
        <thead>
          <tr className="text-xs text-text-muted">
            <th scope="col" className="py-2.5 pr-2.5 pl-4 text-left font-medium">Fecha</th>
            <th scope="col" className="px-2.5 py-2.5 text-left font-medium">Activo</th>
            <th scope="col" className="px-2.5 py-2.5 text-right font-medium">Cantidad</th>
            <th scope="col" className="hidden px-2.5 py-2.5 text-right font-medium 2xl:table-cell">Precio</th>
            <th scope="col" className="hidden px-2.5 py-2.5 text-right font-medium 2xl:table-cell">Comisión</th>
            <th scope="col" className="py-2.5 pr-4 pl-2.5 text-right font-medium">Importe</th>
          </tr>
        </thead>
        {groups.map(([month, items]) => (
          <tbody key={month}>
            <tr>
              <th
                colSpan={6}
                scope="colgroup"
                className="sticky top-0 z-10 border-y border-border bg-surface-2 px-4 py-1.5 text-left text-xs font-medium text-text-muted first-letter:uppercase"
              >
                {formatMonthYear(month)} · {items.length}
              </th>
            </tr>
            {items.map((t) => {
              const asset = t.assetId ? assets.get(t.assetId) : undefined;
              const total = transactionTotal(t);
              const income = t.type === "sell" || t.type === "dividend" || t.type === "interest";
              const fee = new Decimal(t.fee);
              const Icon = CASH_ICONS[t.type];
              const selected = t.id === selectedId;
              return (
                <tr
                  key={t.id}
                  tabIndex={0}
                  aria-selected={selected}
                  onClick={() => onSelect(t)}
                  onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && (e.preventDefault(), onSelect(t))}
                  className={cn(
                    "cursor-pointer border-b border-border transition-colors outline-none last:border-0 focus-visible:bg-surface-2",
                    selected ? "bg-accent/10" : "hover:bg-surface-2",
                  )}
                >
                  <td className="py-2.5 pr-2.5 pl-4 whitespace-nowrap text-text-muted">{formatDate(t.date).replace(/ \d{4}$/, "")}</td>
                  <td className="px-2.5 py-2">
                    <span className="flex min-w-0 items-center gap-2.5">
                      {asset ? (
                        <AssetAvatar asset={asset} className="size-8" />
                      ) : (
                        <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-surface-2 text-text-muted" aria-hidden>
                          {Icon && <Icon className="size-4" />}
                        </span>
                      )}
                      <span className="min-w-0">
                        <span className={cn("block max-w-40 truncate font-medium 2xl:max-w-72", selected && "text-accent")}>
                          {asset?.name ?? TRANSACTION_TYPE_LABELS[t.type]}
                        </span>
                        <span className="block text-xs text-text-muted">{TRANSACTION_TYPE_LABELS[t.type]}</span>
                      </span>
                    </span>
                  </td>
                  <td className={cell}>
                    {isAssetTransaction(t.type) ? formatQuantity(t.quantity) : "—"}
                    {isAssetTransaction(t.type) && (
                      <span className="block text-xs text-text-muted 2xl:hidden">a {formatCurrency(t.price)}</span>
                    )}
                  </td>
                  <td className={cn(cell, "hidden 2xl:table-cell")}>{isAssetTransaction(t.type) ? formatCurrency(t.price) : "—"}</td>
                  <td className={cn(cell, "hidden 2xl:table-cell")}>{fee.isZero() ? "—" : formatCurrency(fee)}</td>
                  <td className={cn(cell, "pr-4 font-medium")}>
                    {income ? `+${formatCurrency(total)}` : formatCurrency(total)}
                  </td>
                </tr>
              );
            })}
          </tbody>
        ))}
      </table>
    </Card>
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
