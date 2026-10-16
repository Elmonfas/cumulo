"use client";

import Decimal from "decimal.js";
import { ChevronRight } from "lucide-react";
import Link from "next/link";
import { useMemo } from "react";
import { activityByDay, intensityThresholds, monthGrid } from "@/domain/calendar";
import type { Transaction } from "@/domain/models";
import { formatCurrency, formatMonthYear, todayIso } from "@/lib/format";
import { CalendarGrid, Legend } from "./operations-calendar";

/** Calendario del mes en curso para Inicio; al tocarlo se abre el completo. */
export function CalendarWidget({ transactions }: { transactions: readonly Transaction[] }) {
  const today = todayIso();
  const year = Number(today.slice(0, 4));
  const month = Number(today.slice(5, 7));
  const { days, thresholds } = useMemo(() => {
    const days = activityByDay(transactions);
    // Los mismos cortes que el calendario completo: un tono significa lo mismo en ambos.
    return { days, thresholds: intensityThresholds([...days.values()].flatMap((d) => [d.bought, d.sold])) };
  }, [transactions]);
  const inMonth = [...days.values()].filter((d) => d.date.startsWith(today.slice(0, 7)));
  const bought = inMonth.reduce((sum, d) => sum.plus(d.bought), new Decimal(0));

  return (
    <Link
      href="/herramientas/calendario"
      className="group block min-w-0 rounded-card border border-border bg-surface p-5 shadow-card transition-colors outline-none hover:bg-surface-2/40 focus-visible:ring-3 focus-visible:ring-accent/40 md:p-6"
    >
      <div className="flex items-center justify-between gap-2">
        <h2 className="font-medium">Calendario</h2>
        <span className="flex items-center gap-0.5 text-xs text-text-muted transition-colors group-hover:text-text first-letter:uppercase">
          {formatMonthYear(today.slice(0, 7))}
          <ChevronRight className="size-4" aria-hidden />
        </span>
      </div>
      <p className="mt-0.5 text-xs text-text-muted">
        {inMonth.length === 0
          ? "Sin operaciones este mes"
          : `${inMonth.length} ${inMonth.length === 1 ? "día" : "días"} con operaciones · ${formatCurrency(bought)} comprados`}
      </p>
      <CalendarGrid
        compact
        className="mx-auto mt-3 max-w-72"
        label={`Operaciones de ${formatMonthYear(today.slice(0, 7))}`}
        weeks={monthGrid(year, month)}
        days={days}
        thresholds={thresholds}
        today={today}
      />
      <Legend compact />
    </Link>
  );
}
