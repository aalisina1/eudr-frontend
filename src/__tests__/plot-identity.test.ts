import { describe, expect, it } from "vitest";

import { plotIdentity, plotMatchesQuery } from "@/lib/plot-identity";
import type { LandPlot } from "@/lib/api/types";

const base: LandPlot = {
  id: "0d6f4a2e-1c3b-4f5a-8e9d-7b6c5a4d3e2f",
  reference: "PLOT-000412",
  supplier_id: "s-1",
  country: "GH",
  region: "Ashanti",
  area_hectares: 2.4,
  geometry: null,
  geometry_source: "GPS_DEVICE",
  accuracy_meters: null,
  collection_date: null,
  validation_status: "PASSED",
  validated_at: null,
  external_id: "",
  created_at: "2026-01-01T00:00:00Z",
  updated_at: "2026-01-01T00:00:00Z",
};

describe("plotIdentity", () => {
  it("uses the reference as the primary identity", () => {
    expect(plotIdentity(base).primary).toBe("PLOT-000412");
  });

  it("distinguishes two otherwise identical plots", () => {
    const a = { ...base, reference: "PLOT-000412" };
    const b = { ...base, id: "other", reference: "PLOT-000413" };
    expect(plotIdentity(a).primary).not.toBe(plotIdentity(b).primary);
  });

  it("includes their code in the secondary line when present", () => {
    expect(plotIdentity({ ...base, external_id: "FF-9931" }).secondary).toContain("FF-9931");
  });

  it("omits their code when blank rather than showing an empty separator", () => {
    const { secondary } = plotIdentity(base);
    expect(secondary).toBe("GH, Ashanti · 2.4 ha");
  });

  it("omits the region when blank", () => {
    expect(plotIdentity({ ...base, region: "" }).secondary).toBe("GH · 2.4 ha");
  });

  it("omits the area when null", () => {
    expect(plotIdentity({ ...base, area_hectares: null as never }).secondary).toBe("GH, Ashanti");
  });

  it("falls back to a composite when the reference is missing", () => {
    // Defensive: a stale cached response from before the backend migration.
    expect(plotIdentity({ ...base, reference: "" }).primary).toBe("GH, Ashanti");
  });

  it("never renders a naked UUID as the primary identity", () => {
    const bare = { ...base, reference: "", region: "", country: "" };
    expect(plotIdentity(bare).primary).not.toBe(bare.id);
    expect(plotIdentity(bare).primary).toBe("Plot 0d6f4a2e");
  });
});

describe("plotMatchesQuery", () => {
  const plot = { ...base, external_id: "FF-9931" };

  it("matches on reference", () => {
    expect(plotMatchesQuery(plot, "plot-000412")).toBe(true);
  });

  it("matches on their code", () => {
    expect(plotMatchesQuery(plot, "ff-99")).toBe(true);
  });

  it("matches on region and country", () => {
    expect(plotMatchesQuery(plot, "ashanti")).toBe(true);
    expect(plotMatchesQuery(plot, "gh")).toBe(true);
  });

  it("does not match unrelated text", () => {
    expect(plotMatchesQuery(plot, "brazil")).toBe(false);
  });

  it("treats an empty query as matching everything", () => {
    expect(plotMatchesQuery(plot, "")).toBe(true);
  });
});
