import Cookies from "js-cookie";

const ACCESS_TOKEN_KEY = "eudr_access";
const REFRESH_TOKEN_KEY = "eudr_refresh";

export const auth = {
  getAccessToken(): string | undefined {
    return Cookies.get(ACCESS_TOKEN_KEY);
  },

  getRefreshToken(): string | undefined {
    return Cookies.get(REFRESH_TOKEN_KEY);
  },

  setTokens(access: string, refresh: string) {
    // Secure whenever the page itself is served over TLS. Hardcoding `false`
    // let a 24-hour refresh token travel over plaintext HTTP once deployed to
    // a real domain; hardcoding `true` would break local dev, which has no TLS.
    //
    // This is one line of ADR-0003, not the whole of it: these cookies are
    // still readable by JavaScript. The HttpOnly redesign is gated separately.
    const secure =
      typeof window !== "undefined" && window.location.protocol === "https:";

    // Access token: 5-minute cookie (matches simplejwt default)
    Cookies.set(ACCESS_TOKEN_KEY, access, { secure, sameSite: "lax" });
    // Refresh token: 1-day cookie
    Cookies.set(REFRESH_TOKEN_KEY, refresh, {
      expires: 1,
      secure,
      sameSite: "lax",
    });
  },

  clearTokens() {
    Cookies.remove(ACCESS_TOKEN_KEY);
    Cookies.remove(REFRESH_TOKEN_KEY);
  },

  isAuthenticated(): boolean {
    return !!Cookies.get(ACCESS_TOKEN_KEY) || !!Cookies.get(REFRESH_TOKEN_KEY);
  },
};
