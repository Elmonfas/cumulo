import Decimal from "decimal.js";
import { describe, expect, it } from "vitest";
import { dueAlerts, isAlertMet } from "./alerts";
import type { PriceAlert } from "./models";

const alert = (id: string, direction: PriceAlert["direction"], price: string, extra: Partial<PriceAlert> = {}): PriceAlert => ({
  id,
  assetId: "A",
  direction,
  price,
  createdAt: "2026-10-15T10:00:00Z",
  ...extra,
});

describe("alertas de precio", () => {
  it("«sube de» y «baja de» incluyen el precio exacto", () => {
    expect(isAlertMet(alert("a", "above", "100"), new Decimal("100"))).toBe(true);
    expect(isAlertMet(alert("a", "above", "100"), new Decimal("99.99"))).toBe(false);
    expect(isAlertMet(alert("b", "below", "100"), new Decimal("100"))).toBe(true);
    expect(isAlertMet(alert("b", "below", "100"), new Decimal("100.01"))).toBe(false);
  });

  it("solo devuelve alertas activas que se cumplen y con precio", () => {
    const alerts = [
      alert("up", "above", "170"),
      alert("down", "below", "150"),
      alert("done", "above", "100", { triggeredAt: "2026-10-01T00:00:00Z" }),
      alert("other", "above", "1", { assetId: "SIN-PRECIO" }),
    ];
    const due = dueAlerts(alerts, new Map([["A", new Decimal("170.94")]]));
    expect(due.map((d) => d.alert.id)).toEqual(["up"]);
    expect(due[0].price.toString()).toBe("170.94");
  });
});
