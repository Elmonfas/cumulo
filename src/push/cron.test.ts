import Decimal from "decimal.js";
import { describe, expect, it } from "vitest";
import type { PushDevice, PushMessage } from "@/domain/push";
import { runPushCron } from "./cron";
import type { SendResult } from "./send";
import { memoryPushStore } from "./store";

const device = (overrides: Partial<PushDevice> = {}): PushDevice => ({
  subscription: { endpoint: "https://web.push.apple.com/a", keys: { p256dh: "p", auth: "a" } },
  reminder: null,
  lastReminder: null,
  alerts: [],
  fired: [],
  updatedAt: "2026-10-01T00:00:00Z",
  ...overrides,
});

function setup(result: SendResult = "sent") {
  const store = memoryPushStore();
  const sent: PushMessage[] = [];
  const send = async (_: unknown, message: PushMessage) => {
    sent.push(message);
    return result;
  };
  const quote = async () => new Map([["coingecko:bitcoin", new Decimal("81000")]]);
  return { store, sent, run: (now: string) => runPushCron({ store, send, quote, now: new Date(now) }) };
}

describe("runPushCron", () => {
  it("envía el recordatorio una sola vez al mes", async () => {
    const { store, sent, run } = setup();
    await store.put("d1", device({ reminder: { day: 1, hour: 9, timeZone: "Europe/Madrid" } }));
    await run("2026-11-01T08:15:00Z");
    await run("2026-11-01T08:30:00Z");
    expect(sent.map((m) => m.tag)).toEqual(["import-reminder"]);
    expect((await store.get("d1"))?.lastReminder).toBe("2026-11");
  });

  it("dispara la alerta una vez, la quita y la apunta como disparada", async () => {
    const { store, sent, run } = setup();
    const alerts = [
      { id: "a1", key: "coingecko:bitcoin", name: "Bitcoin", direction: "above" as const, price: "80000" },
      { id: "a2", key: "coingecko:bitcoin", name: "Bitcoin", direction: "above" as const, price: "90000" },
    ];
    await store.put("d1", device({ alerts }));
    await run("2026-10-20T10:00:00Z");
    await run("2026-10-20T10:15:00Z");
    expect(sent).toHaveLength(1);
    expect(sent[0]).toMatchObject({ title: "cúmulo", body: "Bitcoin ha subido de 80.000,00\u00a0€" });
    const saved = await store.get("d1");
    expect(saved?.alerts.map((a) => a.id)).toEqual(["a2"]);
    expect(saved?.fired).toEqual([{ id: "a1", price: "81000", at: "2026-10-20T10:00:00.000Z" }]);
  });

  it("olvida el dispositivo si el servicio de push dice que ya no existe", async () => {
    const { store, run } = setup("gone");
    await store.put("d1", device({ reminder: { day: 1, hour: 0, timeZone: "UTC" } }));
    const summary = await run("2026-10-20T10:00:00Z");
    expect(summary.removed).toBe(1);
    expect(await store.get("d1")).toBeNull();
  });
});
