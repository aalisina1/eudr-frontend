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
    // Access token: 5-minute cookie (matches simplejwt default)
    Cookies.set(ACCESS_TOKEN_KEY, access, { secure: false, sameSite: "lax" });
    // Refresh token: 1-day cookie
    Cookies.set(REFRESH_TOKEN_KEY, refresh, {
      expires: 1,
      secure: false,
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
