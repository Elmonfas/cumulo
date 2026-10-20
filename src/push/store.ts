import type { PushDevice } from "@/domain/push";

/** Dónde viven los dispositivos suscritos. Hoy, Upstash Redis; en tests y en local sin claves, memoria. */
export interface PushStore {
  get(id: string): Promise<PushDevice | null>;
  put(id: string, device: PushDevice): Promise<void>;
  remove(id: string): Promise<void>;
  list(): Promise<{ id: string; device: PushDevice }[]>;
}

export function memoryPushStore(): PushStore {
  const devices = new Map<string, PushDevice>();
  return {
    get: async (id) => structuredClone(devices.get(id) ?? null),
    put: async (id, device) => void devices.set(id, structuredClone(device)),
    remove: async (id) => void devices.delete(id),
    list: async () => [...devices].map(([id, device]) => ({ id, device: structuredClone(device) })),
  };
}

/** Identificador estable del dispositivo: hash del endpoint (que ya es un secreto). */
export async function deviceId(endpoint: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(endpoint));
  return Buffer.from(digest).toString("hex");
}
