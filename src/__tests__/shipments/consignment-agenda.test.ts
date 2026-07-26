import { describe, expect, it } from "vitest";
import { bucketConsignments, bucketForRow } from "@/lib/consignment-agenda";
import type { ConsignmentRow } from "@/lib/api/types";

const NOW = new Date("2026-07-25T12:00:00Z");

function row(over: Partial<ConsignmentRow>): ConsignmentRow {
  return {
    id: Math.random().toString(36).slice(2), reference: "REF",
    expected_clearance_date: null, customs_declaration_reference: "",
    tracking_number: null, t49_request_id: null,
    latest_eta: null, eta_source: "NONE", created_at: "2026-07-01T00:00:00Z",
    rag: "RED", covered_count: 0, total_count: 1, countdown_to: null, ...over,
  };
}
// A date-only string `d` UTC-days from 2026-07-25.
function iso(d: number): string {
  return new Date(Date.UTC(2026, 6, 25) + d * 86_400_000).toISOString().slice(0, 10);
}

describe("bucketForRow", () => {
  it("past-date uncovered → overdue", () => {
    expect(bucketForRow(row({ countdown_to: iso(-2), rag: "RED" }), NOW)).toBe("overdue");
  });
  it("due today and up to 7 days → this_week", () => {
    expect(bucketForRow(row({ countdown_to: iso(0) }), NOW)).toBe("this_week");
    expect(bucketForRow(row({ countdown_to: iso(7) }), NOW)).toBe("this_week");
  });
  it("8 to 14 days → next_week", () => {
    expect(bucketForRow(row({ countdown_to: iso(8) }), NOW)).toBe("next_week");
    expect(bucketForRow(row({ countdown_to: iso(14) }), NOW)).toBe("next_week");
  });
  it("15+ days → later", () => {
    expect(bucketForRow(row({ countdown_to: iso(15) }), NOW)).toBe("later");
  });
  it("null countdown_to → undated", () => {
    expect(bucketForRow(row({ countdown_to: null, rag: "GRAY" }), NOW)).toBe("undated");
  });
});

describe("bucketConsignments", () => {
  it("groups, orders, and drops empty buckets", () => {
    const buckets = bucketConsignments([
      row({ reference: "A", countdown_to: iso(3) }),            // this_week
      row({ reference: "B", countdown_to: iso(-1) }),           // overdue
      row({ reference: "C", countdown_to: null, rag: "GRAY" }), // undated
    ], NOW);
    expect(buckets.map((b) => b.key)).toEqual(["overdue", "this_week", "undated"]);
    expect(buckets[0].rows[0].reference).toBe("B");
    expect(buckets.map((b) => b.label)).toEqual(["Overdue", "This week", "Undated"]);
  });
});
