import { describe, expect, it } from "vitest";
import { coveragePct, deriveTrackingState, humanizeEventType } from "@/lib/consignment-format";

describe("deriveTrackingState", () => {
  const base = { tracking_number: null, t49_request_id: null, latest_eta: null };
  it("untracked when no tracking number", () => {
    expect(deriveTrackingState(base)).toBe("untracked");
  });
  it("subscribing when tracking number set but no eta yet", () => {
    expect(deriveTrackingState({ ...base, tracking_number: "MSCU1" })).toBe("subscribing");
    expect(deriveTrackingState({ ...base, tracking_number: "MSCU1", t49_request_id: "treq_1" })).toBe("subscribing");
  });
  it("live when latest_eta present", () => {
    expect(deriveTrackingState({ ...base, tracking_number: "MSCU1", t49_request_id: "treq_1", latest_eta: "2026-08-01T00:00:00Z" })).toBe("live");
  });
  it("backend-supplied tracking_state wins over derivation", () => {
    expect(deriveTrackingState({ ...base, tracking_number: "MSCU1", tracking_state: "quota_reached" })).toBe("quota_reached");
    expect(deriveTrackingState({ ...base, tracking_number: "MSCU1", tracking_state: "error" })).toBe("error");
  });
});

describe("coveragePct", () => {
  it("rounds covered/total", () => {
    expect(coveragePct(1, 2)).toBe(50);
    expect(coveragePct(1, 3)).toBe(33);
  });
  it("is 0 for an empty consignment (no divide-by-zero)", () => {
    expect(coveragePct(0, 0)).toBe(0);
  });
});

describe("humanizeEventType", () => {
  it("underscore-separates into a capitalized phrase", () => {
    expect(humanizeEventType("vessel_departed")).toBe("Vessel departed");
    expect(humanizeEventType("eta_changed")).toBe("Eta changed");
  });
});
