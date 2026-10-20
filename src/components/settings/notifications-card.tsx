"use client";

import { Bell, BellOff, Share } from "lucide-react";
import { useEffect, useState, useSyncExternalStore } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { getRepositories } from "@/data/repositories";
import type { Reminder } from "@/domain/push";
import {
  currentSubscription,
  DEFAULT_REMINDER_DAY,
  DEFAULT_REMINDER_HOUR,
  disablePush,
  enablePush,
  localTimeZone,
  pushSupport,
  readPushPrefs,
  sendTestPush,
  updatePush,
  type PushPrefs,
} from "@/lib/push";
import { cn } from "@/lib/utils";

const noopSubscribe = () => () => {};
const DAYS = Array.from({ length: 28 }, (_, i) => i + 1);
const HOURS = Array.from({ length: 24 }, (_, i) => i);

const defaultReminder = (): Reminder => ({ day: DEFAULT_REMINDER_DAY, hour: DEFAULT_REMINDER_HOUR, timeZone: localTimeZone() });

type Feedback = { tone: "ok" | "error"; text: string } | null;

/** Notificaciones push: recordatorio mensual y alertas de precio con la app cerrada. */
export function NotificationsCard() {
  const support = useSyncExternalStore(noopSubscribe, pushSupport, () => null);
  const [prefs, setPrefs] = useState<PushPrefs | null>(null);
  const [busy, setBusy] = useState(false);
  const [feedback, setFeedback] = useState<Feedback>(null);

  useEffect(() => {
    let cancelled = false;
    currentSubscription().then((subscription) => {
      if (cancelled) return;
      const saved = readPushPrefs();
      // Si el sistema retiró el permiso o la suscripción caducó, toca reactivar.
      setPrefs(subscription && saved.enabled ? saved : { ...saved, enabled: false });
    });
    return () => {
      cancelled = true;
    };
  }, []);

  async function run(action: () => Promise<PushPrefs | void>, ok?: string) {
    setBusy(true);
    setFeedback(null);
    try {
      const next = await action();
      if (next) setPrefs(next);
      if (ok) setFeedback({ tone: "ok", text: ok });
    } catch (error) {
      setFeedback({ tone: "error", text: error instanceof Error ? error.message : "Algo ha fallado." });
    } finally {
      setBusy(false);
    }
  }

  const save = (next: PushPrefs) => run(() => updatePush(getRepositories(), next));
  const denied = typeof Notification !== "undefined" && Notification.permission === "denied";

  return (
    <Card className="grid gap-4">
      <div className="flex items-start gap-3">
        <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-accent/15 text-accent">
          {support === "unsupported" ? <BellOff className="size-5" aria-hidden /> : <Bell className="size-5" aria-hidden />}
        </span>
        <div>
          <h2 className="font-medium">Notificaciones</h2>
          <p className="mt-1 text-sm text-pretty text-text-muted">
            Te avisamos aunque cúmulo esté cerrada: un recordatorio para importar tu CSV y tus alertas de precio.
          </p>
        </div>
      </div>

      {support === "needs-install" && <InstallSteps />}

      {support === "unsupported" && (
        <p className="text-sm text-text-muted">Este navegador no admite notificaciones push. En iPhone, usa iOS 16.4 o posterior.</p>
      )}

      {support === "ready" && prefs && !prefs.enabled && (
        <div className="grid gap-2">
          {denied ? (
            <p className="text-sm text-pretty text-text-muted">
              Las bloqueaste antes. Actívalas en los ajustes del sistema (en iPhone: Ajustes › Notificaciones › cúmulo) y vuelve
              aquí.
            </p>
          ) : (
            <Button
              disabled={busy}
              onClick={() =>
                run(
                  () => enablePush(getRepositories(), { reminder: defaultReminder(), alerts: true }),
                  "Listo. Te hemos dejado activado el recordatorio y las alertas; ajústalos abajo.",
                )
              }
            >
              <Bell aria-hidden />
              Activar notificaciones
            </Button>
          )}
        </div>
      )}

      {support === "ready" && prefs?.enabled && (
        <div className="grid gap-4">
          <div className="grid gap-3">
            <Switch
              label="Recordatorio para importar"
              description="Una vez al mes, para que exportes el CSV de tu bróker y lo subas."
              checked={prefs.reminder !== null}
              onCheckedChange={(on) => save({ ...prefs, reminder: on ? defaultReminder() : null })}
            />
            {prefs.reminder && (
              <div className="grid grid-cols-2 gap-2">
                <SelectField
                  label="Día del mes"
                  value={prefs.reminder.day}
                  options={DAYS.map((d) => [d, `Día ${d}`])}
                  disabled={busy}
                  onChange={(day) => save({ ...prefs, reminder: { ...prefs.reminder!, day, timeZone: localTimeZone() } })}
                />
                <SelectField
                  label="Hora"
                  value={prefs.reminder.hour}
                  options={HOURS.map((h) => [h, `${String(h).padStart(2, "0")}:00`])}
                  disabled={busy}
                  onChange={(hour) => save({ ...prefs, reminder: { ...prefs.reminder!, hour, timeZone: localTimeZone() } })}
                />
              </div>
            )}
          </div>
          <Switch
            label="Alertas de precio con la app cerrada"
            description="Para vigilarlas, el servidor conoce el activo, la condición y el precio de cada alerta. Nunca tus cantidades. Se comprueban cada 15 minutos."
            checked={prefs.alerts}
            onCheckedChange={(alerts) => save({ ...prefs, alerts })}
          />
          <div className="flex flex-wrap gap-2">
            <Button variant="secondary" size="sm" disabled={busy} onClick={() => run(sendTestPush, "Enviada. Debería llegarte en unos segundos.")}>
              Enviar prueba
            </Button>
            <Button variant="ghost" size="sm" disabled={busy} onClick={() => run(disablePush, "Desactivadas. Hemos borrado este dispositivo del servidor.")}>
              Desactivar en este dispositivo
            </Button>
          </div>
        </div>
      )}

      {feedback && (
        <p role="status" className={cn("text-sm", feedback.tone === "error" ? "text-negative" : "text-text-muted")}>
          {feedback.text}
        </p>
      )}
    </Card>
  );
}

function InstallSteps() {
  return (
    <div className="grid gap-2 rounded-2xl bg-surface-2 p-4 text-sm">
      <p className="font-medium">En iPhone, primero instala cúmulo:</p>
      <ol className="grid list-decimal gap-1 pl-5 text-text-muted">
        <li>
          Abre esta página en Safari y toca <Share className="inline size-4 align-text-bottom" aria-label="Compartir" />.
        </li>
        <li>Elige «Añadir a pantalla de inicio».</li>
        <li>Abre cúmulo desde el icono y vuelve a Ajustes.</li>
      </ol>
    </div>
  );
}

function SelectField({
  label,
  value,
  options,
  disabled,
  onChange,
}: {
  label: string;
  value: number;
  options: [number, string][];
  disabled?: boolean;
  onChange: (value: number) => void;
}) {
  return (
    <label className="grid gap-1 text-xs text-text-muted">
      {label}
      <select
        value={value}
        disabled={disabled}
        onChange={(e) => onChange(Number(e.target.value))}
        className="h-10 rounded-xl border border-border bg-surface-2 px-3 text-sm text-text tabular-nums outline-none focus-visible:ring-3 focus-visible:ring-accent/40"
      >
        {options.map(([v, text]) => (
          <option key={v} value={v}>
            {text}
          </option>
        ))}
      </select>
    </label>
  );
}
