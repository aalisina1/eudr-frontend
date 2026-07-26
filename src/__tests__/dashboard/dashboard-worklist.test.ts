/**
 * Pure derivation helpers behind the Dashboard worklist (#30, Prompt D) —
 * kept framework-free so the bucketing/date logic that decides "which card
 * does this PO land in" is unit-testable without mounting React or mocking
 * fetch. See `src/lib/dashboard-worklist.ts`.
 */
import { describe, it, expect } from "vitest";
import {
  bucketReadiness,
  computeHighRiskConcentration,
  countDdsExpiringWithin90Days,
  daysUntil,
  dedupeCountryNames,
  EUDR_ENFORCEMENT_DATE,
  EUDR_ENFORCEMENT_DATE_LABEL,
  formatDateLine,
  formatEtaLabel,
  getQuarterBounds,
  greeting,
  kgToTonnesLabel,
  isWithinQuarter,
  shouldShowDashboardCtas,
  VIEWER_SEES_DASHBOARD_CTAS,
} from "@/lib/dashboard-worklist";
import type { BatchReadiness, DueDiligenceStatement, Supplier, User } from "@/lib/api/types";

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

function dds(overrides: Partial<DueDiligenceStatement> = {}): DueDiligenceStatement {
  return {
    id: "dds-1",
    reference_number: "DDS-2026-0001",
    traces_reference: "",
    status: "SUBMITTED",
    statement_type: "OPERATOR",
    activity_type: "IMPORT",
    batch_ids: [],
    risk_conclusion: null,
    conclusion_justification: "",
    operator_id: "op-1",
    created_by_id: "u1",
    reviewed_by_id: null,
    submitted_at: "2026-01-01T00:00:00Z",
    valid_until: null,
    archived_until: null,
    created_at: "2026-01-01T00:00:00Z",
    updated_at: "2026-01-01T00:00:00Z",
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

describe("EUDR_ENFORCEMENT_DATE", () => {
  it("is the fixed statutory date with a matching display label", () => {
    expect(EUDR_ENFORCEMENT_DATE).toBe("2026-12-30");
    expect(EUDR_ENFORCEMENT_DATE_LABEL).toBe("30 Dec 2026");
  });
});

describe("countDdsExpiringWithin90Days", () => {
  const now = new Date(2026, 6, 8); // 8 July 2026

  it("counts a SUBMITTED statement expiring within 90 days", () => {
    const s = dds({ status: "SUBMITTED", valid_until: "2026-09-01" }); // 55 days out
    expect(countDdsExpiringWithin90Days([s], now)).toBe(1);
  });

  it("excludes a SUBMITTED statement expiring well beyond 90 days", () => {
    const s = dds({ status: "SUBMITTED", valid_until: "2026-12-01" });
    expect(countDdsExpiringWithin90Days([s], now)).toBe(0);
  });

  it("includes the 90-day boundary", () => {
    const s = dds({ status: "SUBMITTED", valid_until: "2026-10-06" }); // exactly 90 days
    expect(countDdsExpiringWithin90Days([s], now)).toBe(1);
  });

  it("includes an already-lapsed statement (the most urgent case, not excluded)", () => {
    const s = dds({ status: "SUBMITTED", valid_until: "2026-06-01" });
    expect(countDdsExpiringWithin90Days([s], now)).toBe(1);
  });

  it("excludes a non-SUBMITTED statement even with a near valid_until", () => {
    const s = dds({ status: "DRAFT", valid_until: "2026-08-01" });
    expect(countDdsExpiringWithin90Days([s], now)).toBe(0);
  });

  it("excludes a statement with no valid_until", () => {
    const s = dds({ status: "SUBMITTED", valid_until: null });
    expect(countDdsExpiringWithin90Days([s], now)).toBe(0);
  });
});

function supplier(overrides: Partial<Supplier> = {}): Supplier {
  return {
    id: "sup-high",
    name: "Ivoire Cocoa",
    country_of_origin: "CI",
    kyc_status: "VERIFIED",
    risk_rating: "HIGH",
    external_id: "",
    managed_by_id: "u1",
    supplier_organization_id: null,
    kyc_verified_at: null,
    created_at: "2026-01-01T00:00:00Z",
    updated_at: "2026-01-01T00:00:00Z",
    ...overrides,
  };
}

describe("computeHighRiskConcentration", () => {
  it("counts distinct HIGH-risk sellers that appear among the readiness rows", () => {
    const rows = [
      po({ id: "a", seller_id: "sup-high" }),
      po({ id: "b", seller_id: "sup-standard" }),
    ];
    const result = computeHighRiskConcentration(rows, [supplier()]);
    expect(result.supplierCount).toBe(1);
  });

  it("does not count a HIGH-risk supplier with no matching readiness rows", () => {
    const rows = [po({ id: "a", seller_id: "sup-standard" })];
    const result = computeHighRiskConcentration(rows, [supplier()]);
    expect(result.supplierCount).toBe(0);
    expect(result.countryNames).toEqual([]);
  });

  it("computes KG-normalised volume share (TONNES x1000), excluding M3/PIECES from both sums", () => {
    const rows = [
      po({
        id: "a",
        seller_id: "sup-high",
        funnel: { unit: "TONNES", ordered_quantity: "1.0000", allocated_quantity: "0", geolocated_quantity: "0", filed_quantity: "0", uncovered_quantity: "1.0000" },
      }), // 1000kg
      po({
        id: "b",
        seller_id: "sup-standard",
        funnel: { unit: "KG", ordered_quantity: "3000.0000", allocated_quantity: "0", geolocated_quantity: "0", filed_quantity: "0", uncovered_quantity: "3000.0000" },
      }), // 3000kg
      po({
        id: "c",
        seller_id: "sup-standard",
        funnel: { unit: "M3", ordered_quantity: "999.0000", allocated_quantity: "0", geolocated_quantity: "0", filed_quantity: "0", uncovered_quantity: "999.0000" },
      }), // excluded from both sums
    ];
    const result = computeHighRiskConcentration(rows, [supplier()]);
    expect(result.volumePct).toBe(25); // 1000 / (1000 + 3000) = 25%
  });

  it("returns a null volumePct when there is no mass-unit volume at all", () => {
    const rows = [
      po({
        id: "a",
        seller_id: "sup-standard",
        funnel: { unit: "M3", ordered_quantity: "5.0000", allocated_quantity: "0", geolocated_quantity: "0", filed_quantity: "0", uncovered_quantity: "5.0000" },
      }),
    ];
    expect(computeHighRiskConcentration(rows, [supplier()]).volumePct).toBeNull();
  });

  it("dedupes matched suppliers' countries in first-seen order", () => {
    const supplier2 = supplier({ id: "sup-high-2", country_of_origin: "CM" });
    const rows = [
      po({ id: "a", seller_id: "sup-high" }),
      po({ id: "b", seller_id: "sup-high-2" }),
      po({ id: "c", seller_id: "sup-high" }),
    ];
    const result = computeHighRiskConcentration(rows, [supplier(), supplier2]);
    expect(result.countryNames).toEqual(["Côte d’Ivoire", "Cameroon"]);
  });
});

describe("dedupeCountryNames", () => {
  it("maps ISO 3166-1 alpha-2 codes to display names and dedupes", () => {
    expect(dedupeCountryNames(["GH", "GH", "CM"])).toEqual(["Ghana", "Cameroon"]);
  });

  it("falls back to the raw code for an unresolvable private-use code", () => {
    expect(dedupeCountryNames(["XX"])).toEqual(["XX"]);
  });

  it("falls back to the raw code when Intl.DisplayNames throws on a malformed code", () => {
    // Digit-containing 2-char codes throw RangeError in Intl.DisplayNames —
    // this exercises the catch branch (the "XX" case above only hits the
    // resolve-and-echo path). Real data: Supplier.country_of_origin is an
    // unvalidated CharField(max_length=2), so bad import data can reach here.
    expect(dedupeCountryNames(["12"])).toEqual(["12"]);
  });
});

describe("shouldShowDashboardCtas", () => {
  it("always shows CTAs for non-VIEWER roles regardless of the flag", () => {
    expect(shouldShowDashboardCtas("COMPLIANCE_OFFICER", false)).toBe(true);
    expect(shouldShowDashboardCtas("ADMIN", false)).toBe(true);
  });

  it("shows CTAs for VIEWER when the flag is true", () => {
    expect(shouldShowDashboardCtas("VIEWER", true)).toBe(true);
  });

  it("hides CTAs for VIEWER when the flag is false", () => {
    expect(shouldShowDashboardCtas("VIEWER", false)).toBe(false);
  });

  it("defaults to the module-level VIEWER_SEES_DASHBOARD_CTAS constant when the flag arg is omitted", () => {
    expect(shouldShowDashboardCtas("VIEWER")).toBe(VIEWER_SEES_DASHBOARD_CTAS);
  });
});
