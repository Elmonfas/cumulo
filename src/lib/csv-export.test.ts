import Decimal from "decimal.js";
import { describe, expect, it } from "vitest";
import { csvNumber, toCsv } from "./csv-export";

describe("toCsv", () => {
  it("usa ; y coma decimal, con BOM", () => {
    const csv = toCsv(["Activo", "Importe"], [["SAP SE", new Decimal("1234.5")]]);
    expect(csv).toBe("﻿Activo;Importe\r\nSAP SE;1234,5\r\n");
  });

  it("escapa comillas y separadores, y neutraliza fórmulas en texto", () => {
    const csv = toCsv(["a", "b", "c"], [['Dice "hola"; adiós', "=HYPERLINK(1)", new Decimal("-3")]]);
    expect(csv.split("\r\n")[1]).toBe('"Dice ""hola""; adiós";\'=HYPERLINK(1);-3');
  });

  it("csvNumber fija decimales si se piden", () => {
    expect(csvNumber("1.005", 2)).toBe("1,01");
    expect(csvNumber(new Decimal(7))).toBe("7");
  });
});
