import { NextResponse } from "next/server";
import { initialLastReminder, parseReminder, parseRemoteAlerts, parseSubscription, syncAlerts, type PushDevice } from "@/domain/push";
import { badRequest, noStore, readJson } from "@/push/http";
import { getPushStore } from "@/push/redis-store";
import { deviceId } from "@/push/store";

/**
 * PUT /api/push/device { subscription, reminder, alerts }
 * Guarda o actualiza este dispositivo y devuelve las alertas que el servidor
 * ya disparó, para que el navegador las marque. Nunca recibe cantidades.
 */
export async function PUT(request: Request) {
  const body = await readJson(request);
  if (typeof body !== "object" || body === null) return badRequest("Cuerpo no válido.");
  const { subscription: rawSubscription, reminder: rawReminder, alerts: rawAlerts } = body as Record<string, unknown>;
  const subscription = parseSubscription(rawSubscription);
  if (!subscription) return badRequest("Suscripción no válida.");
  const reminder = rawReminder === null ? null : parseReminder(rawReminder);
  if (rawReminder !== null && !reminder) return badRequest("Recordatorio no válido.");
  const alerts = parseRemoteAlerts(rawAlerts ?? []);
  if (!alerts) return badRequest("Alertas no válidas.");

  const now = new Date();
  const store = getPushStore();
  const id = await deviceId(subscription.endpoint);
  const previous = await store.get(id);
  const sameReminder =
    previous?.reminder && reminder && JSON.stringify(previous.reminder) === JSON.stringify(reminder);
  const device: PushDevice = {
    subscription,
    reminder,
    lastReminder: reminder ? (sameReminder ? previous.lastReminder : initialLastReminder(reminder, now)) : null,
    ...syncAlerts({ fired: previous?.fired ?? [] }, alerts, now),
    lastTestAt: previous?.lastTestAt,
    updatedAt: now.toISOString(),
  };
  await store.put(id, device);
  return NextResponse.json({ fired: device.fired }, { headers: noStore });
}

/** DELETE /api/push/device { endpoint }: borra todo lo guardado de este dispositivo. */
export async function DELETE(request: Request) {
  const body = await readJson(request);
  const endpoint = typeof body === "object" && body !== null ? (body as Record<string, unknown>).endpoint : undefined;
  if (typeof endpoint !== "string" || endpoint.length > 1024) return badRequest("Falta el endpoint.");
  await getPushStore().remove(await deviceId(endpoint));
  return new NextResponse(null, { status: 204, headers: noStore });
}
