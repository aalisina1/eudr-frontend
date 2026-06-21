import { describe, it, expect } from "vitest";
import { getErrorMessage } from "@/lib/api/errors";

describe("getErrorMessage", () => {
  it("extracts `detail` from a DRF-style error body", () => {
    expect(getErrorMessage({ detail: "Not found." })).toBe("Not found.");
  });

  it("extracts `error` when `detail` is absent", () => {
    expect(getErrorMessage({ error: "Promotion failed" })).toBe(
      "Promotion failed"
    );
  });

  it("prefers `detail` over `error` when both are present", () => {
    expect(
      getErrorMessage({ detail: "Detail message", error: "Error message" })
    ).toBe("Detail message");
  });

  it("joins DRF field-validation errors into one message", () => {
    expect(
      getErrorMessage({ name: ["This field is required."], mapping: ["Invalid pk."] })
    ).toBe("This field is required., Invalid pk.");
  });

  it("extracts message from a thrown Error instance", () => {
    expect(getErrorMessage(new Error("Failed to trigger sync"))).toBe(
      "Failed to trigger sync"
    );
  });

  it("returns the string directly when given a plain string", () => {
    expect(getErrorMessage("Network unreachable")).toBe("Network unreachable");
  });

  it("falls back to a generic message for an empty object", () => {
    expect(getErrorMessage({})).toBe("Something went wrong. Please try again.");
  });

  it("falls back to a generic message for null/undefined", () => {
    expect(getErrorMessage(null)).toBe("Something went wrong. Please try again.");
    expect(getErrorMessage(undefined)).toBe(
      "Something went wrong. Please try again."
    );
  });

  it("falls back to a generic message when detail/error are not strings", () => {
    expect(getErrorMessage({ detail: 123 })).toBe(
      "Something went wrong. Please try again."
    );
  });

  it("ignores blank detail and falls through to error", () => {
    expect(getErrorMessage({ detail: "   ", error: "Real error" })).toBe(
      "Real error"
    );
  });
});
