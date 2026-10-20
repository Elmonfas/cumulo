import Decimal from "decimal.js";
import { describe, expect, it } from "vitest";
import {
  evaluateRemoteAlerts,
  initialLastReminder,
  parseRemoteAlerts,
  parseReminder,
  parseSubscription,
  reminderDue,
  syncAlerts,
  type RemoteAlert,
} from "./push";

const madrid = { day: 1, hour: 9, timeZone: "Europe/Madrid" };

describe("reminderDue", () => {
  it("no salta antes de la hora local (8:59 en Madrid = 6:59 UTC en verano)", () => {
    expect(reminderDue(madrid, null, new Date("2026-07-01T06:59:00Z"))).toBe(false);
  });
  it("salta a las 9:00 de Madrid, que en verano son las 7:00 UTC", () => {
    expect(reminderDue(madrid, null, new Date("2026-07-01T07:00:00Z"))).toBe(true);
  });
  it("en invierno las 9:00 de Madrid son las 8:00 UTC", () => {
    expect(reminderDue(madrid, null, new Date("2026-12-01T07:30:00Z"))).toBe(false);
    expect(reminderDue(madrid, null, new Date("2026-12-01T08:00:00Z"))).toBe(true);
  });
  it("solo una vez al mes", () => {
    expect(reminderDue(madrid, "2026-07", new Date("2026-07-15T10:00:00Z"))).toBe(false);
    expect(reminderDue(madrid, "2026-07", new Date("2026-08-01T07:00:00Z"))).toBe(true);
  });
  it("si el envío se retrasa, sale más tarde el mismo mes", () => {
    expect(reminderDue(madrid, "2026-06", new Date("2026-07-03T20:00:00Z"))).toBe(true);
  });
  it("usa el mes local: el 1 a las 0:30 en Madrid aún es día 30 en UTC", () => {
    const midnight = { day: 1, hour: 0, timeZone: "Europe/Madrid" };
    expect(reminderDue(midnight, "2026-09", new Date("2026-09-30T22:30:00Z"))).toBe(true);
  });
});

describe("initialLastReminder", () => {
  it("si este mes ya pasó, el primero llega el mes que viene", () => {
    expect(initialLastReminder(madrid, new Date("2026-10-20T10:00:00Z"))).toBe("2026-10");
  });
  it("si aún no ha llegado, deja que salte este mes", () => {
    const day25 = { day: 25, hour: 9, timeZone: "Europe/Madrid" };
    expect(initialLastReminder(day25, new Date("2026-10-20T10:00:00Z"))).toBeNull();
  });
});

describe("validación", () => {
  const keys = { p256dh: "BPkey", auth: "authkey" };
  it("acepta los servicios de push conocidos y rechaza el resto", () => {
    expect(parseSubscription({ endpoint: "https://web.push.apple.com/abc", keys })).not.toBeNull();
    expect(parseSubscription({ endpoint: "https://fcm.googleapis.com/fcm/send/x", keys })).not.toBeNull();
    expect(parseSubscription({ endpoint: "https://evil.example.com/abc", keys })).toBeNull();
    expect(parseSubscription({ endpoint: "http://web.push.apple.com/abc", keys })).toBeNull();
    expect(parseSubscription({ endpoint: "https://web.push.apple.com/abc" })).toBeNull();
  });
  it("recordatorio: día 1–28, hora 0–23 y zona horaria real", () => {
    expect(parseReminder(madrid)).toEqual(madrid);
    expect(parseReminder({ ...madrid, day: 29 })).toBeNull();
    expect(parseReminder({ ...madrid, hour: 24 })).toBeNull();
    expect(parseReminder({ ...madrid, timeZone: "Marte/Olympus" })).toBeNull();
  });
  it("alertas: claves de precio válidas y precios positivos", () => {
    const ok = { id: "a1", key: "coingecko:bitcoin", name: "Bitcoin", direction: "above", price: "80000.5" };
    expect(parseRemoteAlerts([ok])).toHaveLength(1);
    expect(parseRemoteAlerts([{ ...ok, key: "otra:cosa" }])).toBeNull();
    expect(parseRemoteAlerts([{ ...ok, price: "0" }])).toBeNull();
    expect(parseRemoteAlerts([{ ...ok, price: "1e5" }])).toBeNull();
    expect(parseRemoteAlerts([{ ...ok, quantity: "3" }])).toEqual([ok]); // lo que sobra se descarta
  });
});

const alert = (id: string, direction: "above" | "below", price: string, key = "coingecko:bitcoin"): RemoteAlert => ({
  id,
  key,
  name: "Bitcoin",
  direction,
  price,
});

describe("evaluateRemoteAlerts", () => {
  it("«sube de» y «baja de» incluyen el propio precio; sin precio, sigue activa", () => {
    const prices = new Map([["coingecko:bitcoin", new Decimal("80000")]]);
    const { due, remaining } = evaluateRemoteAlerts(
      [alert("up", "above", "80000"), alert("down", "below", "79999.99"), alert("low", "below", "80000"), alert("eth", "above", "1", "coingecko:ethereum")],
      prices,
    );
    expect(due.map((d) => d.alert.id)).toEqual(["up", "low"]);
    expect(remaining.map((a) => a.id)).toEqual(["down", "eth"]);
  });
});

describe("syncAlerts", () => {
  it("no resucita una alerta ya disparada y olvida los disparos de hace más de 30 días", () => {
    const now = new Date("2026-10-20T10:00:00Z");
    const fired = [
      { id: "old", price: "1", at: "2026-09-01T10:00:00Z" },
      { id: "recent", price: "1", at: "2026-10-19T10:00:00Z" },
    ];
    const result = syncAlerts({ fired }, [alert("recent", "above", "1"), alert("new", "above", "1")], now);
    expect(result.alerts.map((a) => a.id)).toEqual(["new"]);
    expect(result.fired.map((f) => f.id)).toEqual(["recent"]);
  });
});
