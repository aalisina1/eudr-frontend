# E2E tests (Playwright)

End-to-end browser journeys that verify the UI workflows respond to the use cases
documented in `eudr-vault/10-Specs/UI-Workflows/`. Complements the Vitest unit
suite (it doesn't replace it) — this drives the real app in a browser.

## Prerequisites (a running stack)

- **Backend** on `http://localhost:8000` with seeded demo data:
  `docker compose exec -T web python manage.py seed_demo_data`
  (seeds orgs, role users, suppliers, plots, DDS, docs — password `canopy2025`).
- **Frontend** on `http://localhost:3000`. Playwright will start `npm run dev`
  itself if it isn't already up (`reuseExistingServer`).

## Run

```bash
npm run test:e2e          # headless, all journeys
npm run test:e2e:ui       # Playwright UI mode (debug)
npx playwright show-report
```

First run only: `npx playwright install chromium`.

## How it's structured

- `auth.setup.ts` logs in once via the real login form and saves `storageState`
  (cookie-based JWT); specs reuse it. `01-auth.spec.ts` runs unauthenticated.
- One spec per workflow (`02-suppliers` … `09-settings`), mapped to the inventory
  IDs (B1, E1/E2, …). `helpers.ts` holds seeded creds + `expectListResponded`.
- Coverage is **as-built** (the 9 shipped workflows). The TRACES submission flow
  (`dds-traces-submission.md`) is a forward design — add its journeys when it ships.

## Notes

- List "responds" = real data rows (`tr.cursor-pointer`) **or** an empty state —
  never an infinite spinner (a quality bar from Objectives.md).
- DDS lifecycle controls are intentionally state-gated; the spec asserts the
  detail renders and its lifecycle state is reflected (action button or status).

## TRACES stubs (`page.route`)

`10-submissions.spec.ts` covers the Submissions hub + TRACES panel + credentials
screen. Because the live TRACES endpoint is offline (no credentials, issue #29),
all `/api/v1/traces/**` routes are intercepted with `page.route` stubs:

- **Register stubs BEFORE `page.goto()`** so they catch the initial fetch.
- **Stateful stubs**: a closure counter tracks call order so the first GET returns
  the pre-submit state (empty or pending) and subsequent GETs return post-submit
  state (AVAILABLE), mimicking the real polling behaviour without timers.
- **POST interception**: `page.waitForRequest` captures the outbound submit call
  to assert it fired; the stub returns a queued state that the next GET resolves.
- **Locator strictness**: `getByText(label, { exact: true }).first()` is needed
  when the same word appears in multiple elements (e.g., "Reference Number" in
  both the CopyChip label and the AmendWindow paragraph).
