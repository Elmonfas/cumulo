"use client";

import Decimal from "decimal.js";
import { Loader2, Search, X } from "lucide-react";
import dynamic from "next/dynamic";
import { useEffect, useMemo, useState } from "react";
import { AnimatedAmount } from "@/components/animated-amount";
import { AssetAvatar } from "@/components/asset-avatar";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { DecimalField } from "@/components/ui/decimal-field";
import { VariationAmount, VariationBadge } from "@/components/variation-badge";
import { simulateDca } from "@/domain/dca";
import type { ClosePoint } from "@/domain/history";
import { useAssetSearch } from "@/hooks/use-asset-search";
import { formatCurrency, formatDate, formatNumber, formatPercent, todayIso } from "@/lib/format";
import { ASSET_TYPE_LABELS } from "@/lib/labels";
import { parseDecimal } from "@/lib/parse";
import { cn } from "@/lib/utils";
import { priceKey, type AssetCandidate, type PriceHistoryResponse } from "@/prices/types";

const ValueChart = dynamic(() => import("@/components/charts/value-chart").then((m) => m.ValueChart), {
  ssr: false,
  loading: () => <div className="h-52 animate-pulse rounded-2xl bg-surface-2 md:h-64" aria-hidden />,
});

type History = { status: "idle" } | { status: "loading" } | { status: "ready"; closes: ClosePoint[] } | { status: "error" };

const defaultStart = () => {
  const d = new Date();
  return `${d.getFullYear() - 3}-${String(d.getMonth() + 1).padStart(2, "0")}`;
};

export function DcaSimulator() {
  const [candidate, setCandidate] = useState<AssetCandidate | null>(null);
  const [amount, setAmount] = useState("100");
  const [fee, setFee] = useState("0");
  const [startMonth, setStartMonth] = useState(defaultStart);
  const [history, setHistory] = useState<History>({ status: "idle" });

  const startDate = `${startMonth}-01`;
  const key = candidate ? priceKey(candidate.priceSource, candidate.priceSourceId) : null;

  useEffect(() => {
    if (!key) return;
    let cancelled = false;
    fetch(`/api/prices/history?key=${encodeURIComponent(key)}&from=${startDate}`)
      .then((r) => (r.ok ? (r.json() as Promise<PriceHistoryResponse>) : Promise.reject(new Error(String(r.status)))))
      .then((body) => !cancelled && setHistory({ status: "ready", closes: body.points.map((p) => ({ date: p.date, close: new Decimal(p.close) })) }))
      .catch(() => !cancelled && setHistory({ status: "error" }));
    return () => {
      cancelled = true;
    };
  }, [key, startDate]);

  const parsed = useMemo(() => {
    const monthly = parseDecimal(amount);
    const commission = parseDecimal(fee || "0");
    const errors: { amount?: string; fee?: string } = {};
    if (!monthly || !monthly.gt(0)) errors.amount = "Mayor que 0.";
    if (!commission || commission.isNegative()) errors.fee = "0 o más.";
    else if (monthly && !monthly.gt(commission)) errors.fee = "Menor que la aportación.";
    return { monthly, commission, errors };
  }, [amount, fee]);

  const result = useMemo(() => {
    if (history.status !== "ready" || Object.keys(parsed.errors).length) return null;
    return simulateDca({ closes: history.closes, monthlyAmount: parsed.monthly!, fee: parsed.commission!, startDate });
  }, [history, parsed, startDate]);

  const loading = Boolean(key) && (history.status === "loading" || history.status === "idle");

  return (
    <div className="grid grid-cols-[minmax(0,1fr)] gap-4 md:gap-5 lg:grid-cols-[minmax(0,22rem)_minmax(0,1fr)] lg:items-start">
      <Card className="grid grid-cols-[minmax(0,1fr)] gap-4">
        <CandidatePicker
          value={candidate}
          onChange={(c) => {
            setCandidate(c);
            setHistory(c ? { status: "loading" } : { status: "idle" });
          }}
        />
        <div className="grid grid-cols-2 gap-3">
          <DecimalField label="Cada mes" suffix="€" value={amount} onValueChange={setAmount} error={parsed.errors.amount} />
          <DecimalField label="Comisión" suffix="€" value={fee} onValueChange={setFee} error={parsed.errors.fee} hint="Por compra" />
        </div>
        <div className="grid gap-1.5">
          <label htmlFor="dca-start" className="text-sm font-medium">
            Desde
          </label>
          <input
            id="dca-start"
            type="month"
            value={startMonth}
            max={todayIso().slice(0, 7)}
            onChange={(e) => {
              if (!e.target.value) return;
              setStartMonth(e.target.value);
              if (candidate) setHistory({ status: "loading" });
            }}
            className="h-12 w-full rounded-2xl border border-border bg-surface-2 px-4 text-base tabular-nums outline-none focus:border-accent focus:ring-3 focus:ring-accent/20"
          />
          {candidate?.priceSource === "coingecko" && (
            <p className="text-xs text-text-muted">El histórico gratuito de cripto cubre como mucho el último año.</p>
          )}
        </div>
      </Card>

      {!candidate ? (
        <Card className="flex min-h-64 items-center justify-center text-center text-sm text-pretty text-text-muted">
          Elige un activo para ver cuánto tendrías hoy si hubieras invertido cada mes, con precios reales.
        </Card>
      ) : loading ? (
        <div className="h-96 animate-pulse rounded-card bg-surface" aria-hidden />
      ) : history.status === "error" ? (
        <Card className="text-sm text-text-muted">No se pudo cargar el histórico de precios. Inténtalo más tarde.</Card>
      ) : !result ? (
        <Card className="text-sm text-text-muted">No hay precios suficientes en ese periodo o los datos no son válidos.</Card>
      ) : (
        <Results result={result} />
      )}
    </div>
  );
}

