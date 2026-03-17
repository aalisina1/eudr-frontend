import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { auth } from "@/lib/auth";

// We test authFetch and login by mocking global fetch
describe("API client", () => {
  const originalFetch = globalThis.fetch;

  beforeEach(() => {
    auth.clearTokens();
    // Prevent window.location.href assignments from failing in jsdom
    Object.defineProperty(window, "location", {
      writable: true,
      value: { href: "" },
    });
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  describe("login", () => {
    it("returns tokens on successful login", async () => {
      globalThis.fetch = vi.fn().mockResolvedValueOnce(
        new Response(
          JSON.stringify({ access: "tok-a", refresh: "tok-r" }),
          { status: 200 }
        )
      );

      // Re-import to get fresh module with mocked fetch
      const { login } = await import("@/lib/api/client");
      const result = await login("user@example.com", "password");
      expect(result).toEqual({ access: "tok-a", refresh: "tok-r" });
    });

    it("throws on invalid credentials", async () => {
      globalThis.fetch = vi.fn().mockResolvedValueOnce(
        new Response(JSON.stringify({ detail: "Invalid" }), { status: 401 })
      );

      const { login } = await import("@/lib/api/client");
      await expect(login("bad@example.com", "wrong")).rejects.toThrow(
        "Invalid credentials"
      );
    });
  });

  describe("authFetch", () => {
    it("attaches authorization header when token exists", async () => {
      auth.setTokens("my-token", "my-refresh");

      globalThis.fetch = vi.fn().mockResolvedValueOnce(
        new Response(JSON.stringify({ ok: true }), { status: 200 })
      );

      const { authFetch } = await import("@/lib/api/client");
      await authFetch("/api/v1/test/");

      expect(globalThis.fetch).toHaveBeenCalledTimes(1);
      const call = (globalThis.fetch as ReturnType<typeof vi.fn>).mock.calls[0];
      const headers = call[1]?.headers as Headers;
      expect(headers.get("Authorization")).toBe("Bearer my-token");
    });

    it("attempts token refresh on 401", async () => {
      auth.setTokens("expired-token", "valid-refresh");

      globalThis.fetch = vi
        .fn()
        // First call: 401
        .mockResolvedValueOnce(
          new Response(JSON.stringify({}), { status: 401 })
        )
        // Refresh call: success
        .mockResolvedValueOnce(
          new Response(
            JSON.stringify({ access: "new-token" }),
            { status: 200 }
          )
        )
        // Retry: success
        .mockResolvedValueOnce(
          new Response(JSON.stringify({ data: "ok" }), { status: 200 })
        );

      const { authFetch } = await import("@/lib/api/client");
      const res = await authFetch("/api/v1/protected/");
      expect(res.status).toBe(200);
      expect(globalThis.fetch).toHaveBeenCalledTimes(3);
    });

    it("redirects to login when refresh fails", async () => {
      auth.setTokens("expired", "bad-refresh");

      globalThis.fetch = vi
        .fn()
        .mockResolvedValueOnce(
          new Response(JSON.stringify({}), { status: 401 })
        )
        .mockResolvedValueOnce(
          new Response(JSON.stringify({}), { status: 401 })
        );

      const { authFetch } = await import("@/lib/api/client");
      await authFetch("/api/v1/protected/");
      expect(window.location.href).toBe("/login");
    });
  });
});
