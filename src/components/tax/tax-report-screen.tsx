"use client";

import Decimal from "decimal.js";
import { ChevronDown, Download, Info, Landmark, TriangleAlert } from "lucide-react";
import Link from "next/link";
import { Fragment, useMemo, useState, type ReactNode } from "react";
import { AssetAvatar } from "@/components/asset-avatar";
import { EmptyState } from "@/components/empty-state";
import { PageHeader } from "@/components/layout/page-header";
import { Button, buttonVariants } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { VariationAmount } from "@/components/variation-badge";
import { taxReport, taxYears, type TaxIncome, type TaxReport, type TaxSale } from "@/domain/tax";
import { useWideScreen } from "@/hooks/use-media-query";
import { usePortfolio, type PortfolioData } from "@/hooks/use-portfolio";
import { toCsv } from "@/lib/csv-export";
import { formatCurrency, formatDate, formatQuantity } from "@/lib/format";
import { downloadText } from "@/lib/image";
import { cn } from "@/lib/utils";

const signed = (v: Decimal) => formatCurrency(v, { signed: true });

export function TaxReportScreen() {
  const portfolio = usePortfolio();
  return (
    <>
      <PageHeader
        title="Informe para la Renta"
        description="Ganancias, pérdidas y dividendos de cada año."
        back={{ href: "/herramientas", label: "Herramientas" }}
      />
      {portfolio.status === "loading" && <div className="h-80 animate-pulse rounded-card bg-surface" aria-hidden />}
      {portfolio.status === "error" && <Card className="text-sm text-text-muted">{portfolio.error.message}</Card>}
      {portfolio.status === "ready" &&
        (taxYears(portfolio.data.transactions).length > 0 ? (
          <TaxContent data={portfolio.data} />
        ) : (
          <EmptyState
            icon={Landmark}
            title="Nada que declarar todavía"
            description="Cuando vendas o cobres dividendos verás aquí, año a año, las ganancias y pérdidas patrimoniales y los rendimientos para la declaración."
            actions={
              <Link href="/operaciones" className={buttonVariants({ size: "lg" })}>
                Ir a operaciones
              </Link>
            }
          />
        ))}
    </>
  );
}