function Results({ result: r }: { result: NonNullable<ReturnType<typeof simulateDca>> }) {
  const lumpGain = r.lumpSumValue.minus(r.invested);
  const dcaWins = r.value.gte(r.lumpSumValue);
  const points = r.timeline.map((p) => ({ date: p.date, value: p.value, invested: p.invested, bought: p.invested, proceeds: new Decimal(0) }));
  return (
    <div className="grid min-w-0 grid-cols-[minmax(0,1fr)] gap-4 md:gap-5">
      <Card>
        <p className="text-sm text-text-muted">
          Tendrías hoy · {r.buys.length} compras desde {formatDate(r.buys[0].date)}
        </p>
        <div className="@container">
          <AnimatedAmount value={r.value} className="hero-figure mt-2 block whitespace-nowrap" />
        </div>
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <VariationBadge ratio={r.gainPct} />
          <VariationAmount value={r.gain} format={(v) => formatCurrency(v, { signed: true })} className="text-sm" />
          <span className="text-sm text-text-muted">sobre {formatCurrency(r.invested)} aportados</span>
        </div>
        <div className="mt-4 -mx-1">
          <ValueChart points={points} investedLabel="Aportado" />
        </div>
      </Card>

      <Card>
        <dl className="divide-y divide-border text-sm">
          <Row label="Aportado" value={formatCurrency(r.invested)} />
          <Row label="Participaciones" value={formatNumber(r.quantity, 4)} />
          <Row label="Precio medio de compra" value={formatCurrency(r.averagePrice)} />
          <Row label="Precio actual" value={formatCurrency(r.finalPrice)} />
          <Row
            label="Rentabilidad anual (TIR)"
            value={r.annualized ? <VariationAmount value={r.annualized} format={(v) => formatPercent(v)} /> : <span className="text-text-muted">Menos de 1 año</span>}
          />
          <Row
            label="Todo de golpe el primer día"
            value={
              <span className="inline-flex items-center gap-2">
                {formatCurrency(r.lumpSumValue)}
                <VariationAmount value={lumpGain} format={(v) => formatCurrency(v, { signed: true })} className="text-xs" />
              </span>
            }
          />
        </dl>
        <p className="mt-3 text-xs text-pretty text-text-muted">
          {dcaWins
            ? "En este periodo, aportar cada mes habría dado más que invertirlo todo al principio."
            : "En este periodo, invertirlo todo al principio habría dado más que aportar cada mes."}{" "}
          Rentabilidades pasadas no garantizan las futuras.
        </p>
      </Card>
    </div>
  );
}

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-4 py-2.5">
      <dt className="text-text-muted">{label}</dt>
      <dd className="text-right font-medium tabular-nums">{value}</dd>
    </div>
  );
}

