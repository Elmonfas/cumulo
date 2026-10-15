"use client";

import type Decimal from "decimal.js";
import { useMemo, useState } from "react";
import { AnimatedAmount } from "@/components/animated-amount";
import { Card } from "@/components/ui/card";
import { DecimalField } from "@/components/ui/decimal-field";
import { Switch } from "@/components/ui/switch";
import { calculateCompoundInterest, type CompoundInterestResult } from "@/domain/compound-interest";
import { formatCurrency, formatPercent } from "@/lib/format";
import { parseDecimal, parsePercent } from "@/lib/parse";
import dynamic from "next/dynamic";

// Recharts se carga aparte para no retrasar el primer pintado.
const GrowthChart = dynamic(() => import("./growth-chart").then((m) => m.GrowthChart), {
  ssr: false,
  loading: () => <div className="h-56 animate-pulse rounded-2xl bg-surface-2 md:h-64" aria-hidden />,
});

interface FormState {
  initialCapital: string;
  monthlyContribution: string;
  annualRate: string;
  years: string;
  inflationEnabled: boolean;
  annualInflation: string;
}

const DEFAULTS: FormState = {
  initialCapital: "10.000",
  monthlyContribution: "200",
  annualRate: "7",
  years: "20",
  inflationEnabled: false,
  annualInflation: "2",
};

type Errors = Partial<Record<keyof FormState, string>>;

function parseForm(form: FormState) {
  const errors: Errors = {};
  const initialCapital = parseDecimal(form.initialCapital);
  if (!initialCapital || initialCapital.isNegative()) errors.initialCapital = "Introduce una cantidad de 0 o más.";

  const monthlyContribution = parseDecimal(form.monthlyContribution);
  if (!monthlyContribution || monthlyContribution.isNegative()) {
    errors.monthlyContribution = "Introduce una cantidad de 0 o más.";
  }

  const annualRate = parsePercent(form.annualRate);
  if (!annualRate || annualRate.lte(-1) || annualRate.gt(1)) errors.annualRate = "Entre -99 % y 100 %.";

  const years = parseDecimal(form.years);
  if (!years || !years.isInteger() || years.lt(1) || years.gt(100)) errors.years = "Un número entero de 1 a 100.";

  let annualInflation: Decimal | undefined;
  if (form.inflationEnabled) {
    const parsed = parsePercent(form.annualInflation);
    if (!parsed || parsed.lte(-1) || parsed.gt(1)) errors.annualInflation = "Entre -99 % y 100 %.";
    else annualInflation = parsed;
  }

  if (Object.keys(errors).length > 0) return { errors, result: null };
  const result = calculateCompoundInterest({
    initialCapital: initialCapital!,
    monthlyContribution: monthlyContribution!,
    annualRate: annualRate!,
    years: years!.toNumber(),
    annualInflation,
  });
  return { errors, result };
}

export function CompoundInterestCalculator() {
  const [form, setForm] = useState<FormState>(DEFAULTS);
  const { errors, result } = useMemo(() => parseForm(form), [form]);
  const set = <K extends keyof FormState>(key: K) => (value: FormState[K]) => setForm((f) => ({ ...f, [key]: value }));

  return (
    <div className="grid grid-cols-[minmax(0,1fr)] gap-4 md:gap-5 lg:grid-cols-[minmax(0,22rem)_minmax(0,1fr)] lg:items-start">
      <Card className="grid gap-4">
        <h2 className="sr-only">Datos</h2>
        <DecimalField label="Capital inicial" suffix="€" value={form.initialCapital} onValueChange={set("initialCapital")} error={errors.initialCapital} />
        <DecimalField
          label="Aportación mensual"
          suffix="€"
          hint="Se suma al final de cada mes."
          value={form.monthlyContribution}
          onValueChange={set("monthlyContribution")}
          error={errors.monthlyContribution}
        />
        <div className="grid grid-cols-2 gap-3">
          <DecimalField label="Rentabilidad anual" suffix="%" value={form.annualRate} onValueChange={set("annualRate")} error={errors.annualRate} />
          <DecimalField label="Plazo" suffix="años" integer value={form.years} onValueChange={set("years")} error={errors.years} />
        </div>
        <div className="grid gap-3 border-t border-border pt-4">
          <Switch
            label="Ajustar por inflación"
            description="Muestra el valor final en euros de hoy."
            checked={form.inflationEnabled}
            onCheckedChange={set("inflationEnabled")}
          />
          {form.inflationEnabled && (
            <DecimalField
              label="Inflación anual"
              suffix="%"
              value={form.annualInflation}
              onValueChange={set("annualInflation")}
              error={errors.annualInflation}
            />
          )}
        </div>
      </Card>

      {result ? <Results result={result} /> : <InvalidResults />}
    </div>
  );
}

