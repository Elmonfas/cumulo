import "server-only";
import { Redis } from "@upstash/redis";
import type { PushDevice } from "@/domain/push";
import { memoryPushStore, type PushStore } from "./store";

const INDEX = "push:devices";
const key = (id: string) => `push:device:${id}`;

function redisPushStore(redis: Redis): PushStore {
  return {
    get: (id) => redis.get<PushDevice>(key(id)),
    async put(id, device) {
      await redis.pipeline().set(key(id), device).sadd(INDEX, id).exec();
    },
    async remove(id) {
      await redis.pipeline().del(key(id)).srem(INDEX, id).exec();
    },
    async list() {
      const ids = await redis.smembers(INDEX);
      const result: { id: string; device: PushDevice }[] = [];
      for (let i = 0; i < ids.length; i += 100) {
        const chunk = ids.slice(i, i + 100);
        const devices = await redis.mget<(PushDevice | null)[]>(...chunk.map(key));
        chunk.forEach((id, j) => {
          const device = devices[j];
          if (device) result.push({ id, device });
        });
      }
      return result;
    },
  };
}

let store: PushStore | undefined;

/** Upstash si hay claves (Vercel las inyecta como KV_*); si no, memoria, solo para desarrollo. */
export function getPushStore(): PushStore {
  if (store) return store;
  const url = process.env.KV_REST_API_URL;
  const token = process.env.KV_REST_API_TOKEN;
  if (url && token) store = redisPushStore(new Redis({ url, token }));
  else if (process.env.NODE_ENV !== "production") store = memoryPushStore();
  else throw new Error("Faltan KV_REST_API_URL y KV_REST_API_TOKEN.");
  return store;
}
