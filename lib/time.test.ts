import { describe, expect, it } from "vitest";
import { parseLocalDateTime, toLocalInput, startOfWeek, validateShift, formatHours } from "./time";

describe("time zone helpers", () => {
  it("round-trips a local time in Chicago", () => {
    const d = parseLocalDateTime("2026-07-01T09:15", "America/Chicago")!;
    expect(d.toISOString()).toBe("2026-07-01T14:15:00.000Z");
    expect(toLocalInput(d, "America/Chicago")).toBe("2026-07-01T09:15");
  });

  it("handles standard time after the November change", () => {
    const d = parseLocalDateTime("2026-11-02T09:00", "America/Chicago")!;
    expect(d.toISOString()).toBe("2026-11-02T15:00:00.000Z");
  });

  it("rejects malformed input", () => {
    expect(parseLocalDateTime("yesterday")).toBeNull();
  });

  it("finds Monday of the week", () => {
    const thu = parseLocalDateTime("2026-10-29T20:00", "America/Chicago")!;
    expect(toLocalInput(startOfWeek(thu, "America/Chicago"), "America/Chicago")).toBe("2026-10-26T00:00");
  });

  it("formats hours", () => {
    expect(formatHours(1.5)).toBe("1h 30m");
    expect(formatHours(0.999)).toBe("1h 0m");
  });
});

describe("validateShift", () => {
  const now = new Date("2026-10-30T20:00:00Z");
  it("accepts a normal shift", () => {
    expect(validateShift(new Date("2026-10-30T14:00:00Z"), new Date("2026-10-30T18:00:00Z"), now)).toBeNull();
  });
  it("rejects end before start, future, and overlong shifts", () => {
    expect(validateShift(new Date("2026-10-30T18:00:00Z"), new Date("2026-10-30T14:00:00Z"), now)).toMatch(/after/);
    expect(validateShift(new Date("2026-10-30T19:00:00Z"), new Date("2026-10-31T01:00:00Z"), now)).toMatch(/future/);
    expect(validateShift(new Date("2026-10-29T00:00:00Z"), new Date("2026-10-29T20:00:00Z"), now)).toMatch(/longer/);
  });
});