function TaxContent({ data }: { data: PortfolioData }) {
  const years = useMemo(() => taxYears(data.transactions), [data.transactions]);
  const [year, setYear] = useState(years[0]);
  const wide = useWideScreen();
  const report = useMemo(
    () => taxReport(data.transactions, year, (id) => data.assets.get(id)),
    [data.transactions, data.assets, year],
  );
  const nameOf = (id?: string) => (id ? (data.assets.get(id)?.name ?? "Activo") : "Sin activo");

  function exportCsv() {
    const rows = [
      ...report.sales.map((s) => [
        "Venta",
        s.date,
        nameOf(s.assetId),
        data.assets.get(s.assetId)?.isin,
        s.lots.map((l) => l.date.slice(0, 10)).join(" / "),
        s.quantity,
        s.proceeds.toDecimalPlaces(2),
        s.cost.toDecimalPlaces(2),
        s.gain.toDecimalPlaces(2),
        s.deferredLoss.isZero() ? undefined : s.deferredLoss.toDecimalPlaces(2),
        undefined,
        undefined,
      ]),
      ...report.dividends.map((d) => [
        d.kind === "interest" ? "Interés" : "Dividendo",
        d.date,
        nameOf(d.assetId),
        d.assetId ? data.assets.get(d.assetId)?.isin : undefined,
        undefined,
        undefined,
        d.gross.toDecimalPlaces(2),
        undefined,
        undefined,
        undefined,
        d.withholding.toDecimalPlaces(2),
        d.country,
      ]),
    ];
    const csv = toCsv(
      [
        "Concepto",
        "Fecha",
        "Activo",
        "ISIN",
        "Fechas de adquisición (FIFO)",
        "Cantidad",
        "Valor de transmisión / íntegro (€)",
        "Valor de adquisición (€)",
        "Ganancia o pérdida (€)",
        "Pérdida diferida 2 meses (€)",
        "Retención (€)",
        "País de la retención",
      ],
      rows,
    );
    downloadText(`cumulo-renta-${year}.csv`, csv, "text/csv;charset=utf-8");
  }

  return (
    <div className="grid grid-cols-[minmax(0,1fr)] gap-4 md:gap-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div role="radiogroup" aria-label="Ejercicio" className="flex flex-wrap gap-1.5">
          {years.map((y) => (
            <button
              key={y}
              type="button"
              role="radio"
              aria-checked={year === y}
              onClick={() => setYear(y)}
              className={cn(
                "h-9 rounded-full border px-4 text-sm font-medium tabular-nums transition-colors outline-none focus-visible:ring-3 focus-visible:ring-accent/40",
                year === y ? "border-accent bg-accent text-accent-foreground" : "border-border text-text-muted hover:text-text",
              )}
            >
              {y}
            </button>
          ))}
        </div>
        <Button variant="outline" size="sm" onClick={exportCsv}>
          <Download aria-hidden />
          Exportar CSV
        </Button>
      </div>

      <Summary report={report} />

      {report.sales.length > 0 && (
        <section aria-labelledby="tax-sales">
          <h2 id="tax-sales" className="mb-2 px-1 text-sm font-medium text-text-muted">
            Transmisiones · {report.sales.length}
          </h2>
          {wide && <SalesTable sales={report.sales} data={data} />}
          <ul className="grid grid-cols-[minmax(0,1fr)] gap-2 xl:hidden">
            {report.sales.map((sale) => (
              <li key={sale.transactionId}>
                <SaleRow sale={sale} data={data} />
              </li>
            ))}
          </ul>
        </section>
      )}

      {report.dividends.length > 0 && (
        <section aria-labelledby="tax-dividends">
          <h2 id="tax-dividends" className="mb-2 px-1 text-sm font-medium text-text-muted">
            Dividendos e intereses · {report.dividends.length}
          </h2>
          {wide && <IncomeTable incomes={report.dividends} data={data} />}
          <Card className="p-1.5 md:p-2 xl:hidden">
            <ul>
              {report.dividends.map((d) => {
                const asset = d.assetId ? data.assets.get(d.assetId) : undefined;
                return (
                  <li key={d.transactionId} className="flex items-center gap-3 rounded-2xl px-2.5 py-2.5">
                    {asset && <AssetAvatar asset={asset} />}
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-medium">
                        {asset?.name ?? (d.kind === "interest" ? "Intereses de la cuenta" : "Dividendo")}
                      </span>
                      <span className="block truncate text-xs text-text-muted tabular-nums">
                        {d.kind === "interest" ? "Interés" : "Dividendo"} · {formatDate(d.date)} · retención{" "}
                        {formatCurrency(d.withholding)} ({d.country === "ES" ? "España" : d.country})
                      </span>
                    </span>
                    <span className="shrink-0 text-right text-sm font-medium tabular-nums">
                      {formatCurrency(d.gross)}
                      <span className="block text-xs font-normal text-text-muted">bruto</span>
                    </span>
                  </li>
                );
              })}
            </ul>
          </Card>
        </section>
      )}

      <Card className="flex gap-3 text-sm text-pretty text-text-muted">
        <Info className="mt-0.5 size-5 shrink-0 text-accent" aria-hidden />
        <div className="grid gap-2">
          <p>
            Estimación orientativa con FIFO, la regla de los dos meses para acciones y ETF, la compensación del 25 % entre
            ganancias y rendimientos (dividendos e intereses), la escala del ahorro (19–30 %) y la deducción por doble
            imposición internacional con el límite del convenio (15 % por defecto). No es asesoramiento fiscal.
          </p>
          <p>
            El país de la retención se deduce del ISIN; los intereses de la cuenta se toman como retención española. No
            incluye pérdidas pendientes de años anteriores ni rentas de otras entidades. Contrasta siempre con los datos
            fiscales de tu bróker y de la Agencia Tributaria.
          </p>
        </div>
      </Card>
    </div>
  );
}

