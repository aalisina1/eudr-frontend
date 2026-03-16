import createClient from "openapi-fetch";
import { auth } from "@/lib/auth";

const BASE_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

// Typed fetch wrapper — call apiClient.GET("/api/v1/suppliers/suppliers/", { ... })
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const apiClient = createClient<any>({ baseUrl: BASE_URL });

// Attach Authorization header and handle 401 → refresh → retry
apiClient.use({
  async onRequest({ request }) {
    const token = auth.getAccessToken();
    if (token) {
      request.headers.set("Authorization", `Bearer ${token}`);
    }
    return request;
  },

  async onResponse({ response, request }) {
    if (response.status !== 401) return response;

    const refresh = auth.getRefreshToken();
    if (!refresh) {
      auth.clearTokens();
      window.location.href = "/login";
      return response;
    }

    // Attempt token refresh
    const refreshRes = await fetch(`${BASE_URL}/api/v1/auth/jwt/refresh/`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ refresh }),
    });

    if (!refreshRes.ok) {
      auth.clearTokens();
      window.location.href = "/login";
      return response;
    }

    const { access } = await refreshRes.json();
    auth.setTokens(access, refresh);

    // Retry original request with new token
    request.headers.set("Authorization", `Bearer ${access}`);
    return fetch(request);
  },
});

// ─── Auth helpers ─────────────────────────────────────────────────────────────

/**
 * Authenticated fetch with automatic token refresh on 401.
 * Use this instead of raw `fetch` for API calls.
 */
export async function authFetch(path: string, init?: RequestInit): Promise<Response> {
  const url = `${BASE_URL}${path}`;
  const headers = new Headers(init?.headers);
  const token = auth.getAccessToken();
  if (token) headers.set("Authorization", `Bearer ${token}`);

  let res = await fetch(url, { ...init, headers });

  if (res.status === 401) {
    const refresh = auth.getRefreshToken();
    if (!refresh) {
      auth.clearTokens();
      window.location.href = "/login";
      return res;
    }

    const refreshRes = await fetch(`${BASE_URL}/api/v1/auth/jwt/refresh/`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ refresh }),
    });

    if (!refreshRes.ok) {
      auth.clearTokens();
      window.location.href = "/login";
      return res;
    }

    const { access } = await refreshRes.json();
    auth.setTokens(access, refresh);
    headers.set("Authorization", `Bearer ${access}`);
    res = await fetch(url, { ...init, headers });
  }

  return res;
}

export async function login(email: string, password: string) {
  const res = await fetch(`${BASE_URL}/api/v1/auth/jwt/create/`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password }),
  });
  if (!res.ok) throw new Error("Invalid credentials");
  return res.json() as Promise<{ access: string; refresh: string }>;
}

export async function fetchMe() {
  const res = await authFetch("/api/v1/auth/users/me/");
  if (!res.ok) throw new Error("Unauthorized");
  return res.json();
}
