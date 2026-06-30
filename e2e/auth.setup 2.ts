import { test as setup, expect } from "@playwright/test";
import { CREDENTIALS, login } from "./helpers";

const authFile = "e2e/.auth/user.json";

/** Log in once as the compliance officer and persist storageState for reuse. */
setup("authenticate", async ({ page }) => {
  await login(page, CREDENTIALS.compliance);
  // Landed somewhere authenticated (dashboard or a workflow page), not login.
  await expect(page).not.toHaveURL(/\/login/);
  await page.context().storageState({ path: authFile });
});