function Summary({ report: r }: { report: TaxReport }) {
  const toPay = r.estimatedResult.gt(0);
  return (
    <Card>
      <p className="text-sm text-text-muted">Saldo de ganancias y pérdidas · {r.year}</p>
      <p className="mt-1 text-4xl font-medium tracking-[-0.02em] tabular-nums md:text-5xl">
        <VariationAmount value={r.netGains} format={signed} />
      </p>
      <dl className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-3 xl:grid-cols-4">
        <Tile label="Ganancias" value={<VariationAmount value={r.gains} format={signed} />} />
        <Tile label="Pérdidas" value={<VariationAmount value={r.losses} format={signed} />} />
        <Tile label="Dividendos (íntegro)" value={formatCurrency(r.dividendsGross)} />
        <Tile label="Intereses (íntegro)" value={formatCurrency(r.interestGross)} />
        <Tile label="Base del ahorro" value={formatCurrency(r.savingsBase)} />
        <Tile label="Cuota estimada" value={formatCurrency(r.estimatedTax)} />
        <Tile label="Retención España" value={formatCurrency(r.spanishWithholding)} />
        <Tile label="Doble imposición" value={formatCurrency(r.doubleTaxDeduction)} />
      </dl>
      <div className="mt-3 flex flex-wrap items-baseline justify-between gap-2 rounded-2xl border border-accent/30 bg-accent/10 px-4 py-3">
        <span className="text-sm">{toPay ? "Por esta parte, a pagar aprox." : "Por esta parte, a devolver aprox."}</span>
        <span className="text-lg font-medium tabular-nums">{formatCurrency(r.estimatedResult.abs())}</span>
      </div>
      {r.unrecoverableWithholding.gt(0) && (
        <p className="mt-3 flex gap-2 text-xs text-pretty text-text-muted">
          <TriangleAlert className="size-4 shrink-0 text-accent" aria-hidden />
          {formatCurrency(r.unrecoverableWithholding)} de retención extranjera no se recuperan en la declaración (lo que pase
          del convenio se puede reclamar al país de origen).
        </p>
      )}
      {(!r.deferredLosses.isZero() || r.lossCarryForward.gt(0)) && (
        <ul className="mt-3 grid gap-1.5 text-xs text-text-muted">
          {!r.deferredLosses.isZero() && (
            <li className="flex gap-2">
              <TriangleAlert className="size-4 shrink-0 text-accent" aria-hidden />
              {formatCurrency(r.deferredLosses.abs())} de pérdidas no se computan este año por la regla de los dos meses: se
              integrarán cuando vendas los valores recomprados.
            </li>
          )}
          {r.lossCarryForward.gt(0) && (
            <li className="flex gap-2">
              <Info className="size-4 shrink-0 text-accent" aria-hidden />
              {formatCurrency(r.lossCarryForward)} de saldo negativo se pueden compensar en los cuatro años siguientes.
            </li>
          )}
        </ul>
      )}
    </Card>
  );
}

function Tile({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="min-w-0 rounded-2xl bg-surface-2 px-3.5 py-2.5">
      <dt className="truncate text-xs text-text-muted">{label}</dt>
      <dd className="mt-0.5 truncate font-medium tabular-nums">{value}</dd>
    </div>
  );
}

