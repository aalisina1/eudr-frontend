import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import Cookies from "js-cookie";
import { auth } from "@/lib/auth";

vi.mock("js-cookie", () => ({
  default: { set: vi.fn(), get: vi.fn(), remove: vi.fn() },
}));

const setProtocol = (protocol: string) => {
  Object.defineProperty(window, "location", {
    value: { ...window.location, protocol },
    writable: true,
  });
};

describe("auth cookie flags", () => {
  beforeEach(() => vi.clearAllMocks());
  afterEach(() => setProtocol("http:"));

  it("marks cookies Secure when served over HTTPS", () => {
    // Without this, a 24-hour refresh token may be sent over plaintext HTTP.
    setProtocol("https:");
    auth.setTokens("access-token", "refresh-token");

    for (const call of vi.mocked(Cookies.set).mock.calls) {
      expect(call[2]).toMatchObject({ secure: true });
    }
  });

  it("does not mark cookies Secure on plain HTTP, so local dev still works", () => {
    setProtocol("http:");
    auth.setTokens("access-token", "refresh-token");

    for (const call of vi.mocked(Cookies.set).mock.calls) {
      expect(call[2]).toMatchObject({ secure: false });
    }
  });

  it("still sets both tokens", () => {
    setProtocol("https:");
    auth.setTokens("access-token", "refresh-token");
    expect(Cookies.set).toHaveBeenCalledTimes(2);
  });
});
