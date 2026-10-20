import { NextResponse } from "next/server";
import { badRequest, noStore, readJson } from "@/push/http";
import { getPushStore } from "@/push/redis-store";
import { sendPush } from "@/push/send";
import { deviceId } from "@/push/store";

const COOLDOWN_MS = 30_000;

/** POST /api/push/test { endpoint }: notificación de prueba (una cada 30 s como mucho). */
export async function POST(request: Request) {
  const body = await readJson(request);
  const endpoint = typeof body === "object" && body !== null ? (body as Record<string, unknown>).endpoint : undefined;
  if (typeof endpoint !== "string" || endpoint.length > 1024) return badRequest("Falta el endpoint.");
  const store = getPushStore();
  const id = await deviceId(endpoint);
  const device = await store.get(id);
  if (!device) return NextResponse.json({ error: "Este dispositivo no está suscrito." }, { status: 404, headers: noStore });

  const now = new Date();
  if (device.lastTestAt && now.getTime() - Date.parse(device.lastTestAt) < COOLDOWN_MS) {
    return NextResponse.json({ error: "Espera unos segundos antes de probar otra vez." }, { status: 429, headers: noStore });
  }
  const result = await sendPush(device.subscription, {
    title: "cúmulo",
    body: "Las notificaciones funcionan. Te avisaremos aunque la app esté cerrada.",
    url: "/ajustes",
    tag: "test",
  });
  if (result === "gone") {
    await store.remove(id);
    return NextResponse.json({ error: "La suscripción ha caducado. Vuelve a activarlas." }, { status: 410, headers: noStore });
  }
  await store.put(id, { ...device, lastTestAt: now.toISOString() });
  if (result === "failed") return NextResponse.json({ error: "No se pudo enviar la prueba." }, { status: 502, headers: noStore });
  return new NextResponse(null, { status: 204, headers: noStore });
}
