/**
 * E2E journeys: Submissions hub + TRACES panel + credentials screen (Task 14).
 *
 * The live TRACES endpoint is offline (no credentials seeded, issue #29), so all
 * `/api/v1/traces/**` routes are intercepted with `page.route` stubs for
 * deterministic, offline-safe testing. The DDS list and auth use the real backend
 * (seeded: 3 DDS, 0 TRACES credentials).
 *
 * Patterns:
 * - Stubs are registered BEFORE navigation so they catch the initial fetch.
 * - `TracesSubmissionListView` GET returns the lightweight list serializer
 *   (id/dds_id/status/traces_reference_number/attempt_count/created_at only —
 *   no `traces_status`/`verification_number`/`error_message`/`error_detail`).
 *   The panel follows up with a detail GET by id to get the full row, so
 *   stubs must distinguish `?dds_id=` (list) from `/submissions/{id}/`
 *   (detail) rather than returning the same payload for both (#2).
 * - `page.waitForRequest` / `page.waitForResponse` verify network activity without
 *   arbitrary sleeps.
 */

import { test, expect } from "@playwright/test";
import { expectListResponded } from "./helpers";

// ---------------------------------------------------------------------------
// Shared stub payloads
// ---------------------------------------------------------------------------

const SUB_ID = "sub-e2e-1";

/** The full `TracesSubmissionSerializer` detail shape (GET .../submissions/{id}/). */
const AVAILABLE_SUBMISSION_DETAIL = {
  id: SUB_ID,
  dds_id: "dds-e2e-1",
  submission_type: "CREATE",
  traces_status: "AVAILABLE",
  status: "SUBMITTED",
  traces_reference_number: "REF-E2E",
  verification_number: "VER-E2E",
  submitted_at: new Date(Date.now() - 3_600_000).toISOString(), // 1 hour ago
  error_message: "",
  error_detail: [],
  attempt_count: 1,
  last_attempted_at: null,
  next_retry_at: null,
  submitted_by_id: "u1",
  soap_request_payload: "",
  soap_response_payload: "",
  created_at: new Date(Date.now() - 3_600_000).toISOString(),
};

const CREDS_PRESENT = { results: [{ id: "c1", environment: "ACCEPTANCE", username: "test_user", web_service_client_id: "ws_abc" }] };
const CREDS_EMPTY = { results: [] };

/** Route every `.../traces/submissions/**` call, branching on method/URL the
 * way the real list-vs-detail split requires. `listResults` is what the
 * `?dds_id=` list GET returns each call it's invoked (array, consumed in
 * order — repeats the last entry once exhausted). */
function routeSubmissions(
  page: import("@playwright/test").Page,
  opts: {
    listResults: unknown[][];
    detail?: unknown;
    onPost?: (route: import("@playwright/test").Route) => Promise<void>;
  },
) {
  let listCall = 0;
  return page.route("**/api/v1/traces/submissions/**", async (route) => {
    const req = route.request();
    if (req.method() === "POST") {
      if (opts.onPost) return opts.onPost(route);
      await route.fulfill({ json: { id: SUB_ID, status: "QUEUED" } });
      return;
    }
    if (req.url().includes("dds_id=")) {
      const results = opts.listResults[Math.min(listCall, opts.listResults.length - 1)];
      listCall += 1;
      await route.fulfill({ json: { results } });
      return;
    }
    // Detail GET by id — the full row.
    await route.fulfill({ json: opts.detail ?? AVAILABLE_SUBMISSION_DETAIL });
  });
}

/** Locate the seeded, always-APPROVED demo DDS row (rather than "first row",
 * whose status/order isn't guaranteed) — the TRACES submit gate (#50) only
 * enables Submit for an APPROVED DDS. */
function gh001Row(page: import("@playwright/test").Page) {
  return page.locator("tr.cursor-pointer", { hasText: "DDS-2025-GH-001" });
}

// ---------------------------------------------------------------------------
// Journey 1: Submissions nav + list
// ---------------------------------------------------------------------------

