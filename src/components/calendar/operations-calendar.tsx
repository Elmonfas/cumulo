"use client";

import Decimal from "decimal.js";
import { CalendarDays, ChevronLeft, ChevronRight } from "lucide-react";
import Link from "next/link";
import { useMemo, useState, type CSSProperties } from "react";
import { AssetAvatar } from "@/components/asset-avatar";
import { EmptyState } from "@/components/empty-state";
import { PageHeader } from "@/components/layout/page-header";
import { buttonVariants } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import type { Repositories } from "@/data/repositories";
import { activityByDay, intensity, intensityThresholds, monthGrid, type DayActivity, type Intensity } from "@/domain/calendar";
import type { Asset } from "@/domain/models";
import { transactionTotal } from "@/domain/portfolio";
import { useLiveQuery } from "@/hooks/use-live-query";
import { useWideScreen } from "@/hooks/use-media-query";
import { formatCurrency, formatDate, formatMonthYear, formatQuantity, todayIso } from "@/lib/format";
import { TRANSACTION_TYPE_LABELS } from "@/lib/labels";
import { cn } from "@/lib/utils";

const loadData = async (repositories: Repositories) => {
  const [transactions, assets] = await Promise.all([repositories.transactions.list(), repositories.assets.list()]);
  return { transactions, assets: new Map(assets.map((a) => [a.id, a])) };
};

const WEEKDAYS = ["L", "M", "X", "J", "V", "S", "D"];
const WEEKDAYS_LONG = ["lunes", "martes", "miércoles", "jueves", "viernes", "sábado", "domingo"];

/** Opacidad del color por nivel: de más claro a más intenso. */
const LEVEL_MIX: Record<Intensity, number> = { 0: 0, 1: 22, 2: 42, 3: 66, 4: 100 };
const tone = (color: string, level: Intensity) => `color-mix(in srgb, ${color} ${LEVEL_MIX[level]}%, transparent)`;
const BUY = "var(--accent)";
const SELL = "var(--series-3)";

type Month = { year: number; month: number };
const monthKey = ({ year, month }: Month) => `${year}-${String(month).padStart(2, "0")}`;
const shiftMonth = ({ year, month }: Month, delta: number): Month => {
  const index = year * 12 + (month - 1) + delta;
  return { year: Math.floor(index / 12), month: (index % 12) + 1 };
};
const parseMonth = (iso: string): Month => ({ year: Number(iso.slice(0, 4)), month: Number(iso.slice(5, 7)) });

