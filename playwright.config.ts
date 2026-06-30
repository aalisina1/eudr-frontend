import { defineConfig, devices } from "@playwright/test";

/**
 * E2E suite for the EUDR frontend UI workflows.
 *
 * Expects a running stack:
 *   - frontend on http://localhost:3000 (auto-started below if not already up)
 *   - backend on http://localhost:8000 with seeded demo data (`seed_demo_data`)
 *
 * Auth: `auth.setup.ts` logs in once via the UI and saves storageState that the
 * `chromium` project reuses (cookie-based JWT — see frontend #16).
 */
const BASE_URL = process.env.BASE_URL ?? "http://localhost:3000";

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  reporter: [["list"], ["html", { open: "never" }]],
  timeout: 30_000,
  expect: { timeout: 10_000 },
  use: {
    baseURL: BASE_URL,
    trace: "on-first-retry",
    screenshot: "only-on-failure",
  },
  projects: [
    { name: "setup", testMatch: /auth\.setup\.ts/ },
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"], storageState: "e2e/.auth/user.json" },
      dependencies: ["setup"],
    },
  ],
  webServer: {
    command: "npm run dev",
    url: BASE_URL,
    reuseExistingServer: true,
    timeout: 120_000,
  },
});