function SaleRow({ sale, data }: { sale: TaxSale; data: PortfolioData }) {
  const asset = data.assets.get(sale.assetId);
  return (
    <details className="group min-w-0 rounded-card border border-border bg-surface">
      <summary className="flex cursor-pointer list-none items-center gap-3 rounded-card px-4 py-3.5 outline-none focus-visible:ring-3 focus-visible:ring-accent/40 [&::-webkit-details-marker]:hidden">
        {asset && <AssetAvatar asset={asset} />}
        <span className="min-w-0 flex-1">
          <span className="block truncate text-sm font-medium">{asset?.name ?? "Activo"}</span>
          <span className="block truncate text-xs text-text-muted tabular-nums">
            {formatDate(sale.date)} · {formatQuantity(sale.quantity)} uds
          </span>
        </span>
        <span className="shrink-0 text-right text-sm font-medium">
          <VariationAmount value={sale.gain} format={signed} />
          {!sale.deferredLoss.isZero() && <span className="block text-[11px] font-normal text-accent">regla 2 meses</span>}
        </span>
        <ChevronDown className="size-4 shrink-0 text-text-muted transition-transform group-open:rotate-180" aria-hidden />
      </summary>
      <div className="grid gap-3 px-4 pb-4">
        <dl className="divide-y divide-border rounded-2xl bg-surface-2 px-4 text-sm">
          <Row label="Valor de transmisión" value={formatCurrency(sale.proceeds)} />
          <Row label="Valor de adquisición" value={formatCurrency(sale.cost)} />
          <Row label="Resultado" value={<VariationAmount value={sale.gain} format={signed} />} />
          {!sale.deferredLoss.isZero() && <Row label="No computable (2 meses)" value={formatCurrency(sale.deferredLoss.abs())} />}
        </dl>
        <div>
          <p className="mb-1.5 text-xs text-text-muted">Lotes vendidos (FIFO)</p>
          <ul className="grid gap-1 text-xs tabular-nums">
            {sale.lots.map((lot, i) => (
              <li key={`${lot.transactionId}-${i}`} className="flex justify-between gap-3">
                <span>
                  {formatDate(lot.date.slice(0, 10))} · {formatQuantity(lot.quantity)} uds
                </span>
                <span className="text-text-muted">{formatCurrency(lot.cost)}</span>
              </li>
            ))}
          </ul>
        </div>
        {sale.repurchases.length > 0 && (
          <p className="text-xs text-pretty text-text-muted">
            Recompraste {sale.repurchases.map((r) => `${formatQuantity(r.quantity)} el ${formatDate(r.date)}`).join(", ")}: dentro
            de los dos meses anteriores o posteriores a la venta.
          </p>
        )}
      </div>
    </details>
  );
}

const th = "px-2.5 py-2.5 font-medium first:pl-4 last:pr-4";
const td = "px-2.5 py-2.5 whitespace-nowrap first:pl-4 last:pr-4";

