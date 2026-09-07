import { test, expect } from "@playwright/test";
import { CREDENTIALS, login } from "./helpers";

/**
 * Organisation administration (eudr-frontend #135/#149/#158, eudr-app
 * #218/#222, ADR-0028).
 *
 * #158 moved this out of `/settings`, which had been holding a personal profile
 * and organisation-level TRACES config under one name. Administration is now
 * its own sidebar section with a route per topic, shown only to administrators.
 */

const ADMIN_NAV = ["People", "Groups", "Policies", "TRACES"];

test.describe("Administration: the nav", () => {
  test("an administrator gets the section, with a route each", async ({ page }) => {
    await login(page, CREDENTIALS.admin);
    await page.goto("/dashboard");

    const sidebar = page.getByRole("navigation").or(page.locator("[data-slot=sidebar]")).first();
    await expect(page.getByText("Administration", { exact: true }).first()).toBeVisible();

    for (const label of ADMIN_NAV) {
      await expect(sidebar.getByRole("link", { name: label })).toBeVisible();
    }
  });

  for (const [who, creds] of [
    ["a compliance officer", CREDENTIALS.compliance],
    ["a viewer", CREDENTIALS.viewer],
  ] as const) {
    test(`${who} never sees the section`, async ({ page }) => {
      await login(page, creds);
      await page.goto("/dashboard");

      await expect(page.getByText("Dashboard").first()).toBeVisible();
      // Absent from the DOM, not disabled.
      await expect(page.getByText("Administration", { exact: true })).toHaveCount(0);
    });
  }

  test("/administration lands on People rather than a bare index", async ({ page }) => {
    await login(page, CREDENTIALS.admin);
    await page.goto("/administration");

    await expect(page).toHaveURL(/\/administration\/people/);
  });

  test("a non-administrator reaching the URL is told why, not bounced silently", async ({
    page,
  }) => {
    await login(page, CREDENTIALS.viewer);
    await page.goto("/administration/people");

    await expect(page.getByText("Administration is for administrators")).toBeVisible();
    await expect(page.getByRole("link", { name: "Go to your settings" })).toBeVisible();
  });
});

test.describe("Administration: the pages", () => {
  test.beforeEach(async ({ page }) => {
    await login(page, CREDENTIALS.admin);
  });

  test("People shows where each role comes from", async ({ page }) => {
    await page.goto("/administration/people");

    await expect(page.getByRole("heading", { name: "People" })).toBeVisible();
    await expect(page.getByText("granted directly").first()).toBeVisible();
    await expect(page.getByText(/A link works once and expires/)).toBeVisible();
  });

  test("Groups offers three roles and never supplier contact", async ({ page }) => {
    await page.goto("/administration/groups");

    await page.getByRole("button", { name: "New group" }).click();
    const roleSelect = page.getByLabel("Role granted");
    await expect(roleSelect.locator("option")).toHaveCount(3);
    await expect(roleSelect.locator('option[value="SUPPLIER_CONTACT"]')).toHaveCount(0);

    const name = `E2E auditors ${Date.now()}`;
    await page.getByLabel("Name").fill(name);
    await roleSelect.selectOption("VIEWER");
    await page.getByRole("button", { name: "Create group" }).click();

    await expect(page.getByText(name)).toBeVisible();
  });

  test("Policies states the rules that are actually enforced", async ({ page }) => {
    await page.goto("/administration/policies");

    await expect(page.getByRole("heading", { name: "Policies" })).toBeVisible();
    await expect(
      page.getByText("The organisation always keeps an administrator"),
    ).toBeVisible();
    await expect(page.getByText("You cannot demote or deactivate yourself")).toBeVisible();
  });

  test("TRACES config lives here now, not on Settings (#158)", async ({ page }) => {
    // The replacement path for the journey #158 moved. Settings used to carry
    // the TRACES connection and operator identity; both are organisation-level
    // and admin-gated, so they belong under Administration.
    await page.goto("/administration/traces");

    // level 1: the credentials card also carries a "TRACES" heading.
    await expect(page.getByRole("heading", { name: "TRACES", level: 1 })).toBeVisible();
    await expect(page.getByText(/operator identity/i).first()).toBeVisible();
  });
});

test.describe("Settings is personal, and the same for everyone", () => {
  for (const [who, creds] of [
    ["an administrator", CREDENTIALS.admin],
    ["a compliance officer", CREDENTIALS.compliance],
    ["a viewer", CREDENTIALS.viewer],
  ] as const) {
    test(`${who} sees the same settings page`, async ({ page }) => {
      await login(page, creds);
      await page.goto("/settings");

      await expect(page.getByText("Profile", { exact: true })).toBeVisible();
      await expect(
        page.getByText("Your account. Organisation settings live under Administration."),
      ).toBeVisible();
      // The page's shape no longer depends on your role.
      await expect(page.getByText("Administration", { exact: true })).toHaveCount(0);
    });
  }
});

test.describe("Administration: inviting someone", () => {
  test("invite, copy the link, and accept it in a fresh session", async ({ page, browser }) => {
    await login(page, CREDENTIALS.admin);
    await page.goto("/administration/people");

    const email = `e2e-invitee-${Date.now()}@example.com`;
    await page.getByRole("button", { name: "Invite" }).click();
    await page.getByLabel("Email address").fill(email);
    await page.getByLabel("Role").selectOption("VIEWER");
    await page.getByRole("button", { name: "Create invitation" }).click();

    const link = page.locator("text=/\\/invite\\//").first();
    await expect(link).toBeVisible();
    const acceptUrl = (await link.textContent())!.trim();
    await page.getByRole("button", { name: "Done" }).click();
    await expect(page.getByText(email)).toBeVisible();

    const invitee = await browser.newContext();
    const inviteePage = await invitee.newPage();
    await inviteePage.goto(acceptUrl);

    await expect(inviteePage.getByRole("heading", { name: /^Join / })).toBeVisible();
    await inviteePage.getByLabel("First name").fill("E2E");
    await inviteePage.getByLabel("Last name").fill("Invitee");
    await inviteePage.getByLabel("Choose a password").fill("an-Excellent-Passw0rd!");
    await inviteePage.getByRole("button", { name: "Accept invitation" }).click();

    await inviteePage.waitForURL((url) => !url.pathname.includes("/invite/"), {
      timeout: 20_000,
    });
    await expect(inviteePage).not.toHaveURL(/\/login/);

    await page.reload();
    await expect(page.getByText(email).first()).toBeVisible();

    await invitee.close();
  });

  test("a dead invitation link explains itself", async ({ browser }) => {
    const context = await browser.newContext();
    const anonymous = await context.newPage();

    await anonymous.goto("/invite/00000000-0000-4000-8000-000000000000");

    await expect(anonymous.getByText("This link has expired")).toBeVisible();
    await expect(anonymous.getByLabel("Choose a password")).toHaveCount(0);

    await context.close();
  });
});