/** Buscador que solo devuelve el resultado elegido: no da de alta nada en tu cartera. */
function CandidatePicker({ value, onChange }: { value: AssetCandidate | null; onChange: (c: AssetCandidate | null) => void }) {
  const [query, setQuery] = useState("");
  const search = useAssetSearch(query);

  if (value) {
    return (
      <div className="grid min-w-0 grid-cols-[minmax(0,1fr)] gap-1.5">
        <span className="text-sm font-medium">Activo</span>
        <div className="flex items-center gap-3 rounded-2xl border border-border bg-surface-2 p-2.5 pr-2">
          <AssetAvatar asset={value} />
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium">{value.name}</p>
            <p className="truncate text-xs text-text-muted">{[ASSET_TYPE_LABELS[value.type], value.priceSourceId.toUpperCase()].join(" · ")}</p>
          </div>
          <Button variant="ghost" size="icon-sm" aria-label="Cambiar activo" onClick={() => onChange(null)}>
            <X aria-hidden />
          </Button>
        </div>
      </div>
    );
  }

  const results = search.status === "ready" ? [...search.result.securities, ...search.result.crypto].slice(0, 8) : [];
  return (
    <div className="grid min-w-0 grid-cols-[minmax(0,1fr)] gap-1.5">
      <label htmlFor="dca-asset" className="text-sm font-medium">
        Activo
      </label>
      <div className="flex h-12 items-center gap-2 rounded-2xl border border-border bg-surface-2 px-4 focus-within:border-accent focus-within:ring-3 focus-within:ring-accent/20">
        <Search className="size-4 shrink-0 text-text-muted" aria-hidden />
        <input
          id="dca-asset"
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Ej.: VWCE, Apple, bitcoin"
          autoComplete="off"
          size={1}
          className="w-full min-w-0 bg-transparent text-base outline-none placeholder:text-text-muted"
        />
        {search.status === "loading" && <Loader2 className="size-4 shrink-0 animate-spin text-text-muted" aria-hidden />}
      </div>
      {results.length > 0 && (
        <ul className="grid grid-cols-[minmax(0,1fr)] gap-1" aria-label="Resultados">
          {results.map((c) => (
            <li key={`${c.priceSource}:${c.priceSourceId}`}>
              <button
                type="button"
                onClick={() => onChange(c)}
                className={cn(
                  "flex w-full min-w-0 items-center gap-3 rounded-2xl px-2.5 py-2 text-left transition-colors outline-none hover:bg-surface-2 focus-visible:bg-surface-2 focus-visible:ring-3 focus-visible:ring-accent/40",
                )}
              >
                <AssetAvatar asset={c} />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-medium">{c.name}</span>
                  <span className="block truncate text-xs text-text-muted">
                    {[ASSET_TYPE_LABELS[c.type], c.priceSourceId.toUpperCase(), c.exchange].filter(Boolean).join(" · ")}
                  </span>
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
      {search.status === "ready" && results.length === 0 && <p className="px-1 text-sm text-text-muted">Sin resultados.</p>}
    </div>
  );
}
