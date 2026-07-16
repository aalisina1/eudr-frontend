/**
 * Unit tests for the File DDS composition page's pure derivation logic
 * (eudr-frontend #26, sourcing-readiness.design-prompt.md Prompt C + Round-2
 * item 1) — the auto-summed net mass, harvest-period range, payload-meter
 * formatting, and the split-by-shipment/lot-chunk suggestion math. Kept
 * framework/fetch-free (mirrors `src/lib/dashboard-worklist.ts`'s pattern) so
 * this arithmetic is verifiable without mounting the composer component.
 */
import { describe, it, expect } from "vitest";
import {
  summarizeNetMass,
  harvestPeriodRange,
  formatTonnes,
  formatKgFinePrint,
  formatHarvestRange,
  formatMb,
  buildSplitSuggestion,
} from "@/lib/file-dds-composer";
import type { LotReadiness, PayloadEstimateBatchRow } from "@/lib/api/types";

function lot(overrides: Partial<LotReadiness> & { id: string }): LotReadiness {
  return {
    reference_number: `LOT-${overrides.id}`,
    quantity: "25000.0000",
    unit: "KG",
    harvest_period_start: null,
    harvest_period_end: null,
    plot_count: 1,
    plots_resolved: true,
    plots_failed_count: 0,
    plots_pending_count: 0,
    filed: false,
    filing_dds_id: null,
    filing_dds_reference: "",
    ...overrides,
  };
}

describe("summarizeNetMass", () => {
  it("sums checked KG lots", () => {
    const lots = [lot({ id: "1", quantity: "25000.0000", unit: "KG" }), lot({ id: "2", quantity: "30000.0000", unit: "KG" })];
    const checked = new Set(["1", "2"]);
    expect(summarizeNetMass(lots, checked)).toEqual({ totalKg: 55000, excludedUnitCount: 0 });
  });

  it("converts TONNES to kg before summing", () => {
    const lots = [lot({ id: "1", quantity: "25", unit: "TONNES" }), lot({ id: "2", quantity: "5000", unit: "KG" })];
    const checked = new Set(["1", "2"]);
    expect(summarizeNetMass(lots, checked)).toEqual({ totalKg: 30000, excludedUnitCount: 0 });
  });

  it("excludes unchecked lots from the total", () => {
    const lots = [lot({ id: "1", quantity: "25000.0000", unit: "KG" }), lot({ id: "2", quantity: "99999.0000", unit: "KG" })];
    const checked = new Set(["1"]);
    expect(summarizeNetMass(lots, checked)).toEqual({ totalKg: 25000, excludedUnitCount: 0 });
  });

  it("excludes non-mass units (M3, PIECES) from the total and counts them", () => {
    const lots = [
      lot({ id: "1", quantity: "25000.0000", unit: "KG" }),
      lot({ id: "2", quantity: "10.0000", unit: "M3" }),
      lot({ id: "3", quantity: "500.0000", unit: "PIECES" }),
    ];
    const checked = new Set(["1", "2", "3"]);
    expect(summarizeNetMass(lots, checked)).toEqual({ totalKg: 25000, excludedUnitCount: 2 });
  });

  it("returns zero for an empty checked set", () => {
    const lots = [lot({ id: "1" })];
    expect(summarizeNetMass(lots, new Set())).toEqual({ totalKg: 0, excludedUnitCount: 0 });
  });
});

describe("harvestPeriodRange", () => {
  it("returns the min start and max end across checked lots", () => {
    const lots = [
      lot({ id: "1", harvest_period_start: "2025-10-01", harvest_period_end: "2025-11-01" }),
      lot({ id: "2", harvest_period_start: "2025-09-01", harvest_period_end: "2025-12-01" }),
    ];
    const checked = new Set(["1", "2"]);
    expect(harvestPeriodRange(lots, checked)).toEqual({ start: "2025-09-01", end: "2025-12-01" });
  });

  it("ignores unchecked lots", () => {
    const lots = [
      lot({ id: "1", harvest_period_start: "2025-10-01", harvest_period_end: "2025-11-01" }),
      lot({ id: "2", harvest_period_start: "2025-01-01", harvest_period_end: "2025-02-01" }),
    ];
    const checked = new Set(["1"]);
    expect(harvestPeriodRange(lots, checked)).toEqual({ start: "2025-10-01", end: "2025-11-01" });
  });

  it("skips lots missing a harvest period entirely", () => {
    const lots = [
      lot({ id: "1", harvest_period_start: null, harvest_period_end: null }),
      lot({ id: "2", harvest_period_start: "2025-09-01", harvest_period_end: "2025-12-01" }),
    ];
    const checked = new Set(["1", "2"]);
    expect(harvestPeriodRange(lots, checked)).toEqual({ start: "2025-09-01", end: "2025-12-01" });
  });

  it("returns nulls when no checked lot has a harvest period", () => {
    const lots = [lot({ id: "1", harvest_period_start: null, harvest_period_end: null })];
    expect(harvestPeriodRange(lots, new Set(["1"]))).toEqual({ start: null, end: null });
  });
});

