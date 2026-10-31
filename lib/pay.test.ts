import { describe, expect, it } from "vitest";
import { csvCell, resolveRate, shiftPay } from "./pay";

describe("resolveRate", () => {
  it("prefers the staff-specific service rate", () => {
    expect(resolveRate({ override: 55, serviceRate: 40, baseRate: 25 })).toBe(55);
  });
  it("falls back to the service rate, then the base rate", () => {
    expect(resolveRate({ serviceRate: 40, baseRate: 25 })).toBe(40);
    expect(resolveRate({ baseRate: "25.50" as unknown as number })).toBe(25.5);
    expect(resolveRate({})).toBe(0);
  });
});

describe("shiftPay", () => {
  it("rounds hours and money to cents", () => {
    const pay = shiftPay(new Date("2026-10-30T14:00:00Z"), new Date("2026-10-30T15:20:00Z"), 30);
    expect(pay).toEqual({ hours: 1.33, amount: 39.9 });
  });
});

describe("csvCell", () => {
  it("quotes commas and blocks formulas", () => {
    expect(csvCell("Smith, J")).toBe('"Smith, J"');
    expect(csvCell("=HYPERLINK()")).toBe(`"'=HYPERLINK()"`);
    expect(csvCell(12.5)).toBe("12.5");
  });
});
