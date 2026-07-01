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
