/**
 * `deriveTracesDisplay` is the one derivation behind both the Submissions
 * list badge and the DDS-detail panel. It used to be duplicated, and the two
 * copies drifted — exactly as `isInFlight` (#41) had drifted before it — so
 * the same statement could read "Submitted" on the list and "Failed" on its
 * own detail page. These tests pin the behaviour that has to be shared.
 */
import { describe, expect, it } from "vitest";
import {
  deriveTracesDisplay,
  isInFlight,
  TRACES_DISPLAY_STYLE,
  type TracesDisplayKey,
} from "@/lib/traces-status";

describe("isInFlight", () => {
  it.each(["QUEUED", "PROCESSING", "RETRYING"] as const)(
    "%s is still trying",
    (status) => expect(isInFlight(status)).toBe(true),
  );

  it.each(["SUBMITTED", "FAILED"] as const)(
    "%s is not",
    (status) => expect(isInFlight(status)).toBe(false),
  );
});

describe("deriveTracesDisplay — the two surfaces must agree", () => {
  it("reports a failed pipeline over the regulator's last known status", () => {
    // `poll.py._fail_business_rejection` sets `status=FAILED` and deliberately
    // leaves `traces_status` at SUBMITTED, and the row stops being swept.
    // Reading the regulator's status first said "Submitted" forever for a
    // submission nothing was polling — the exact ADR-0017 failure (a badge
    // that outlives the truth) this module exists to prevent, one level down.
    expect(deriveTracesDisplay({ status: "FAILED", traces_status: "SUBMITTED" })).toBe("failed");
  });

  it("still reports a TRACES verdict when our pipeline succeeded", () => {
    expect(deriveTracesDisplay({ status: "SUBMITTED", traces_status: "REJECTED" })).toBe("rejected");
  });

  it.each(["SUSPENDED", "UPDATED", "OBSOLETE"] as const)(
    "names %s, which the vendored schema allows and this map had no entry for",
    (status) => {
      // A missing entry derived to `null`, and the list then fell back to
      // `dds.status` — so an OBSOLETE filing read "Submitted".
      const key = deriveTracesDisplay({ status: "SUBMITTED", traces_status: status });
      expect(key).not.toBeNull();
      expect(TRACES_DISPLAY_STYLE[key!].label).toBe(
        status.charAt(0) + status.slice(1).toLowerCase(),
      );
    },
  );

  it("has a style for every display key it can return", () => {
    // The map is indexed without a fallback at both call sites, so a key with
    // no style is a crash, not a missing badge.
    const keys: TracesDisplayKey[] = [
      "submitting", "submitted", "available", "rejected", "failed",
      "withdrawn", "grouped", "archived", "suspended", "updated", "obsolete",
    ];
    for (const key of keys) expect(TRACES_DISPLAY_STYLE[key]).toBeDefined();
  });
});
