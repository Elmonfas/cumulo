import type Decimal from "decimal.js";
import {
  evaluateRemoteAlerts,
  REMINDER_MESSAGE,
  reminderDue,
  reminderMonth,
  type PushDevice,
  type PushMessage,
} from "@/domain/push";
import { alertMessage } from "@/services/alerts";
import type { SendPush } from "./send";
import type { PushStore } from "./store";

export interface CronDeps {
  store: PushStore;
  /** Precios en EUR por clave ("yahoo:VWCE.DE"). Las que falten se reintentan en la siguiente pasada. */
  quote: (keys: string[]) => Promise<Map<string, Decimal>>;
  send: SendPush;
  now: Date;
}

export interface CronSummary {
  devices: number;
  reminders: number;
  alerts: number;
  removed: number;
}

/** Una pasada del programador: recordatorios del mes y alertas de precio. */
export async function runPushCron({ store, quote, send, now }: CronDeps): Promise<CronSummary> {
  const devices = await store.list();
  const keys = [...new Set(devices.flatMap(({ device }) => device.alerts.map((a) => a.key)))];
  const prices = keys.length > 0 ? await quote(keys) : new Map<string, Decimal>();
  const summary: CronSummary = { devices: devices.length, reminders: 0, alerts: 0, removed: 0 };

  for (const { id, device } of devices) {
    const next: PushDevice = { ...device };
    const outbox: { message: PushMessage; kind: "reminder" | "alert" }[] = [];

    if (device.reminder && reminderDue(device.reminder, device.lastReminder, now)) {
      next.lastReminder = reminderMonth(device.reminder, now);
      outbox.push({ message: REMINDER_MESSAGE, kind: "reminder" });
    }

    const { due, remaining } = evaluateRemoteAlerts(device.alerts, prices);
    if (due.length > 0) {
      next.alerts = remaining;
      next.fired = [...device.fired, ...due.map(({ alert, price }) => ({ id: alert.id, price: price.toString(), at: now.toISOString() }))];
      for (const { alert, price } of due) {
        const { title, body } = alertMessage(alert, alert.name, price);
        outbox.push({ message: { title, body, url: "/cartera", tag: `alert-${alert.id}` }, kind: "alert" });
      }
    }

    if (outbox.length === 0) continue;
    let gone = false;
    for (const { message, kind } of outbox) {
      const result = await send(device.subscription, message);
      if (result === "gone") {
        gone = true;
        break;
      }
      if (result === "sent") summary[kind === "reminder" ? "reminders" : "alerts"]++;
    }
    if (gone) {
      await store.remove(id);
      summary.removed++;
    } else {
      await store.put(id, next);
    }
  }
  return summary;
}
