"use client";

import Decimal from "decimal.js";
import { Goal as GoalIcon, Pencil, Plus, Trash2 } from "lucide-react";
import { useMemo, useState, type FormEvent } from "react";
import { EmptyState } from "@/components/empty-state";
import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { DecimalField } from "@/components/ui/decimal-field";
import { Sheet } from "@/components/ui/sheet";
import { getRepositories, type Repositories } from "@/data/repositories";
import { goalProgress, type Goal, type GoalProgress } from "@/domain/goals";
import { useLiveQuery } from "@/hooks/use-live-query";
import { usePortfolio } from "@/hooks/use-portfolio";
import { formatCurrency, formatDate, formatMonthYear, formatNumber, formatPercent, todayIso } from "@/lib/format";
import { parseDecimal, toInputString } from "@/lib/parse";
import { cn } from "@/lib/utils";

const loadGoals = (repositories: Repositories) => repositories.goals.list();

type SheetState = { open: false } | { open: true; goal?: Goal };

export function GoalsScreen() {
  const goals = useLiveQuery(loadGoals);
  const portfolio = usePortfolio();
  const [sheet, setSheet] = useState<SheetState>({ open: false });
  const today = todayIso();

  const progress = useMemo(() => {
    if (goals.status !== "ready" || portfolio.status !== "ready") return null;
    return goals.data.map((goal) => ({
      goal,
      progress: goalProgress(goal, portfolio.data.valuation.totalValue, portfolio.data.transactions, today),
    }));
  }, [goals, portfolio, today]);

  return (
    <>
      <PageHeader
        title="Objetivos"
        description="Cuánto quieres tener y para cuándo."
        back={{ href: "/herramientas", label: "Herramientas" }}
        actions={
          progress && progress.length > 0 ? (
            <Button onClick={() => setSheet({ open: true })} className="max-sm:size-10 max-sm:px-0" aria-label="Nuevo objetivo">
              <Plus aria-hidden />
              <span className="max-sm:sr-only">Nuevo</span>
            </Button>
          ) : undefined
        }
      />
      {!progress && <div className="h-56 animate-pulse rounded-card bg-surface" aria-hidden />}
      {progress && progress.length === 0 && (
        <EmptyState
          icon={GoalIcon}
          title="Ponle meta a tu cartera"
          description="Di cuánto quieres tener y para cuándo: verás cuánto llevas, cuánto tendrías que aportar al mes y si al ritmo actual llegas."
          actions={
            <Button size="lg" onClick={() => setSheet({ open: true })}>
              <Plus aria-hidden />
              Crear objetivo
            </Button>
          }
        />
      )}
      {progress && progress.length > 0 && (
        <div className="grid grid-cols-[minmax(0,1fr)] gap-4 md:grid-cols-2 md:gap-5">
          {progress.map(({ goal, progress: p }) => (
            <GoalCard key={goal.id} goal={goal} progress={p} onEdit={() => setSheet({ open: true, goal })} />
          ))}
          <p className="px-1 text-xs text-pretty text-text-muted md:col-span-2">
            Se mide con el valor actual de tu cartera. El ritmo actual es lo que has aportado de media al mes (compras menos
            ventas) en los últimos 6 meses, contando este, o desde tu primera compra si es más reciente. La rentabilidad esperada es una suposición tuya: el pasado no garantiza nada.
          </p>
        </div>
      )}

      <Sheet
        open={sheet.open}
        onOpenChange={(open) => !open && setSheet({ open: false })}
        title={sheet.open && sheet.goal ? "Editar objetivo" : "Nuevo objetivo"}
      >
        {sheet.open && <GoalForm key={sheet.goal?.id ?? "new"} goal={sheet.goal} onDone={() => setSheet({ open: false })} />}
      </Sheet>
    </>
  );
}

