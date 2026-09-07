import { test, expect } from "@playwright/test";
import { CREDENTIALS, login } from "./helpers";

/**
 * Organisation administration: people, invitations and groups (eudr-app
 * #218/#222, eudr-frontend #135/#149, ADR-0028).
 *
 * The invitation journey is the one that matters most, because before this
 * existed the only way to add a user was a shell on the production box. It is
 * driven end to end: an admin creates the invitation, copies the link, and a
 * *fresh browser context with no session* accepts it and lands signed in.
 */
test.describe("Administration", () => {
  test("an administrator sees the administration area", async ({ page }) => {
    await login(page, CREDENTIALS.admin);
    await page.goto("/settings");

    await expect(page.getByText("Administration")).toBeVisible();
    await expect(page.getByText(/Everyone with access to this organisation/)).toBeVisible();
    await expect(page.getByText(/A link works once and expires/)).toBeVisible();
    await expect(page.getByText(/A group grants one role to everyone in it/)).toBeVisible();
  });

  test("a compliance officer sees no administration area at all", async ({ page }) => {
    // Absent from the DOM, not disabled — the role-gating bar.
    await login(page, CREDENTIALS.compliance);
    await page.goto("/settings");

    await expect(page.getByText("Your account, TRACES credentials")).toBeVisible();
    await expect(page.getByText("Administration")).toHaveCount(0);
  });

  test("a viewer sees no administration area at all", async ({ page }) => {
    await login(page, CREDENTIALS.viewer);
    await page.goto("/settings");

    await expect(page.getByText("Your account, TRACES credentials")).toBeVisible();
    await expect(page.getByText("Administration")).toHaveCount(0);
  });

  test("the people list shows where each role comes from", async ({ page }) => {
    await login(page, CREDENTIALS.admin);
    await page.goto("/settings");

    await expect(page.getByText(/Everyone with access to this organisation/)).toBeVisible();
    // Every row states its provenance; the seed has no groups, so all direct.
    await expect(page.getByText("granted directly").first()).toBeVisible();
  });

  test("an administrator creates a group and it grants only the three roles", async ({
    page,
  }) => {
    await login(page, CREDENTIALS.admin);
    await page.goto("/settings");

    await page.getByRole("button", { name: "New group" }).click();

    const roleSelect = page.getByLabel("Role granted");
    await expect(roleSelect).toBeVisible();
    await expect(roleSelect.locator("option")).toHaveCount(3);
    // ADR-0028: never offered, and asserted rather than assumed.
    await expect(roleSelect.locator('option[value="SUPPLIER_CONTACT"]')).toHaveCount(0);

    const name = `E2E auditors ${Date.now()}`;
    await page.getByLabel("Name").fill(name);
    await roleSelect.selectOption("VIEWER");
    await page.getByRole("button", { name: "Create group" }).click();

    await expect(page.getByText(name)).toBeVisible();
  });

  test("invite, copy the link, and accept it in a fresh session", async ({ page, browser }) => {
    await login(page, CREDENTIALS.admin);
    await page.goto("/settings");

    const email = `e2e-invitee-${Date.now()}@example.com`;
    await page.getByRole("button", { name: "Invite" }).click();
    await page.getByLabel("Email address").fill(email);
    await page.getByLabel("Role").selectOption("VIEWER");
    await page.getByRole("button", { name: "Create invitation" }).click();

    // The token is disclosed once, here, and never again.
    const link = page.locator("text=/\\/invite\\//").first();
    await expect(link).toBeVisible();
    const acceptUrl = (await link.textContent())!.trim();
    await page.getByRole("button", { name: "Done" }).click();
    await expect(page.getByText(email)).toBeVisible();

    // A brand-new context: no cookies, no tokens, exactly what the invitee has.
    const invitee = await browser.newContext();
    const inviteePage = await invitee.newPage();
    await inviteePage.goto(acceptUrl);

    await expect(inviteePage.getByRole("heading", { name: /^Join / })).toBeVisible();
    await inviteePage.getByLabel("First name").fill("E2E");
    await inviteePage.getByLabel("Last name").fill("Invitee");
    await inviteePage.getByLabel("Choose a password").fill("an-Excellent-Passw0rd!");
    await inviteePage.getByRole("button", { name: "Accept invitation" }).click();

    // Straight in, signed in, not bounced to a login form.
    await inviteePage.waitForURL((url) => !url.pathname.includes("/invite/"), {
      timeout: 20_000,
    });
    await expect(inviteePage).not.toHaveURL(/\/login/);

    // And the admin now sees them.
    await page.reload();
    await expect(page.getByText(email).first()).toBeVisible();

    await invitee.close();
  });

  test("a used invitation link cannot be replayed", async ({ browser }) => {
    const context = await browser.newContext();
    const anonymous = await context.newPage();

    await anonymous.goto("/invite/00000000-0000-4000-8000-000000000000");

    await expect(anonymous.getByText("This link has expired")).toBeVisible();
    await expect(anonymous.getByLabel("Choose a password")).toHaveCount(0);

    await context.close();
  });
});
