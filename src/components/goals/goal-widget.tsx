"use client";

import Decimal from "decimal.js";
import { ChevronRight } from "lucide-react";
import Link from "next/link";
import type { Repositories } from "@/data/repositories";
import { goalProgress } from "@/domain/goals";
import type { Transaction } from "@/domain/models";
import { useLiveQuery } from "@/hooks/use-live-query";
import { formatCurrency, formatMonthYear, formatNumber, todayIso } from "@/lib/format";

const loadGoals = (repositories: Repositories) => repositories.goals.list();

/** En Inicio: el objetivo más cercano en el tiempo; si no hay, nada. */
export function GoalWidget({ value, transactions }: { value: Decimal; transactions: readonly Transaction[] }) {
  const goals = useLiveQuery(loadGoals);
  if (goals.status !== "ready" || goals.data.length === 0) return null;
  const today = todayIso();
  const goal = goals.data.find((g) => g.targetDate > today) ?? goals.data[0];
  const p = goalProgress(goal, value, transactions, today);
  const percent = p.progress.times(100);
  const more = goals.data.length - 1;

  return (
    <Link
      href="/herramientas/objetivos"
      className="group block rounded-card border border-border bg-surface p-5 shadow-card transition-colors outline-none hover:bg-surface-2/40 focus-visible:ring-3 focus-visible:ring-accent/40 md:p-6"
    >
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <p className="text-xs text-text-muted first-letter:uppercase">
            Objetivo · {formatMonthYear(goal.targetDate)}
            {more > 0 ? ` · y ${more} más` : ""}
          </p>
          <h2 className="truncate font-medium">{goal.name}</h2>
        </div>
        <span className="flex shrink-0 items-center gap-1 text-lg font-medium text-accent tabular-nums">
          {formatNumber(Decimal.min(percent, 100), 0)} %
          <ChevronRight className="size-4 text-text-muted transition-colors group-hover:text-text" aria-hidden />
        </span>
      </div>
      <div className="mt-3 h-2 overflow-hidden rounded-full bg-surface-2" aria-hidden>
        <div className="h-full rounded-full bg-accent" style={{ width: `${Math.max(2, Number(percent.toFixed(2)))}%` }} />
      </div>
      <p className="mt-2.5 truncate text-xs text-text-muted">
        {p.reached
          ? "¡Conseguido!"
          : `${formatCurrency(p.current)} de ${formatCurrency(p.target)} · ${
              p.onTrack ? "vas bien" : p.requiredMonthly ? `necesitas ${formatCurrency(p.requiredMonthly)}/mes` : "sin tiempo"
            }`}
      </p>
    </Link>
  );
}