/** Tarjeta de un objetivo: progreso, cuota necesaria y si al ritmo actual se llega. */
export function GoalCard({ goal, progress: p, onEdit, compact = false }: { goal: Goal; progress: GoalProgress; onEdit?: () => void; compact?: boolean }) {
  const percent = p.progress.times(100);
  return (
    <Card className={cn("min-w-0", compact && "p-4 md:p-6")}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 className="truncate font-medium">{goal.name}</h2>
          <p className="mt-0.5 text-xs text-text-muted first-letter:uppercase">
            {formatMonthYear(goal.targetDate)}
            {!p.reached && p.monthsLeft > 0 && ` · faltan ${p.monthsLeft} ${p.monthsLeft === 1 ? "mes" : "meses"}`}
          </p>
        </div>
        {onEdit && (
          <button
            type="button"
            onClick={onEdit}
            aria-label={`Editar ${goal.name}`}
            className="-mt-1 -mr-1 flex size-9 shrink-0 items-center justify-center rounded-full text-text-muted transition-colors outline-none hover:bg-surface-2 hover:text-text focus-visible:ring-3 focus-visible:ring-accent/40"
          >
            <Pencil className="size-4" aria-hidden />
          </button>
        )}
      </div>

      <div className="mt-4 flex items-end justify-between gap-3">
        <p className="min-w-0 text-sm text-text-muted">
          <span className="block text-2xl font-medium text-text tabular-nums">{formatCurrency(p.current)}</span>
          de {formatCurrency(p.target)}
        </p>
        <span className="shrink-0 text-lg font-medium text-accent tabular-nums">{formatNumber(Decimal.min(percent, 100), 0)} %</span>
      </div>
      <div
        role="progressbar"
        aria-label={`Progreso de ${goal.name}`}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={Number(percent.toFixed(0))}
        className="mt-2 h-2.5 overflow-hidden rounded-full bg-surface-2"
      >
        <div
          className="h-full rounded-full bg-accent transition-[width] duration-500 ease-out motion-reduce:transition-none"
          style={{ width: `${Math.max(2, Number(percent.toFixed(2)))}%` }}
        />
      </div>

      {p.reached ? (
        <p className="mt-4 rounded-2xl bg-accent/12 px-3.5 py-2.5 text-sm font-medium text-accent">¡Conseguido! Ya tienes lo que te propusiste.</p>
      ) : (
        <dl className={cn("mt-4 grid gap-2", compact ? "grid-cols-2" : "grid-cols-2")}>
          <div className="rounded-2xl bg-surface-2 px-3.5 py-2.5">
            <dt className="text-xs text-text-muted">Necesitas aportar</dt>
            <dd className="mt-0.5 font-medium tabular-nums">
              {p.requiredMonthly ? `${formatCurrency(p.requiredMonthly)}/mes` : "Sin tiempo"}
            </dd>
          </div>
          <div className="rounded-2xl bg-surface-2 px-3.5 py-2.5">
            <dt className="text-xs text-text-muted">Ahora aportas</dt>
            <dd className="mt-0.5 font-medium tabular-nums">{formatCurrency(p.currentMonthly)}/mes</dd>
          </div>
        </dl>
      )}

      {!p.reached && (
        <p className="mt-3 text-sm text-pretty text-text-muted">
          {p.onTrack ? (
            <>
              <span className="font-medium text-accent">Vas bien.</span> Al ritmo actual tendrías {formatCurrency(p.projected)} en esa fecha.
            </>
          ) : p.reachMonth ? (
            <>
              Al ritmo actual llegarías en <span className="font-medium text-text">{formatMonthYear(p.reachMonth)}</span>.
            </>
          ) : (
            "Al ritmo actual no llegarías: prueba a aportar algo cada mes."
          )}
        </p>
      )}
    </Card>
  );
}