/** Transmisiones en tabla, con las mismas columnas que el CSV (solo escritorio ancho). Cada fila abre sus lotes FIFO. */
function SalesTable({ sales, data }: { sales: TaxSale[]; data: PortfolioData }) {
  const [open, setOpen] = useState<string | null>(null);
  return (
    <Card className="p-0 md:p-0">
      <table className="w-full text-sm tabular-nums">
        <thead className="text-xs text-text-muted">
          <tr className="border-b border-border">
            <th scope="col" className={cn(th, "text-left")}>Fecha</th>
            <th scope="col" className={cn(th, "text-left")}>Activo</th>
            <th scope="col" className={cn(th, "text-right")}>Cantidad</th>
            <th scope="col" className={cn(th, "text-right")}>Transmisión</th>
            <th scope="col" className={cn(th, "text-right")}>Adquisición</th>
            <th scope="col" className={cn(th, "text-right")}>Resultado</th>
          </tr>
        </thead>
        <tbody>
          {sales.map((sale) => {
            const asset = data.assets.get(sale.assetId);
            const expanded = open === sale.transactionId;
            return (
              <Fragment key={sale.transactionId}>
                <tr
                  tabIndex={0}
                  aria-expanded={expanded}
                  onClick={() => setOpen(expanded ? null : sale.transactionId)}
                  onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && (e.preventDefault(), setOpen(expanded ? null : sale.transactionId))}
                  className="cursor-pointer border-b border-border outline-none last:border-0 hover:bg-surface-2 focus-visible:bg-surface-2"
                >
                  <td className={cn(td, "text-text-muted")}>{formatDate(sale.date)}</td>
                  <td className={cn(td, "max-w-72 truncate font-medium")}>{asset?.name ?? "Activo"}</td>
                  <td className={cn(td, "text-right")}>{formatQuantity(sale.quantity)}</td>
                  <td className={cn(td, "text-right")}>{formatCurrency(sale.proceeds)}</td>
                  <td className={cn(td, "text-right")}>{formatCurrency(sale.cost)}</td>
                  <td className={cn(td, "text-right font-medium")}>
                    <span className="inline-flex items-center gap-2">
                      <VariationAmount value={sale.gain} format={signed} />
                      {!sale.deferredLoss.isZero() && <span className="text-[11px] font-normal text-accent">2 meses</span>}
                      <ChevronDown className={cn("size-4 text-text-muted transition-transform", expanded && "rotate-180")} aria-hidden />
                    </span>
                  </td>
                </tr>
                {expanded && (
                  <tr className="border-b border-border bg-surface-2/50">
                    <td colSpan={6} className="px-4 py-3 text-xs text-text-muted">
                      <p className="mb-1">Lotes vendidos (FIFO)</p>
                      <ul className="grid gap-0.5">
                        {sale.lots.map((lot, i) => (
                          <li key={`${lot.transactionId}-${i}`}>
                            {formatDate(lot.date.slice(0, 10))} · {formatQuantity(lot.quantity)} uds · {formatCurrency(lot.cost)}
                          </li>
                        ))}
                      </ul>
                      {sale.repurchases.length > 0 && (
                        <p className="mt-2 text-pretty">
                          Recompraste {sale.repurchases.map((r) => `${formatQuantity(r.quantity)} el ${formatDate(r.date)}`).join(", ")}: dentro de los
                          dos meses anteriores o posteriores a la venta. No computable: {formatCurrency(sale.deferredLoss.abs())}.
                        </p>
                      )}
                    </td>
                  </tr>
                )}
              </Fragment>
            );
          })}
        </tbody>
      </table>
    </Card>
  );
}

/** Dividendos e intereses en tabla (solo escritorio ancho). */
function IncomeTable({ incomes, data }: { incomes: TaxIncome[]; data: PortfolioData }) {
  return (
    <Card className="p-0 md:p-0">
      <table className="w-full text-sm tabular-nums">
        <thead className="text-xs text-text-muted">
          <tr className="border-b border-border">
            <th scope="col" className={cn(th, "text-left")}>Fecha</th>
            <th scope="col" className={cn(th, "text-left")}>Activo</th>
            <th scope="col" className={cn(th, "text-left")}>Tipo</th>
            <th scope="col" className={cn(th, "text-left")}>País</th>
            <th scope="col" className={cn(th, "text-right")}>Bruto</th>
            <th scope="col" className={cn(th, "text-right")}>Retención</th>
            <th scope="col" className={cn(th, "text-right")}>Neto</th>
          </tr>
        </thead>
        <tbody>
          {incomes.map((d) => {
            const asset = d.assetId ? data.assets.get(d.assetId) : undefined;
            return (
              <tr key={d.transactionId} className="border-b border-border last:border-0">
                <td className={cn(td, "text-text-muted")}>{formatDate(d.date)}</td>
                <td className={cn(td, "max-w-72 truncate font-medium")}>
                  {asset?.name ?? (d.kind === "interest" ? "Intereses de la cuenta" : "Dividendo")}
                </td>
                <td className={td}>{d.kind === "interest" ? "Interés" : "Dividendo"}</td>
                <td className={td}>{d.country === "ES" ? "España" : d.country}</td>
                <td className={cn(td, "text-right")}>{formatCurrency(d.gross)}</td>
                <td className={cn(td, "text-right")}>{formatCurrency(d.withholding)}</td>
                <td className={cn(td, "text-right font-medium")}>{formatCurrency(d.net)}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </Card>
  );
}

function Row({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-4 py-2.5">
      <dt className="text-text-muted">{label}</dt>
      <dd className="text-right font-medium tabular-nums">{value}</dd>
    </div>
  );
}
