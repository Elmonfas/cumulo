import { describe, expect, it } from "vitest";
import { parseDecimal, parsePercent, toInputString } from "./parse";

describe("parseDecimal", () => {
  it.each([
    ["1.234,56", "1234.56"],
    ["1234,56", "1234.56"],
    ["1.234", "1234"],
    ["1.234.567", "1234567"],
    ["1.234.567,8", "1234567.8"],
    ["7.5", "7.5"],
    ["0,5", "0.5"],
    [",5", "0.5"],
    ["  10 000 € ", "10000"],
    ["-12,30", "-12.3"],
    ["−12,30", "-12.3"],
    ["+3", "3"],
    ["0.12345678", "0.12345678"],
    ["-0", "0"],
  ])("%s → %s", (raw, expected) => {
    expect(parseDecimal(raw)?.toString()).toBe(expected);
  });

  it.each(["", "abc", "1,2,3", "1.23,4", "12,", "1e5", "--1", "1.2.3", "12a"])("rechaza %j", (raw) => {
    expect(parseDecimal(raw)).toBeNull();
  });
});

describe("parsePercent", () => {
  it("convierte puntos porcentuales en proporción", () => {
    expect(parsePercent("7")?.toString()).toBe("0.07");
    expect(parsePercent("2,5 %")?.toString()).toBe("0.025");
    expect(parsePercent("x")).toBeNull();
  });
});

describe("toInputString", () => {
  it("usa coma decimal y no agrupa", () => {
    expect(toInputString("1234.5")).toBe("1234,5");
    expect(toInputString("10000")).toBe("10000");
  });
});
