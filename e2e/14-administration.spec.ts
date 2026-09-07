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

const ADMIN_NAV = ["Users", "Groups", "Policies", "Integrations", "TRACES"];

test.describe("Administration: the nav", () => {
  test("Admin sits at the bottom, and opens a context of its own", async ({ page }) => {
    await login(page, CREDENTIALS.admin);
    await page.goto("/dashboard");

    // Bottom of the sidebar, next to Settings: somewhere you go occasionally,
    // not a peer of the daily work.
    const adminEntry = page.getByRole("link", { name: "Admin", exact: true });
    await expect(adminEntry).toBeVisible();
    await expect(page.getByText("Sourcing")).toBeVisible();

    await adminEntry.click();
    await expect(page).toHaveURL(/\/administration\/users/);

    // The sidebar has swapped: admin options in, everyday nav out.
    for (const label of ADMIN_NAV) {
      await expect(page.getByRole("link", { name: label, exact: true })).toBeVisible();
    }
    await expect(page.getByText("Sourcing")).toHaveCount(0);
    await expect(page.getByRole("link", { name: /Back to / })).toBeVisible();
  });

  test("and the way back returns you to the app", async ({ page }) => {
    await login(page, CREDENTIALS.admin);
    await page.goto("/administration/groups");

    await page.getByRole("link", { name: /Back to / }).click();

    await expect(page).toHaveURL(/\/dashboard/);
    await expect(page.getByText("Sourcing")).toBeVisible();
  });

  test("Integrations is part of the admin context, not a flip back to the app", async ({
    page,
  }) => {
    await login(page, CREDENTIALS.admin);
    await page.goto("/integrations");

    await expect(page.getByRole("link", { name: "Policies", exact: true })).toBeVisible();
    await expect(page.getByText("Sourcing")).toHaveCount(0);
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
      await expect(page.getByRole("link", { name: "Admin", exact: true })).toHaveCount(0);
    });
  }

  test("/administration lands on Users rather than a bare index", async ({ page }) => {
    await login(page, CREDENTIALS.admin);
    await page.goto("/administration");

    await expect(page).toHaveURL(/\/administration\/users/);
  });

  test("a non-administrator reaching the URL is told why, not bounced silently", async ({
    page,
  }) => {
    await login(page, CREDENTIALS.viewer);
    await page.goto("/administration/users");

    await expect(page.getByText("Administration is for administrators")).toBeVisible();
    await expect(page.getByRole("link", { name: "Go to your settings" })).toBeVisible();
  });
});

test.describe("Administration: the pages", () => {
  test.beforeEach(async ({ page }) => {
    await login(page, CREDENTIALS.admin);
  });

  test("Users offers add, deactivate and groups, and no per-user role", async ({ page }) => {
    await page.goto("/administration/users");

    await expect(page.getByRole("heading", { name: "Users" })).toBeVisible();
    await expect(page.getByText(/A link works once and expires/)).toBeVisible();

    // Access is changed by moving someone between groups (#174), so every row
    // offers that, and nothing offers a role.
    await expect(page.getByRole("button", { name: "Groups" }).first()).toBeVisible();
    await expect(page.getByRole("button", { name: /Deactivate|Reactivate/ }).first()).toBeVisible();
    await expect(page.getByRole("combobox", { name: /role/i })).toHaveCount(0);
  });

  test("assigning a user to a group is done from the user", async ({ page }) => {
    await page.goto("/administration/users");

    await page.getByRole("button", { name: "Groups" }).first().click();

    await expect(page.getByText(/Everything this person can do comes from the groups/)).toBeVisible();
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

  test("Policies reads as a catalogue attached to groups, never to people", async ({
    page,
  }) => {
    await page.goto("/administration/policies");

    await expect(page.getByRole("heading", { name: "Policies" })).toBeVisible();
    // exact: the Compliance policy lists "Everything Read only grants" too.
    await expect(page.getByText("Read only", { exact: true })).toBeVisible();
    await expect(page.getByText("Compliance", { exact: true })).toBeVisible();
    // Each policy says which groups carry it. That is the whole model on one page.
    await expect(page.getByText("Carried by").first()).toBeVisible();
    await expect(page.getByText("Always enforced")).toBeVisible();
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
    await page.goto("/administration/users");

    const email = `e2e-invitee-${Date.now()}@example.com`;
    await page.getByRole("button", { name: "Invite" }).click();
    await page.getByLabel("Email address").fill(email);
    // "Who is this", not a role: a policy attaches to a group (#174).
    await expect(page.getByLabel("Who is this")).toBeVisible();
    await expect(page.getByLabel("Role")).toHaveCount(0);
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
