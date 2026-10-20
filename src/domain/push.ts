import Decimal from "decimal.js";
import type { DecimalString, IsoDateString, PriceAlert } from "./models";

/**
 * Notificaciones push: lo único que cúmulo guarda en un servidor. Por diseño,
 * nunca hay cantidades ni operaciones: solo la suscripción del dispositivo, el
 * horario del recordatorio y, si el usuario lo activa, las alertas de precio
 * (activo, condición y precio).
 */

export interface PushSubscriptionData {
  endpoint: string;
  keys: { p256dh: string; auth: string };
}

/** Recordatorio mensual: día (1–28), hora local y zona horaria IANA. */
export interface Reminder {
  day: number;
  hour: number;
  timeZone: string;
}

/** Alerta tal como la ve el servidor. */
export interface RemoteAlert {
  id: string;
  /** "yahoo:VWCE.DE" · "coingecko:bitcoin" */
  key: string;
  name: string;
  direction: PriceAlert["direction"];
  price: DecimalString;
}

/** Alerta que el servidor ya ha disparado y el navegador aún no sabe. */
export interface FiredAlert {
  id: string;
  price: DecimalString;
  at: IsoDateString;
}

export interface PushDevice {
  subscription: PushSubscriptionData;
  reminder: Reminder | null;
  /** Mes ("2026-10") del último recordatorio enviado. */
  lastReminder: string | null;
  alerts: RemoteAlert[];
  fired: FiredAlert[];
  lastTestAt?: IsoDateString;
  updatedAt: IsoDateString;
}

export interface PushMessage {
  title: string;
  body: string;
  /** Pantalla que se abre al tocarla. */
  url: string;
  tag: string;
}

export const MAX_REMOTE_ALERTS = 50;
export const FIRED_RETENTION_DAYS = 30;

/** Servicios de push de los navegadores. Cualquier otro destino se rechaza. */
const PUSH_HOSTS = [
  /^web\.push\.apple\.com$/,
  /^fcm\.googleapis\.com$/,
  /^updates\.push\.services\.mozilla\.com$/,
  /^[a-z0-9-]+\.notify\.windows\.com$/,
];

const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === "object" && value !== null;
const isShortString = (value: unknown, max: number): value is string => typeof value === "string" && value.length > 0 && value.length <= max;

export function parseSubscription(value: unknown): PushSubscriptionData | null {
  if (!isRecord(value) || !isShortString(value.endpoint, 1024) || !isRecord(value.keys)) return null;
  const { p256dh, auth } = value.keys;
  if (!isShortString(p256dh, 256) || !isShortString(auth, 64)) return null;
  let url: URL;
  try {
    url = new URL(value.endpoint);
  } catch {
    return null;
  }
  if (url.protocol !== "https:" || !PUSH_HOSTS.some((host) => host.test(url.hostname))) return null;
  return { endpoint: value.endpoint, keys: { p256dh, auth } };
}

export function isValidTimeZone(timeZone: string): boolean {
  try {
    new Intl.DateTimeFormat("es-ES", { timeZone });
    return true;
  } catch {
    return false;
  }
}

export function parseReminder(value: unknown): Reminder | null {
  if (!isRecord(value)) return null;
  const { day, hour, timeZone } = value;
  if (!Number.isInteger(day) || (day as number) < 1 || (day as number) > 28) return null;
  if (!Number.isInteger(hour) || (hour as number) < 0 || (hour as number) > 23) return null;
  if (!isShortString(timeZone, 64) || !isValidTimeZone(timeZone)) return null;
  return { day: day as number, hour: hour as number, timeZone };
}

/** Lista de alertas recibida del navegador; null si algo no cuadra. */
export function parseRemoteAlerts(value: unknown): RemoteAlert[] | null {
  if (!Array.isArray(value) || value.length > MAX_REMOTE_ALERTS) return null;
  const alerts: RemoteAlert[] = [];
  for (const item of value) {
    if (!isRecord(item)) return null;
    const { id, key, name, direction, price } = item;
    if (!isShortString(id, 64) || !isShortString(name, 80)) return null;
    if (typeof key !== "string" || !/^(yahoo|coingecko):[A-Za-z0-9.\-=^_]{1,40}$/.test(key)) return null;
    if (direction !== "above" && direction !== "below") return null;
    if (typeof price !== "string" || !/^\d{1,12}(\.\d{1,12})?$/.test(price) || !new Decimal(price).gt(0)) return null;
    alerts.push({ id, key, name, direction, price });
  }
  return alerts;
}

/** Fecha y hora locales de `now` en una zona horaria. */
export function localParts(now: Date, timeZone: string) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    hourCycle: "h23",
  }).formatToParts(now);
  const get = (type: string) => Number(parts.find((p) => p.type === type)?.value);
  return { year: get("year"), month: get("month"), day: get("day"), hour: get("hour") };
}

const monthKey = ({ year, month }: { year: number; month: number }) => `${year}-${String(month).padStart(2, "0")}`;

const reachedSlot = (reminder: Reminder, local: ReturnType<typeof localParts>) =>
  local.day > reminder.day || (local.day === reminder.day && local.hour >= reminder.hour);

/**
 * ¿Toca enviar el recordatorio? Una vez al mes, en cuanto se alcanza su día y
 * hora locales. Si el envío se retrasa (el programador no es exacto), sale en
 * la siguiente pasada del mismo mes.
 */
export function reminderDue(reminder: Reminder, lastReminder: string | null, now: Date): boolean {
  const local = localParts(now, reminder.timeZone);
  return lastReminder !== monthKey(local) && reachedSlot(reminder, local);
}

/** Mes que se marca como «ya avisado» al guardar un recordatorio: si su hora de este mes ya pasó, empieza el mes que viene. */
export function initialLastReminder(reminder: Reminder, now: Date): string | null {
  const local = localParts(now, reminder.timeZone);
  return reachedSlot(reminder, local) ? monthKey(local) : null;
}

export const reminderMonth = (reminder: Reminder, now: Date) => monthKey(localParts(now, reminder.timeZone));

/**
 * Sustituye las alertas del dispositivo por las que manda el navegador, sin
 * resucitar las que el servidor ya disparó, y olvida los disparos viejos.
 */
export function syncAlerts(device: Pick<PushDevice, "fired">, incoming: RemoteAlert[], now: Date): Pick<PushDevice, "alerts" | "fired"> {
  const cutoff = now.getTime() - FIRED_RETENTION_DAYS * 86_400_000;
  const fired = device.fired.filter((f) => Date.parse(f.at) >= cutoff);
  const firedIds = new Set(fired.map((f) => f.id));
  return { alerts: incoming.filter((a) => !firedIds.has(a.id)), fired };
}

/** Separa las alertas que se cumplen con estos precios (en EUR) de las que siguen activas. */
export function evaluateRemoteAlerts(alerts: RemoteAlert[], prices: ReadonlyMap<string, Decimal>) {
  const due: { alert: RemoteAlert; price: Decimal }[] = [];
  const remaining: RemoteAlert[] = [];
  for (const alert of alerts) {
    const price = prices.get(alert.key);
    const met = price && (alert.direction === "above" ? price.gte(alert.price) : price.lte(alert.price));
    if (met) due.push({ alert, price });
    else remaining.push(alert);
  }
  return { due, remaining };
}

export const REMINDER_MESSAGE: PushMessage = {
  title: "Toca importar el CSV de tu bróker",
  body: "",
  url: "/operaciones/importar",
  tag: "import-reminder",
};
