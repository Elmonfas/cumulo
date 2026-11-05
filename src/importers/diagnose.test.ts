import { describe, expect, it } from "vitest";
import { describeOtherBroker, diagnoseFile } from "./diagnose";

const bytes = (text: string) => new TextEncoder().encode(text);

describe("diagnóstico del archivo subido", () => {
  it("reconoce un PDF aunque se llame .csv", () => {
    expect(diagnoseFile("extracto.csv", bytes("%PDF-1.7"))).toMatch(/^Es un PDF/);
  });

  it("reconoce Numbers, Excel y comprimidos", () => {
    expect(diagnoseFile("export.numbers", bytes("PK\u0003\u0004"))).toMatch(/Numbers/);
    expect(diagnoseFile("export.xlsx", bytes("PK\u0003\u0004"))).toMatch(/Excel/);
    expect(diagnoseFile("export.csv", bytes("PK\u0003\u0004"))).toMatch(/comprimido/);
  });

  it("deja pasar un CSV", () => {
    expect(diagnoseFile("transacciones.csv", bytes('"datetime","date"'))).toBeNull();
  });

  it("detecta la exportación de otros brókers por sus columnas", () => {
    const degiro = ["Fecha", "Hora", "Producto", "ISIN", "Bolsa de", "Centro de ejecución", "Número", "Precio"];
    expect(describeOtherBroker(degiro)).toMatch(/^Este archivo parece de DEGIRO\./);
    expect(describeOtherBroker(["Date", "Ticker", "Type", "Quantity", "Price per share", "Total Amount"])).toMatch(/Revolut/);
    expect(describeOtherBroker(["datetime", "date", "category"])).toBeNull();
  });
});
