import { describe, expect, it } from "vitest";
import { mergeOlderHistory } from "./merge-history";

const p = (date: string, close: string) => ({ date, close });

describe("mergeOlderHistory", () => {
  const recent = [p("2025-10-17", "92764.59"), p("2025-10-18", "93000")];

  it("añade los días anteriores cuando ambas fuentes coinciden (±5 %)", () => {
    const older = [p("2024-08-25", "57494.31"), p("2025-10-16", "91000"), p("2025-10-17", "94000"), p("2025-10-18", "1")];
    expect(mergeOlderHistory(older, recent)).toEqual([p("2024-08-25", "57494.31"), p("2025-10-16", "91000"), ...recent]);
  });

  it("sin día común compara con el último anterior", () => {
    const older = [p("2024-08-25", "57494.31"), p("2025-10-15", "90000")];
    expect(mergeOlderHistory(older, recent)).toHaveLength(4);
  });

  it("descarta la otra fuente si parece otro activo", () => {
    const older = [p("2024-08-25", "1.2"), p("2025-10-17", "1.3")];
    expect(mergeOlderHistory(older, recent)).toEqual(recent);
  });

  it("sin histórico reciente o sin días anteriores no cambia nada", () => {
    expect(mergeOlderHistory([p("2024-01-01", "1")], [])).toEqual([]);
    expect(mergeOlderHistory([p("2025-10-18", "93000")], recent)).toEqual(recent);
  });
});
