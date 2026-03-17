import { describe, it, expect, beforeEach } from "vitest";
import { auth } from "@/lib/auth";

describe("auth module", () => {
  beforeEach(() => {
    auth.clearTokens();
  });

  it("starts with no tokens", () => {
    expect(auth.getAccessToken()).toBeUndefined();
    expect(auth.getRefreshToken()).toBeUndefined();
  });

  it("isAuthenticated returns false without tokens", () => {
    expect(auth.isAuthenticated()).toBe(false);
  });

  it("setTokens stores access and refresh tokens", () => {
    auth.setTokens("access-123", "refresh-456");
    expect(auth.getAccessToken()).toBe("access-123");
    expect(auth.getRefreshToken()).toBe("refresh-456");
  });

  it("isAuthenticated returns true after setTokens", () => {
    auth.setTokens("a", "r");
    expect(auth.isAuthenticated()).toBe(true);
  });

  it("clearTokens removes all tokens", () => {
    auth.setTokens("a", "r");
    auth.clearTokens();
    expect(auth.getAccessToken()).toBeUndefined();
    expect(auth.getRefreshToken()).toBeUndefined();
    expect(auth.isAuthenticated()).toBe(false);
  });
});