export function OperationsCalendar() {
  const data = useLiveQuery(loadData);
  return (
    <>
      <PageHeader
        title="Calendario"
        description="Los días que compraste y vendiste, y cuánto."
        back={{ href: "/herramientas", label: "Herramientas" }}
      />
      {data.status === "loading" && <div className="h-96 animate-pulse rounded-card bg-surface" aria-hidden />}
      {data.status === "error" && <Card className="text-sm text-text-muted">{data.error.message}</Card>}
      {data.status === "ready" &&
        (data.data.transactions.some((t) => t.type === "buy" || t.type === "sell") ? (
          <CalendarContent transactions={data.data.transactions} assets={data.data.assets} />
        ) : (
          <EmptyState
            icon={CalendarDays}
            title="Tu calendario está vacío"
            description="Cuando registres compras y ventas, cada día con operaciones se marcará con un color más intenso cuanto más dinero movieras."
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

function CalendarContent({ transactions, assets }: { transactions: Parameters<typeof activityByDay>[0]; assets: Map<string, Asset> }) {
  const today = todayIso();
  const days = useMemo(() => activityByDay(transactions), [transactions]);
  // Cortes comunes a compras y ventas: el mismo tono significa una cantidad parecida.
  const thresholds = useMemo(
    () => intensityThresholds([...days.values()].flatMap((d) => [d.bought, d.sold])),
    [days],
  );
  const activeDays = useMemo(() => [...days.keys()].sort(), [days]);
  const first = parseMonth(activeDays[0] ?? today);
  const current = parseMonth(today);

  // Se abre en el mes actual si tiene actividad; si no, en el último con operaciones.
  const [month, setMonth] = useState<Month>(() =>
    activeDays.some((d) => d.startsWith(monthKey(current))) ? current : parseMonth(activeDays.at(-1) ?? today),
  );
  const [selected, setSelected] = useState<string | null>(null);

  // En escritorio ancho se ven tres meses: los dos anteriores y el elegido.
  const wide = useWideScreen();
  const shown = wide ? [shiftMonth(month, -2), shiftMonth(month, -1), month] : [month];
  const key = monthKey(month);
  const shownKeys = shown.map(monthKey);
  const inMonth = [...days.values()].filter((d) => shownKeys.includes(d.date.slice(0, 7)));
  const title = wide ? `${formatMonthYear(shownKeys[0])} – ${formatMonthYear(key)}` : formatMonthYear(key);
  const totals = inMonth.reduce(
    (sum, d) => ({ bought: sum.bought.plus(d.bought), sold: sum.sold.plus(d.sold), days: sum.days + 1 }),
    { bought: new Decimal(0), sold: new Decimal(0), days: 0 },
  );
  const canBack = monthKey(month) > monthKey(first);
  const canForward = monthKey(month) < monthKey(current);
  const go = (delta: number) => {
    setMonth((m) => shiftMonth(m, delta));
    setSelected(null);
  };
  const selectedDay = selected ? days.get(selected) : undefined;

  return (
    <div className="grid grid-cols-[minmax(0,1fr)] gap-4 md:grid-cols-[minmax(0,1fr)_minmax(0,20rem)] md:items-start md:gap-5 xl:grid-cols-[minmax(0,1fr)_minmax(0,22rem)]">
      <Card className="p-4 md:p-6">
        <div className="flex items-center justify-between gap-2">
          <MonthButton label="Mes anterior" disabled={!canBack} onClick={() => go(-1)}>
            <ChevronLeft className="size-5" aria-hidden />
          </MonthButton>
          <h2 className="text-base font-medium first-letter:uppercase" aria-live="polite">
            {title}
          </h2>
          <MonthButton label="Mes siguiente" disabled={!canForward} onClick={() => go(1)}>
            <ChevronRight className="size-5" aria-hidden />
          </MonthButton>
        </div>

        <div className={cn("mt-4", wide && "grid grid-cols-3 gap-8")}>
          {shown.map((m) => (
            <div key={monthKey(m)} className="min-w-0">
              {wide && <h3 className="mb-2 text-sm font-medium text-text-muted first-letter:uppercase">{formatMonthYear(monthKey(m))}</h3>}
              <CalendarGrid
                label={`Operaciones de ${formatMonthYear(monthKey(m))}`}
                weeks={monthGrid(m.year, m.month)}
                days={days}
                thresholds={thresholds}
                today={today}
                selected={selected}
                onSelect={(date) => setSelected(date === selected ? null : date)}
              />
            </div>
          ))}
        </div>

        <Legend />
      </Card>

      <div className="grid grid-cols-[minmax(0,1fr)] gap-4 md:gap-5">
        <Card className="grid grid-cols-3 gap-2 p-4 md:p-5">
          <Stat label="Comprado" value={formatCurrency(totals.bought)} dot="bg-accent" />
          <Stat label="Vendido" value={formatCurrency(totals.sold)} dot="bg-series-3" />
          <Stat label="Días activos" value={String(totals.days)} />
        </Card>

        {selectedDay ? (
          <DayDetail day={selectedDay} assets={assets} />
        ) : (
          <p className="px-1 text-sm text-text-muted">
            {inMonth.length > 0 ? "Toca un día marcado para ver sus operaciones." : wide ? "En estos meses no hiciste operaciones." : "Este mes no hiciste operaciones."}
          </p>
        )}
      </div>
    </div>
  );
}

/**
 * Rejilla de un mes. Con `onSelect` los días con operaciones son botones; sin
 * él (widget de Inicio), solo se pintan. `compact` reduce tamaños.
 */
export function CalendarGrid({
  label,
  weeks,
  days,
  thresholds,
  today,
  selected = null,
  onSelect,
  compact = false,
  className,
}: {
  label: string;
  weeks: (string | null)[][];
  days: Map<string, DayActivity>;
  thresholds: Decimal[];
  today: string;
  selected?: string | null;
  onSelect?: (date: string) => void;
  compact?: boolean;
  className?: string;
}) {
  // En compacto, el contenedor (@container del widget) decide: media tarjeta de móvil o más ancho.
  const gap = compact ? "gap-0.5 @[15rem]:gap-1" : "gap-1.5";
  return (
    <div role="grid" aria-label={label} className={cn("grid", gap, className)}>
      <div role="row" className={cn("grid grid-cols-7", gap)}>
        {WEEKDAYS.map((w, i) => (
          <span
            key={w}
            role="columnheader"
            aria-label={WEEKDAYS_LONG[i]}
            className={cn("text-center font-medium text-text-muted", compact ? "text-[9px] @[15rem]:text-[10px]" : "text-[11px]")}
          >
            {w}
          </span>
        ))}
      </div>
      {weeks.map((week, i) => (
        <div key={i} role="row" className={cn("grid grid-cols-7", gap)}>
          {week.map((date, j) =>
            date ? (
              <DayCell
                key={date}
                date={date}
                activity={days.get(date)}
                thresholds={thresholds}
                today={date === today}
                future={date > today}
                selected={date === selected}
                onSelect={onSelect ? () => onSelect(date) : undefined}
                compact={compact}
              />
            ) : (
              <span key={`empty-${j}`} role="gridcell" aria-hidden />
            ),
          )}
        </div>
      ))}
    </div>
  );
}

function MonthButton({ label, disabled, onClick, children }: { label: string; disabled: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      aria-label={label}
      disabled={disabled}
      onClick={onClick}
      className="flex size-9 items-center justify-center rounded-full text-text-muted transition-colors outline-none hover:bg-surface-2 hover:text-text focus-visible:ring-3 focus-visible:ring-accent/40 disabled:opacity-30 disabled:hover:bg-transparent"
    >
      {children}
    </button>
  );
}

function DayCell({
  date,
  activity,
  thresholds,
  today,
  future,
  selected,
  onSelect,
  compact,
}: {
  date: string;
  activity?: DayActivity;
  thresholds: Decimal[];
  today: boolean;
  future: boolean;
  selected: boolean;
  onSelect?: () => void;
  compact: boolean;
}) {
  const size = compact ? "rounded-md text-[9px] @[15rem]:rounded-lg @[15rem]:text-[11px]" : "rounded-xl text-sm";
  const day = Number(date.slice(8, 10));
  const buyLevel = activity ? intensity(activity.bought, thresholds) : 0;
  const sellLevel = activity ? intensity(activity.sells ? activity.sold : new Decimal(0), thresholds) : 0;
  const strong = Math.max(buyLevel, sellLevel) >= 3;

  // Compra y venta el mismo día: el recuadro se parte en diagonal.
  let background: string | undefined;
  if (buyLevel && sellLevel) background = `linear-gradient(135deg, ${tone(BUY, buyLevel)} 50%, ${tone(SELL, sellLevel)} 50%)`;
  else if (buyLevel) background = tone(BUY, buyLevel);
  else if (sellLevel) background = tone(SELL, sellLevel);

  const label = [
    formatDate(date),
    activity?.buys ? `${activity.buys} ${activity.buys === 1 ? "compra" : "compras"} por ${formatCurrency(activity.bought)}` : null,
    activity?.sells ? `${activity.sells} ${activity.sells === 1 ? "venta" : "ventas"} por ${formatCurrency(activity.sold)}` : null,
  ]
    .filter(Boolean)
    .join(", ");

  if (!activity || !onSelect) {
    return (
      <span
        role="gridcell"
        aria-label={label}
        style={activity ? ({ background } as CSSProperties) : undefined}
        className={cn(
          "flex aspect-square items-center justify-center tabular-nums",
          size,
          activity && (strong ? "font-medium text-accent-foreground" : "font-medium text-text"),
          !activity && (future ? "text-text-muted/40" : "bg-surface-2/60 text-text-muted"),
          today && "ring-2 ring-accent/60 ring-inset",
        )}
      >
        {day}
      </span>
    );
  }

  return (
    <button
      type="button"
      role="gridcell"
      aria-label={label}
      aria-selected={selected}
      onClick={onSelect}
      style={{ background } as CSSProperties}
      className={cn(
        "flex aspect-square items-center justify-center font-medium tabular-nums transition-transform duration-150 ease-out outline-none focus-visible:ring-3 focus-visible:ring-accent/40 active:scale-95",
        size,
        strong ? "text-accent-foreground" : "text-text",
        selected && "ring-2 ring-text ring-offset-2 ring-offset-surface",
        today && !selected && "ring-2 ring-accent/60 ring-inset",
      )}
    >
      {day}
    </button>
  );
}

export function Legend({ compact = false }: { compact?: boolean }) {
  const levels: Intensity[] = [1, 2, 3, 4];
  return (
    <div
      className={cn(
        "flex flex-wrap items-center justify-between gap-x-4 gap-y-1.5 text-xs text-text-muted",
        compact ? "mt-3 text-[11px] @max-[15rem]:flex-col @max-[15rem]:items-start" : "mt-4",
      )}
    >
      {[
        { label: "Compras", color: BUY },
        { label: "Ventas", color: SELL },
      ].map(({ label, color }) => (
        <span key={label} className={cn("flex items-center gap-1.5", compact && "w-full justify-between @[15rem]:w-auto")}>
          {label}
          <span className={cn("flex", compact ? "gap-0.5" : "gap-1")} aria-hidden>
            {levels.map((l) => (
              <span
                key={l}
                className={cn("rounded-[5px]", compact ? "size-2.5 rounded-[3px] @[15rem]:size-3" : "size-3.5")}
                style={{ background: tone(color, l) }}
              />
            ))}
          </span>
        </span>
      ))}
      {!compact && <span>Más claro = menos dinero</span>}
    </div>
  );
}

function Stat({ label, value, dot }: { label: string; value: string; dot?: string }) {
  return (
    <div className="min-w-0">
      <p className="flex items-center gap-1.5 truncate text-xs text-text-muted">
        {dot && <span className={cn("size-2 shrink-0 rounded-full", dot)} aria-hidden />}
        {label}
      </p>
      <p className="mt-0.5 truncate text-sm font-medium tabular-nums md:text-base">{value}</p>
    </div>
  );
}

function DayDetail({ day, assets }: { day: DayActivity; assets: Map<string, Asset> }) {
  return (
    <Card className="p-4 md:p-5">
      <h3 className="font-medium first-letter:uppercase">{formatDate(day.date)}</h3>
      <ul className="mt-2">
        {day.transactions.map((t) => {
          const asset = t.assetId ? assets.get(t.assetId) : undefined;
          return (
            <li key={t.id} className="flex items-center gap-3 py-2">
              {asset && <AssetAvatar asset={asset} className="size-9" />}
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-medium">{asset?.name ?? "Activo"}</span>
                <span className="block truncate text-xs text-text-muted tabular-nums">
                  {TRANSACTION_TYPE_LABELS[t.type]} · {formatQuantity(t.quantity)} × {formatCurrency(t.price)}
                </span>
              </span>
              <span className="shrink-0 text-sm font-medium tabular-nums">
                {t.type === "sell" ? "+" : ""}
                {formatCurrency(transactionTotal(t))}
              </span>
            </li>
          );
        })}
      </ul>
    </Card>
  );
}