function InvalidResults() {
  return (
    <Card className="flex min-h-64 items-center justify-center text-center text-sm text-text-muted">
      Revisa los datos marcados para ver la proyección.
    </Card>
  );
}

function Results({ result }: { result: CompoundInterestResult }) {
  const { final } = result;
  const interestShare = final.balance.isZero() ? final.balance : final.interest.div(final.balance);

  return (
    <div className="grid min-w-0 grid-cols-[minmax(0,1fr)] gap-4 md:gap-5">
      <Card>
        <p className="text-sm text-text-muted">
          Valor final en {final.year} {final.year === 1 ? "año" : "años"}
        </p>
        <div className="@container">
          <AnimatedAmount value={final.balance} className="hero-figure mt-2 block whitespace-nowrap" />
        </div>
        {final.realBalance && (
          <p className="mt-2 text-sm text-text-muted tabular-nums">
            {formatCurrency(final.realBalance)} en euros de hoy
          </p>
        )}

        <dl className="mt-5 grid grid-cols-2 gap-3">
          <Stat label="Aportado" value={formatCurrency(final.contributed)} dotClassName="bg-accent" />
          <Stat
            label="Intereses"
            value={formatCurrency(final.interest)}
            detail={`${formatPercent(interestShare, { signed: false })} del total`}
            dotClassName="bg-series-2"
          />
        </dl>

        <div className="mt-5 -mx-1">
          <GrowthChart timeline={result.timeline} />
        </div>
      </Card>

      <YearTable result={result} />
    </div>
  );
}

function Stat({ label, value, detail, dotClassName }: { label: string; value: string; detail?: string; dotClassName: string }) {
  return (
    <div className="rounded-2xl bg-surface-2 p-3.5">
      <dt className="flex items-center gap-2 text-xs text-text-muted">
        <span className={`size-2 rounded-full ${dotClassName}`} aria-hidden />
        {label}
      </dt>
      <dd className="mt-1 font-medium tabular-nums">{value}</dd>
      {detail && <dd className="text-xs text-text-muted tabular-nums">{detail}</dd>}
    </div>
  );
}

function YearTable({ result }: { result: CompoundInterestResult }) {
  const showReal = result.final.realBalance !== undefined;
  const rows = result.timeline.slice(1);
  return (
    <Card className="p-0 md:p-0">
      <h2 className="px-5 pt-5 font-medium md:px-6">Año a año</h2>
      <div className="mt-3 max-h-[28rem] overflow-auto pb-2">
        <table className="w-full text-sm tabular-nums">
          <thead className="sticky top-0 bg-surface text-xs text-text-muted">
            <tr>
              <th scope="col" className="py-2 pr-2 pl-5 text-left font-medium md:pl-6">Año</th>
              <th scope="col" className="px-2 py-2 text-right font-medium">Aportado</th>
              <th scope="col" className="px-2 py-2 text-right font-medium">Intereses</th>
              <th scope="col" className={`py-2 pl-2 text-right font-medium ${showReal ? "px-2" : "pr-5 md:pr-6"}`}>Total</th>
              {showReal && <th scope="col" className="py-2 pr-5 pl-2 text-right font-medium md:pr-6">Real</th>}
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.year} className="border-t border-border">
                <th scope="row" className="py-2.5 pr-2 pl-5 text-left font-normal text-text-muted md:pl-6">{row.year}</th>
                <td className="px-2 py-2.5 text-right whitespace-nowrap">{formatCurrency(row.contributed)}</td>
                <td className="px-2 py-2.5 text-right whitespace-nowrap">{formatCurrency(row.interest)}</td>
                <td className={`py-2.5 pl-2 text-right font-medium whitespace-nowrap ${showReal ? "px-2" : "pr-5 md:pr-6"}`}>
                  {formatCurrency(row.balance)}
                </td>
                {showReal && (
                  <td className="py-2.5 pr-5 pl-2 text-right whitespace-nowrap text-text-muted md:pr-6">
                    {formatCurrency(row.realBalance!)}
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Card>
  );
}