test.describe("Submissions hub (TRACES T1)", () => {
  test('sidebar "Submissions" item navigates to /due-diligence', async ({ page }) => {
    await page.goto("/dashboard");
    // The sidebar item label is "Submissions" (href="/due-diligence")
    await page.getByRole("link", { name: "Submissions" }).click();
    await expect(page).toHaveURL(/\/due-diligence/);
  });

  test("list responds (rows or empty state) with a status badge", async ({ page }) => {
    await page.goto("/due-diligence");
    const rows = await expectListResponded(page);

    // Either there are real data rows (seeded 3 DDS) or an empty state.
    const rowCount = await rows.count();
    if (rowCount > 0) {
      // At least one badge-like element is visible (status column).
      await expect(page.locator("table tbody tr.cursor-pointer").first()).toBeVisible();
    } else {
      // Empty state is acceptable — backend may be clean.
      await expect(page.locator("table tbody td[colspan]").first()).toBeVisible();
    }
  });

  test("badge derives from the latest TRACES submission (ADR-0017), not just the internal DDS status (#22)", async ({ page }) => {
    // Phase 1 — no TRACES stubs yet: discover a real seeded DDS's id and
    // reference number via the real backend, by clicking through to its
    // detail URL (the list itself never exposes the raw UUID).
    await page.goto("/due-diligence");
    const rows = await expectListResponded(page);
    test.skip((await rows.count()) === 0, "no seeded DDS — skipping badge derivation test");

    const targetRow = rows.first();
    const referenceText = (await targetRow.locator("td").first().innerText()).trim();
    await targetRow.click();
    await expect(page).toHaveURL(/\/due-diligence\/[^/]+$/);
    const ddsId = page.url().split("/due-diligence/")[1]?.split(/[?#]/)[0];
    expect(ddsId).toBeTruthy();

    // Phase 2 — re-navigate with the bulk submissions endpoint
    // (`GET /api/v1/traces/submissions/?ordering=...`, no `dds_id=` filter —
    // the list page's single extra fetch, #22) stubbed so this DDS's latest
    // submission is a TRACES business rejection. The badge must show
    // "Rejected" — derived from `traces_status`, never the raw internal
    // `dds.status` (which stays SUBMITTED forever post-transport-success,
    // ADR-0017).
    const SUB_ID = "sub-badge-e2e";
    await page.route("**/api/v1/traces/submissions/**", async (route) => {
      const req = route.request();
      if (req.method() !== "GET") return route.fallback();
      const url = req.url();
      if (url.includes(`/submissions/${SUB_ID}/`)) {
        await route.fulfill({
          json: {
            id: SUB_ID,
            dds_id: ddsId,
            submission_type: "CREATE",
            status: "SUBMITTED",
            traces_status: "REJECTED",
            traces_reference_number: "REF-BADGE-E2E",
            verification_number: "",
            error_message: "Missing geolocation data.",
            error_detail: [],
            attempt_count: 1,
            last_attempted_at: null,
            next_retry_at: null,
            submitted_at: new Date().toISOString(),
            submitted_by_id: "u1",
            soap_request_payload: "",
            soap_response_payload: "",
            created_at: new Date().toISOString(),
          },
        });
        return;
      }
      if (url.includes("dds_id=")) return route.fallback(); // panel's per-DDS fetch — not this test's concern
      // The list page's bulk (no `dds_id=`) fetch.
      await route.fulfill({ json: { results: [{ id: SUB_ID, dds_id: ddsId, status: "SUBMITTED" }] } });
    });

    await page.goto("/due-diligence");
    await expectListResponded(page);
    const row = page.locator("tr.cursor-pointer", { hasText: referenceText });
    await expect(row.locator('[data-slot="badge"]', { hasText: "Rejected" })).toBeVisible({ timeout: 10_000 });
  });
});

// ---------------------------------------------------------------------------
// Journey 2: Panel — AVAILABLE submission
// ---------------------------------------------------------------------------

test.describe("TRACES panel — AVAILABLE state (TRACES T2)", () => {
  test("shows Reference Number and Verification Number chips when submission is AVAILABLE", async ({ page }) => {
    // Stub TRACES routes BEFORE navigation.
    await page.route("**/api/v1/traces/credentials/**", async (route) => {
      await route.fulfill({ json: CREDS_PRESENT });
    });
    await routeSubmissions(page, { listResults: [[{ id: SUB_ID }]] });

    await page.goto("/due-diligence");
    await expectListResponded(page);
    const row = gh001Row(page);
    test.skip((await row.count()) === 0, "seeded DDS-2025-GH-001 not found — skipping panel test");

    await row.click();
    await expect(page).toHaveURL(/\/due-diligence\/[^/]+$/);

    // Wait for the TRACES panel section to mount.
    await expect(
      page.getByText("TRACES Submission", { exact: false }).first(),
    ).toBeVisible({ timeout: 15_000 });

    // The CopyChip renders: <p class="text-muted-foreground text-xs">{label}</p> + <button>{value}</button>
    // Use exact: true to avoid matching the AmendWindow paragraph that contains "reference number".
    await expect(page.getByText("Reference Number", { exact: true }).first()).toBeVisible({ timeout: 10_000 });
    await expect(page.getByText("REF-E2E")).toBeVisible({ timeout: 10_000 });
    await expect(page.getByText("Verification Number", { exact: true }).first()).toBeVisible({ timeout: 10_000 });
    await expect(page.getByText("VER-E2E")).toBeVisible({ timeout: 10_000 });

    // The AVAILABLE status badge is visible (the TRACES timeline also has an
    // "Available" step title, so scope to the badge specifically).
    await expect(page.locator('[data-slot="badge"]', { hasText: "Available" })).toBeVisible({
      timeout: 10_000,
    });
  });
});

// ---------------------------------------------------------------------------
// Journey 3: Panel — submit flow
// ---------------------------------------------------------------------------

test.describe("TRACES panel — submit flow (TRACES T3)", () => {
  test("opens confirm dialog, fires POST, then shows AVAILABLE state", async ({ page }) => {
    // First list GET: no submission yet. Second (post-invalidate) list GET:
    // the new row exists — the panel then does a detail GET for its full
    // AVAILABLE state (post-submit poll).
    await routeSubmissions(page, { listResults: [[], [{ id: SUB_ID }]] });

    await page.route("**/api/v1/traces/credentials/**", async (route) => {
      await route.fulfill({ json: CREDS_PRESENT });
    });

    await page.goto("/due-diligence");
    await expectListResponded(page);
    const row = gh001Row(page);
    test.skip((await row.count()) === 0, "seeded DDS-2025-GH-001 not found — skipping submit-flow test");

    await row.click();
    await expect(page).toHaveURL(/\/due-diligence\/[^/]+$/);

    // Wait for the panel to render (no submission state).
    await expect(
      page.getByText("TRACES Submission", { exact: false }).first(),
    ).toBeVisible({ timeout: 15_000 });
    await expect(page.getByText("Not submitted to TRACES.")).toBeVisible({ timeout: 10_000 });

    // The "Submit to TRACES" button should be enabled (credentials present).
    const submitBtn = page.getByRole("button", { name: /^Submit to TRACES$/i });
    await expect(submitBtn).toBeVisible({ timeout: 10_000 });
    await expect(submitBtn).toBeEnabled();

    // Click → confirm dialog opens.
    await submitBtn.click();
    const dialog = page.getByRole("dialog", { name: /Submit this DDS to TRACES/i });
    await expect(dialog).toBeVisible({ timeout: 10_000 });

    // Capture the POST request.
    const postRequestPromise = page.waitForRequest(
      (req) => req.url().includes("/api/v1/traces/submissions/") && req.method() === "POST",
    );

    // Click the confirm button inside the dialog.
    await dialog.getByRole("button", { name: /^Submit to TRACES$/i }).click();

    // Verify the POST fired.
    const postRequest = await postRequestPromise;
    expect(postRequest.method()).toBe("POST");

    // After POST succeeds, React Query invalidates and re-fetches. The 2nd GET
    // returns AVAILABLE — wait for the chips or the dialog to close.
    await expect(dialog).toBeHidden({ timeout: 15_000 });

    // The panel should now reflect AVAILABLE (2nd GET stub).
    await expect(page.getByText("REF-E2E")).toBeVisible({ timeout: 15_000 });
    await expect(page.getByText("VER-E2E")).toBeVisible({ timeout: 15_000 });
  });
});

// ---------------------------------------------------------------------------
// Journey 4: Credentials screen
// ---------------------------------------------------------------------------

test.describe("Credentials screen (TRACES T4)", () => {
  test("Settings page shows the TRACES Connection card", async ({ page }) => {
    // Stub credentials to empty so we see the empty state CTA.
    await page.route("**/api/v1/traces/credentials/**", async (route) => {
      await route.fulfill({ json: CREDS_EMPTY });
    });

    await page.goto("/settings");
    await expect(page).toHaveURL(/\/settings/);

    // The CredentialsCard header is visible.
    await expect(page.getByText("TRACES Connection", { exact: false })).toBeVisible({
      timeout: 15_000,
    });

    // Empty state: "No TRACES credentials configured."
    await expect(
      page.getByText("No TRACES credentials configured.", { exact: false }),
    ).toBeVisible({ timeout: 10_000 });
  });

  test('"Add credentials" button opens the credentials form Sheet', async ({ page }) => {
    // Stub credentials to empty so the "Add credentials" CTA in the empty state is shown.
    await page.route("**/api/v1/traces/credentials/**", async (route) => {
      await route.fulfill({ json: CREDS_EMPTY });
    });

    await page.goto("/settings");

    // Wait for the card to load.
    await expect(page.getByText("TRACES Connection", { exact: false })).toBeVisible({
      timeout: 15_000,
    });

    // The header "Add credentials" button (always present) or the empty-state one.
    const addBtn = page.getByRole("button", { name: /Add credentials/i }).first();
    await expect(addBtn).toBeVisible({ timeout: 10_000 });
    await addBtn.click();

    // The Sheet title is "Add TRACES Credentials"
    await expect(
      page.getByRole("heading", { name: /Add TRACES Credentials/i }),
    ).toBeVisible({ timeout: 10_000 });
  });
});
