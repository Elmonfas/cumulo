"use client";

import { Bell, Check, Download, Target, X, type LucideIcon } from "lucide-react";
import Link from "next/link";
import { useState, useSyncExternalStore } from "react";
import { Card } from "@/components/ui/card";
import { getRepositories, type Repositories } from "@/data/repositories";
import { useLiveQuery } from "@/hooks/use-live-query";
import { lastBackupAt, saveBackupCopy } from "@/lib/backup-file";
import { isDemo } from "@/lib/demo";
import { readPushPrefs } from "@/lib/push";
import { cn } from "@/lib/utils";

const DISMISSED_KEY = "cumulo:first-steps-dismissed";
const noopSubscribe = () => () => {};
const listGoals = (repositories: Repositories) => repositories.goals.list();

interface LocalState {
  dismissed: boolean;
  backup: boolean;
  push: boolean;
}

// Instantánea estable: useSyncExternalStore exige el mismo objeto si nada cambia.
let cached: { key: string; value: LocalState } | null = null;
function readLocal(): LocalState {
  let dismissed = false;
  try {
    dismissed = localStorage.getItem(DISMISSED_KEY) === "1";
  } catch {}
  const value = { dismissed: dismissed || isDemo(), backup: Boolean(lastBackupAt()), push: readPushPrefs().enabled };
  const key = JSON.stringify(value);
  if (cached?.key !== key) cached = { key, value };
  return cached.value;
}
const SERVER_STATE: LocalState = { dismissed: true, backup: false, push: false };

/** Primeros pasos tras tener datos: copia, avisos y un objetivo. Desaparece al completarlos o cerrarla. */
export function FirstSteps({ className }: { className?: string }) {
  const local = useSyncExternalStore(noopSubscribe, readLocal, () => SERVER_STATE);
  const goals = useLiveQuery(listGoals);
  const [closed, setClosed] = useState(false);
  const [backedUp, setBackedUp] = useState(false);

  const steps = [
    { id: "backup", done: local.backup || backedUp, icon: Download, title: "Guarda una copia", hint: "En Archivos o iCloud Drive, por si cambias de móvil." },
    { id: "push", done: local.push, icon: Bell, title: "Activa los avisos", hint: "Recordatorio para importar y alertas de precio.", href: "/ajustes" },
    { id: "goal", done: goals.status === "ready" && goals.data.length > 0, icon: Target, title: "Ponte un objetivo", hint: "Cuánto quieres tener y para cuándo.", href: "/herramientas/objetivos" },
  ];
  const pending = steps.filter((s) => !s.done).length;
  if (local.dismissed || closed || goals.status !== "ready" || pending === 0) return null;

  function dismiss() {
    try {
      localStorage.setItem(DISMISSED_KEY, "1");
    } catch {}
    setClosed(true);
  }

  return (
    <Card className={cn("relative grid grid-cols-[minmax(0,1fr)] gap-3", className)} aria-labelledby="first-steps-title">
      <button
        type="button"
        onClick={dismiss}
        aria-label="Cerrar primeros pasos"
        className="absolute top-3 right-3 flex size-9 items-center justify-center rounded-full text-text-muted outline-none hover:bg-surface-2 hover:text-text focus-visible:ring-3 focus-visible:ring-accent/40"
      >
        <X className="size-4" aria-hidden />
      </button>
      <div className="pr-10">
        <h2 id="first-steps-title" className="font-medium">
          Primeros pasos
        </h2>
        <p className="mt-1 text-sm text-text-muted tabular-nums">
          {steps.length - pending} de {steps.length} hechos
        </p>
      </div>
      <ul className="grid gap-1">
        {steps.map((step) => (
          <li key={step.id}>
            <StepRow
              {...step}
              onAction={step.id === "backup" ? async () => setBackedUp(await saveBackupCopy(getRepositories())) : undefined}
            />
          </li>
        ))}
      </ul>
    </Card>
  );
}

function StepRow({
  id: _id,
  done,
  icon: Icon,
  title,
  hint,
  href,
  onAction,
}: {
  id: string;
  done: boolean;
  icon: LucideIcon;
  title: string;
  hint: string;
  href?: string;
  onAction?: () => void;
}) {
  const body = (
    <>
      <span
        className={cn(
          "flex size-9 shrink-0 items-center justify-center rounded-full",
          done ? "bg-accent text-accent-foreground" : "bg-accent/15 text-accent",
        )}
      >
        {done ? <Check className="size-4" aria-hidden /> : <Icon className="size-4" aria-hidden />}
      </span>
      <span className="min-w-0 flex-1 text-left">
        <span className={cn("block text-sm font-medium", done && "text-text-muted line-through")}>{title}</span>
        {!done && <span className="block text-xs text-pretty text-text-muted">{hint}</span>}
      </span>
    </>
  );
  const rowClass =
    "flex w-full items-center gap-3 rounded-2xl px-2 py-2 transition-colors duration-150 ease-out outline-none hover:bg-surface-2 focus-visible:ring-3 focus-visible:ring-accent/40";
  if (done) return <div className="flex items-center gap-3 px-2 py-2">{body}</div>;
  if (href)
    return (
      <Link href={href} className={rowClass}>
        {body}
      </Link>
    );
  return (
    <button type="button" onClick={onAction} className={rowClass}>
      {body}
    </button>
  );
}
