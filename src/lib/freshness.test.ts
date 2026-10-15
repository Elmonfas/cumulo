import { describe, expect, it } from "vitest";
import { describeFreshness } from "./freshness";

// 16 oct 2026 a las 00:54 en hora local de la prueba.
const now = new Date(2026, 9, 16, 0, 54);
const at = (h: number, m: number, day = 15) => new Date(2026, 9, day, h, m).toISOString();

describe("describeFreshness", () => {
  it("todo reciente: al momento", () => {
    expect(describeFreshness([{ label: "BTC", updatedAt: at(0, 52, 16) }], now)).toBe("Precios al momento");
  });

  it("todo cerrado a la vez: una sola hora", () => {
    expect(
      describeFreshness(
        [
          { label: "VWCE", updatedAt: at(17, 35) },
          { label: "SAP", updatedAt: at(17, 38) },
        ],
        now,
      ),
    ).toBe("Mercados cerrados: el último precio del 15 oct 2026, 17:38");
  });

  it("todo cerrado a horas distintas: sin una hora engañosa", () => {
    expect(
      describeFreshness(
        [
          { label: "VWCE", updatedAt: at(17, 35) },
          { label: "AAPL", updatedAt: at(22, 0) },
        ],
        now,
      ),
    ).toBe("Mercados cerrados: su último precio de cierre");
  });

  it("mezcla: dice qué activos están con el cierre y cuáles al momento", () => {
    expect(
      describeFreshness(
        [
          { label: "VWCE", updatedAt: at(17, 35) },
          { label: "SAP", updatedAt: at(17, 38) },
          { label: "BTC", updatedAt: at(0, 52, 16) },
        ],
        now,
      ),
    ).toBe("VWCE y SAP con el último precio del 15 oct 2026, 17:38 (su mercado está cerrado) · BTC al momento");
  });

  it("el mismo día dice solo la hora y resume listas largas", () => {
    const noon = new Date(2026, 9, 15, 23, 0);
    const text = describeFreshness(
      ["A", "B", "C", "D"].map((label) => ({ label, updatedAt: at(17, 35) })).concat({ label: "BTC", updatedAt: at(22, 59) }),
      noon,
    );
    expect(text).toBe("A, B y 2 más con el último precio de las 17:35 (su mercado está cerrado) · BTC al momento");
  });

  it("sin precios no dice nada", () => {
    expect(describeFreshness([], now)).toBeNull();
  });
});
