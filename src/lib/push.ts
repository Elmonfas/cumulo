import type { Repositories } from "@/data/repositories";
import type { FiredAlert, Reminder, RemoteAlert } from "@/domain/push";
import { VAPID_PUBLIC_KEY } from "@/push/config";

/**
 * Notificaciones push reales (con la app cerrada). Lo que sale del navegador:
 * la suscripción del dispositivo, el horario del recordatorio y, solo si se
 * activa, las alertas de precio (activo, condición y precio). Nunca cantidades.
 */

export interface PushPrefs {
  enabled: boolean;
  reminder: Reminder | null;
  /** Mandar las alertas de precio al servidor para recibirlas con la app cerrada. */
  alerts: boolean;
}

export type PushSupport = "ready" | "needs-install" | "unsupported";

const PREFS_KEY = "cumulo:push";
export const DEFAULT_REMINDER_DAY = 1;
export const DEFAULT_REMINDER_HOUR = 9;

const defaultPrefs = (): PushPrefs => ({ enabled: false, reminder: null, alerts: false });

export function readPushPrefs(): PushPrefs {
  try {
    const raw = localStorage.getItem(PREFS_KEY);
    return raw ? { ...defaultPrefs(), ...(JSON.parse(raw) as Partial<PushPrefs>) } : defaultPrefs();
  } catch {
    return defaultPrefs();
  }
}

function writePushPrefs(prefs: PushPrefs) {
  try {
    localStorage.setItem(PREFS_KEY, JSON.stringify(prefs));
  } catch {
    // Sin almacenamiento: las preferencias duran lo que la pestaña.
  }
}

export const isIos = () =>
  /iPhone|iPad|iPod/.test(navigator.userAgent) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);

export const isStandalone = () =>
  window.matchMedia("(display-mode: standalone)").matches || (navigator as Navigator & { standalone?: boolean }).standalone === true;

/** En iPhone, el push solo existe en la app añadida a la pantalla de inicio (iOS 16.4+). */
export function pushSupport(): PushSupport {
  if (typeof window === "undefined") return "unsupported";
  const apis = "serviceWorker" in navigator && "PushManager" in window && "Notification" in window;
  if (isIos() && !isStandalone()) return "needs-install";
  return apis ? "ready" : "unsupported";
}

async function registration(): Promise<ServiceWorkerRegistration | null> {
  if (!("serviceWorker" in navigator)) return null;
  return (await navigator.serviceWorker.getRegistration()) ?? null;
}

export async function currentSubscription(): Promise<PushSubscription | null> {
  try {
    return (await (await registration())?.pushManager.getSubscription()) ?? null;
  } catch {
    return null;
  }
}

function applicationServerKey(): Uint8Array<ArrayBuffer> {
  const base64 = VAPID_PUBLIC_KEY.replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(base64 + "=".repeat((4 - (base64.length % 4)) % 4));
  return Uint8Array.from(raw, (c) => c.charCodeAt(0));
}

/** Alertas activas con precio de API, tal como las verá el servidor. */
async function remoteAlerts(repositories: Repositories): Promise<RemoteAlert[]> {
  const [alerts, assets] = await Promise.all([repositories.alerts.list(), repositories.assets.list()]);
  const byId = new Map(assets.map((a) => [a.id, a]));
  return alerts.flatMap((alert) => {
    const asset = byId.get(alert.assetId);
    if (alert.triggeredAt || !asset || asset.priceSource === "manual") return [];
    return [{ id: alert.id, key: `${asset.priceSource}:${asset.priceSourceId}`, name: asset.name.slice(0, 80), direction: alert.direction, price: alert.price }];
  });
}

async function request(path: string, method: string, body: unknown) {
  const response = await fetch(path, { method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
  if (!response.ok) {
    const error = (await response.json().catch(() => null)) as { error?: string } | null;
    throw new Error(error?.error ?? "No se pudo contactar con el servidor de notificaciones.");
  }
  return response.status === 204 ? null : response.json();
}

/**
 * Manda al servidor el estado de este dispositivo y marca como cumplidas las
 * alertas que él ya disparó con la app cerrada.
 */
export async function syncPush(repositories: Repositories, prefs = readPushPrefs()): Promise<void> {
  if (!prefs.enabled) return;
  const subscription = await currentSubscription();
  if (!subscription) return;
  const alerts = prefs.alerts ? await remoteAlerts(repositories) : [];
  const { fired } = (await request("/api/push/device", "PUT", {
    subscription: subscription.toJSON(),
    reminder: prefs.reminder,
    alerts,
  })) as { fired: FiredAlert[] };
  const active = new Set((await repositories.alerts.list()).filter((a) => !a.triggeredAt).map((a) => a.id));
  for (const f of fired) if (active.has(f.id)) await repositories.alerts.markTriggered(f.id, f.price, f.at);
}

/** Pide permiso (debe venir de un toque del usuario), suscribe y guarda en el servidor. */
export async function enablePush(repositories: Repositories, prefs: Omit<PushPrefs, "enabled">): Promise<PushPrefs> {
  const permission = await Notification.requestPermission();
  if (permission !== "granted") throw new Error("Sin permiso no podemos avisarte. Puedes darlo en los ajustes del sistema.");
  const reg = await registration();
  if (!reg) throw new Error("La app aún se está instalando. Ciérrala, vuelve a abrirla y prueba otra vez.");
  const existing = await reg.pushManager.getSubscription();
  if (!existing) await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: applicationServerKey() });
  const next = { ...prefs, enabled: true };
  await syncPush(repositories, next);
  writePushPrefs(next);
  return next;
}

export async function updatePush(repositories: Repositories, prefs: PushPrefs): Promise<PushPrefs> {
  await syncPush(repositories, prefs);
  writePushPrefs(prefs);
  return prefs;
}

/** Borra la suscripción aquí y en el servidor. */
export async function disablePush(): Promise<PushPrefs> {
  const subscription = await currentSubscription();
  if (subscription) {
    await request("/api/push/device", "DELETE", { endpoint: subscription.endpoint }).catch(() => undefined);
    await subscription.unsubscribe().catch(() => undefined);
  }
  const next = defaultPrefs();
  writePushPrefs(next);
  return next;
}

export async function sendTestPush(): Promise<void> {
  const subscription = await currentSubscription();
  if (!subscription) throw new Error("Este dispositivo no está suscrito.");
  await request("/api/push/test", "POST", { endpoint: subscription.endpoint });
}

export const localTimeZone = () => Intl.DateTimeFormat().resolvedOptions().timeZone || "Europe/Madrid";
