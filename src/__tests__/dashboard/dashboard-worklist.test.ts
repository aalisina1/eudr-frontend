/**
 * Pure derivation helpers behind the Dashboard worklist (#30, Prompt D) —
 * kept framework-free so the bucketing/date logic that decides "which card
 * does this PO land in" is unit-testable without mounting React or mocking
 * fetch. See `src/lib/dashboard-worklist.ts`.
 */
import { describe, it, expect } from "vitest";
import {
  bucketReadiness,
  daysUntil,
  formatDateLine,
  formatEtaLabel,
  getQuarterBounds,
  greeting,
  kgToTonnesLabel,
  isWithinQuarter,
} from "@/lib/dashboard-worklist";
import type { BatchReadiness } from "@/lib/api/types";

function po(overrides: Partial<BatchReadiness> = {}): BatchReadiness {
  return {
    id: "po-1",
    reference_number: "PO-2026-0001",
    seller_id: "seller-1",
    buyer_id: "buyer-1",
    product_id: "commodity-1",
    transaction_date: "2026-07-01",
    stage: "OPEN",
    blocked: false,
    blockers: [],
    funnel: {
      unit: "KG",
      ordered_quantity: "1000.0000",
      allocated_quantity: "0.0000",
      geolocated_quantity: "0.0000",
      filed_quantity: "0.0000",
      uncovered_quantity: "1000.0000",
    },
    lot_count: 0,
    next_deadline: null,
    ...overrides,
  };
}

describe("greeting", () => {
  it("is 'Good morning' before noon", () => {
    expect(greeting(new Date(2026, 6, 8, 0))).toBe("Good morning");
    expect(greeting(new Date(2026, 6, 8, 11, 59))).toBe("Good morning");
  });

  it("is 'Good afternoon' from noon to before 6pm", () => {
    expect(greeting(new Date(2026, 6, 8, 12))).toBe("Good afternoon");
    expect(greeting(new Date(2026, 6, 8, 17, 59))).toBe("Good afternoon");
  });

  it("is 'Good evening' from 6pm on", () => {
    expect(greeting(new Date(2026, 6, 8, 18))).toBe("Good evening");
    expect(greeting(new Date(2026, 6, 8, 23))).toBe("Good evening");
  });
});

describe("formatDateLine", () => {
  it("renders 'Weekday D Month YYYY'", () => {
    // 8 July 2026 is a Wednesday.
    expect(formatDateLine(new Date(2026, 6, 8))).toBe("Wednesday 8 July 2026");
  });
});

describe("formatEtaLabel", () => {
  it("renders 'D Mon' from an ISO date, immune to local timezone", () => {
    expect(formatEtaLabel("2026-07-20")).toBe("20 Jul");
    expect(formatEtaLabel("2026-06-30")).toBe("30 Jun");
  });
});

describe("daysUntil", () => {
  const now = new Date(2026, 6, 8); // 8 July 2026

  it("is positive for a future date", () => {
    expect(daysUntil("2026-07-20", now)).toBe(12);
  });

  it("is negative (overdue) for a past date", () => {
    expect(daysUntil("2026-06-30", now)).toBe(-8);
  });

  it("is zero for today", () => {
    expect(daysUntil("2026-07-08", now)).toBe(0);
  });
});

describe("getQuarterBounds / isWithinQuarter", () => {
  const now = new Date(2026, 6, 14); // 14 July 2026 -> Q3 (Jul-Sep)

  it("bounds Q3 2026 as [1 Jul, 1 Oct)", () => {
    const { start, end } = getQuarterBounds(now);
    expect(start.getMonth()).toBe(6); // July (0-indexed)
    expect(start.getDate()).toBe(1);
    expect(end.getMonth()).toBe(9); // October
    expect(end.getDate()).toBe(1);
  });

  it("is true for a date inside the current quarter", () => {
    expect(isWithinQuarter("2026-08-01T00:00:00Z", now)).toBe(true);
  });

  it("is false for a date in an earlier quarter", () => {
    expect(isWithinQuarter("2026-04-01T00:00:00Z", now)).toBe(false);
  });

  it("is false for null/undefined", () => {
    expect(isWithinQuarter(null, now)).toBe(false);
    expect(isWithinQuarter(undefined, now)).toBe(false);
  });
});

describe("kgToTonnesLabel", () => {
  it("converts KG to a thousands-separated tonnes label", () => {
    expect(kgToTonnesLabel("1240000.0000")).toBe("1,240 t");
  });

  it("renders 0 t for zero", () => {
    expect(kgToTonnesLabel("0.0000")).toBe("0 t");
  });
});

describe("bucketReadiness", () => {
  it("puts READY, non-blocked POs in filing, soonest/overdue deadline first (nulls last)", () => {
    const soon = po({ id: "soon", stage: "READY", next_deadline: "2026-07-20" });
    const overdue = po({ id: "overdue", stage: "READY", next_deadline: "2026-06-30" });
    const noDeadline = po({ id: "no-deadline", stage: "READY", next_deadline: null });
    const { filing } = bucketReadiness([soon, noDeadline, overdue]);
    expect(filing.map((r) => r.id)).toEqual(["overdue", "soon", "no-deadline"]);
  });

  it("excludes a blocked PO from filing even if its stage is READY", () => {
    const blockedReady = po({ id: "blocked-ready", stage: "READY", blocked: true });
    const { filing, blocked } = bucketReadiness([blockedReady]);
    expect(filing).toEqual([]);
    expect(blocked.map((r) => r.id)).toEqual(["blocked-ready"]);
  });

  it("puts any blocked PO in the blocked bucket regardless of stage", () => {
    const blockedAllocated = po({ id: "blocked-allocated", stage: "ALLOCATED", blocked: true });
    const { blocked, awaiting } = bucketReadiness([blockedAllocated]);
    expect(blocked.map((r) => r.id)).toEqual(["blocked-allocated"]);
    expect(awaiting).toEqual([]);
  });

  it("puts non-blocked OPEN/ALLOCATED/PLOTS_COMPLETE POs in awaiting", () => {
    const open = po({ id: "open", stage: "OPEN" });
    const allocated = po({ id: "allocated", stage: "ALLOCATED" });
    const plotsComplete = po({ id: "plots-complete", stage: "PLOTS_COMPLETE" });
    const { awaiting } = bucketReadiness([open, allocated, plotsComplete]);
    expect(awaiting.map((r) => r.id).sort()).toEqual(["allocated", "open", "plots-complete"]);
  });

  it("puts a non-blocked FILED PO in none of the three buckets", () => {
    const filed = po({ id: "filed", stage: "FILED" });
    const { filing, blocked, awaiting } = bucketReadiness([filed]);
    expect(filing).toEqual([]);
    expect(blocked).toEqual([]);
    expect(awaiting).toEqual([]);
  });
});