function GoalForm({ goal, onDone }: { goal?: Goal; onDone: () => void }) {
  const today = todayIso();
  const [name, setName] = useState(goal?.name ?? "");
  const [target, setTarget] = useState(goal ? toInputString(goal.target) : "");
  const [date, setDate] = useState(goal?.targetDate ?? "");
  const [rate, setRate] = useState(goal ? toInputString(new Decimal(goal.expectedReturn).times(100).toString()) : "6");
  const [showErrors, setShowErrors] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [saving, setSaving] = useState(false);

  const parsed = useMemo(() => {
    const errors: Partial<Record<"name" | "target" | "date" | "rate", string>> = {};
    const t = parseDecimal(target);
    const r = parseDecimal(rate);
    if (!name.trim()) errors.name = "Ponle un nombre.";
    if (!t || t.lte(0)) errors.target = "Mayor que 0.";
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || date <= today) errors.date = "Elige una fecha futura.";
    if (!r || r.lt(-50) || r.gt(50)) errors.rate = "Entre −50 y 50 %.";
    return { errors, target: t, rate: r };
  }, [name, target, date, rate, today]);
  const errors = showErrors ? parsed.errors : {};

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    setShowErrors(true);
    if (Object.keys(parsed.errors).length > 0) return;
    setSaving(true);
    const data = {
      name: name.trim().slice(0, 120),
      target: parsed.target!.toString(),
      targetDate: date,
      expectedReturn: parsed.rate!.div(100).toString(),
    };
    const repositories = getRepositories();
    if (goal) await repositories.goals.update(goal.id, data);
    else await repositories.goals.add(data);
    setSaving(false);
    onDone();
  }

  async function onDelete() {
    if (!goal) return;
    if (!confirmDelete) {
      setConfirmDelete(true);
      return;
    }
    await getRepositories().goals.remove(goal.id);
    onDone();
  }

  return (
    <form onSubmit={onSubmit} className="grid grid-cols-[minmax(0,1fr)] gap-4 pt-1" noValidate>
      <div className="grid gap-1.5">
        <label htmlFor="goal-name" className="text-sm font-medium">
          Nombre
        </label>
        <input
          id="goal-name"
          value={name}
          maxLength={120}
          onChange={(e) => setName(e.target.value)}
          placeholder="Entrada del piso, colchón, jubilación…"
          className={cn(
            "h-12 w-full rounded-2xl border bg-surface-2 px-4 text-base outline-none focus:border-accent focus:ring-3 focus:ring-accent/20",
            errors.name ? "border-accent" : "border-border",
          )}
        />
        {errors.name && <p className="text-xs text-accent">{errors.name}</p>}
      </div>

      <div className="grid grid-cols-2 gap-3">
        <DecimalField label="Quiero tener" suffix="€" value={target} onValueChange={setTarget} error={errors.target} placeholder="30.000" />
        <div className="grid min-w-0 gap-1.5">
          <label htmlFor="goal-date" className="text-sm font-medium">
            Para el
          </label>
          <input
            id="goal-date"
            type="date"
            value={date}
            min={today}
            onChange={(e) => setDate(e.target.value)}
            className={cn(
              "h-12 w-full min-w-0 rounded-2xl border bg-surface-2 px-3 text-base tabular-nums outline-none focus:border-accent focus:ring-3 focus:ring-accent/20",
              errors.date ? "border-accent" : "border-border",
            )}
          />
          {errors.date && <p className="text-xs text-accent">{errors.date}</p>}
        </div>
      </div>

      <DecimalField
        label="Rentabilidad anual esperada"
        suffix="%"
        value={rate}
        onValueChange={setRate}
        error={errors.rate}
        hint="Una suposición: la bolsa mundial ha dado de media un 6–8 % anual a largo plazo, con años muy malos por medio."
      />

      {date && parsed.target && !parsed.errors.date && (
        <p className="rounded-2xl bg-surface-2 px-4 py-3 text-sm text-text-muted">
          {formatCurrency(parsed.target, { reveal: true })} para el {formatDate(date)}
          {parsed.rate && !parsed.errors.rate ? `, suponiendo un ${formatPercent(parsed.rate.div(100), { signed: false })} anual.` : "."}
        </p>
      )}

      <div className="flex flex-col-reverse gap-2 pt-1 sm:flex-row sm:items-center">
        {goal && (
          <Button type="button" variant={confirmDelete ? "secondary" : "ghost"} onClick={onDelete} className="sm:mr-auto">
            <Trash2 aria-hidden />
            {confirmDelete ? "Pulsa otra vez para borrar" : "Borrar"}
          </Button>
        )}
        <Button type="submit" size="lg" disabled={saving} className="sm:ml-auto sm:min-w-40">
          {goal ? "Guardar cambios" : "Crear objetivo"}
        </Button>
      </div>
    </form>
  );
}
