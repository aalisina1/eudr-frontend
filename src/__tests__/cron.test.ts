import { describe, it, expect } from "vitest";
import { isValidCron, describeCron, getNextRun } from "@/lib/cron";

describe("isValidCron", () => {
  it("accepts a valid 5-field expression", () => {
    expect(isValidCron("0 2 * * *")).toBe(true);
  });

  it("rejects a 4-field expression (backend requires exactly 5)", () => {
    expect(isValidCron("0 2 * *")).toBe(false);
  });

  it("rejects a 6-field expression with seconds (backend requires exactly 5)", () => {
    expect(isValidCron("0 0 2 * * *")).toBe(false);
  });

  it("rejects gibberish", () => {
    expect(isValidCron("not a cron")).toBe(false);
  });

  it("rejects an empty string", () => {
    expect(isValidCron("")).toBe(false);
  });
});

describe("describeCron", () => {
  it("returns a 24h human-readable description for a valid expression", () => {
    expect(describeCron("0 2 * * *")).toContain("02:00");
  });

  it("returns null for an invalid expression", () => {
    expect(describeCron("nope")).toBeNull();
  });
});

describe("getNextRun", () => {
  it("computes the next run after a given time in UTC", () => {
    const from = new Date("2026-06-21T03:00:00Z");
    const next = getNextRun("0 2 * * *", "UTC", from);
    expect(next?.toISOString()).toBe("2026-06-22T02:00:00.000Z");
  });

  it("evaluates the expression in the given timezone", () => {
    // 02:00 in Europe/Berlin (CEST, UTC+2 in June) == 00:00 UTC
    const from = new Date("2026-06-21T03:00:00Z");
    const next = getNextRun("0 2 * * *", "Europe/Berlin", from);
    expect(next?.toISOString()).toBe("2026-06-22T00:00:00.000Z");
  });

  it("returns null for an invalid expression", () => {
    expect(getNextRun("nope", "UTC")).toBeNull();
  });
});