describe("formatTonnes / formatKgFinePrint", () => {
  it("formats whole tonnes with thousands separators", () => {
    expect(formatTonnes(250_000)).toBe("250 t");
    expect(formatTonnes(1_234_500)).toBe("1,235 t");
  });

  it("formats kg fine print with thousands separators", () => {
    expect(formatKgFinePrint(250_000)).toBe("250,000 kg");
  });
});

describe("formatHarvestRange", () => {
  it("formats a same-year range as 'Oct – Dec 2025'", () => {
    expect(formatHarvestRange("2025-10-01", "2025-12-01")).toBe("Oct – Dec 2025");
  });

  it("formats a cross-year range with both years", () => {
    expect(formatHarvestRange("2025-11-01", "2026-01-15")).toBe("Nov 2025 – Jan 2026");
  });

  it("returns null when start is missing", () => {
    expect(formatHarvestRange(null, null)).toBeNull();
  });
});

describe("formatMb", () => {
  it("formats bytes as decimal MB with one decimal place", () => {
    expect(formatMb(18_400_000)).toBe("18.4 MB");
    expect(formatMb(25_000_000)).toBe("25.0 MB");
    expect(formatMb(0)).toBe("0.0 MB");
  });
});

function row(overrides: Partial<PayloadEstimateBatchRow> & { batch_id: string }): PayloadEstimateBatchRow {
  return { shipment_reference: null, plot_count: 1, estimated_bytes: 1000, ...overrides };
}

describe("buildSplitSuggestion", () => {
  it("groups by shipment_reference when 2+ distinct shipments are present", () => {
    const batches = [
      row({ batch_id: "a", shipment_reference: "MV Elbe Trader", estimated_bytes: 14_100_000 }),
      row({ batch_id: "b", shipment_reference: "MV Baltic Star", estimated_bytes: 17_100_000 }),
      row({ batch_id: "c", shipment_reference: "MV Elbe Trader", estimated_bytes: 1_000_000 }),
    ];
    const result = buildSplitSuggestion(batches, (id) => id);
    expect(result.mode).toBe("shipment");
    expect(result.groups).toHaveLength(2);
    const elbe = result.groups.find((g) => g.label === "MV Elbe Trader")!;
    expect(elbe.totalBytes).toBe(15_100_000);
    expect(elbe.batchIds.sort()).toEqual(["a", "c"]);
    const baltic = result.groups.find((g) => g.label === "MV Baltic Star")!;
    expect(baltic.totalBytes).toBe(17_100_000);
  });

  it("groups an unassigned (null shipment_reference) cluster under its own label", () => {
    const batches = [
      row({ batch_id: "a", shipment_reference: "MV Elbe Trader", estimated_bytes: 10_000_000 }),
      row({ batch_id: "b", shipment_reference: null, estimated_bytes: 5_000_000 }),
    ];
    const result = buildSplitSuggestion(batches, (id) => id);
    expect(result.mode).toBe("shipment");
    const unassigned = result.groups.find((g) => g.batchIds.includes("b"))!;
    expect(unassigned.label).toBe("No shipment assigned");
  });

  it("falls back to one-chunk-per-lot when there is no shipment diversity", () => {
    const batches = [
      row({ batch_id: "a", shipment_reference: null, estimated_bytes: 10_000_000 }),
      row({ batch_id: "b", shipment_reference: null, estimated_bytes: 8_000_000 }),
    ];
    const result = buildSplitSuggestion(batches, (id) => `LOT-${id}`);
    expect(result.mode).toBe("lot");
    expect(result.groups).toHaveLength(2);
    expect(result.groups.map((g) => g.label).sort()).toEqual(["LOT-a", "LOT-b"]);
  });

  it("falls back to lot chunks when every batch shares the same single shipment", () => {
    const batches = [
      row({ batch_id: "a", shipment_reference: "MV Elbe Trader", estimated_bytes: 10_000_000 }),
      row({ batch_id: "b", shipment_reference: "MV Elbe Trader", estimated_bytes: 8_000_000 }),
    ];
    const result = buildSplitSuggestion(batches, (id) => `LOT-${id}`);
    expect(result.mode).toBe("lot");
    expect(result.groups).toHaveLength(2);
  });

  it("each group's totalBytes sums exactly (no double count) and groups sum to the aggregate", () => {
    const batches = [
      row({ batch_id: "a", shipment_reference: "S1", estimated_bytes: 3 }),
      row({ batch_id: "b", shipment_reference: "S2", estimated_bytes: 5 }),
      row({ batch_id: "c", shipment_reference: "S1", estimated_bytes: 7 }),
    ];
    const result = buildSplitSuggestion(batches, (id) => id);
    const total = result.groups.reduce((sum, g) => sum + g.totalBytes, 0);
    expect(total).toBe(15);
  });
});
