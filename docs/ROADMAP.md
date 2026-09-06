# Frontend Roadmap

Tracks what's shipped versus what's planned. Milestones v0.1.0 through v0.3.1 are complete; v0.3.2 Visual Identity is the wave in flight.

**Planned work is organised by milestone, not by horizon.** `horizon:*` labels are deprecated — the milestone carries roadmap distance and `priority:*` carries queue order.

## Shipped

### Priority 1 — Search, filter, pagination
- Reusable `DataTable` (`src/components/data-table.tsx`) — debounced search, multi-filter, sortable columns, pagination, CSV export.
- Applied to Suppliers, Supply Chains, Due Diligence, Documents.
- Plots list is client-side filtered over whatever the page fetched. ⚠️ It asks for `?limit=100` against a `PageNumberPagination` API that ignores `limit`, so it receives **20** plots and both the list and the map silently truncate there — #137. The same root cause affects every `DataTable`: `limit`/`offset` are ignored, so page N returns page 1 and CSV export returns 20 rows (#67).

### Priority 2 — CRUD forms
- `supplier-form.tsx` — create/edit.
- `plot-form.tsx` — create with GeoJSON paste.
- `batch-form.tsx` — create/edit.
- `dds-form.tsx` — create/edit + state actions (submit / approve / reject / withdraw / delete).
- `document-form.tsx` — create/edit with full metadata.

### Priority 3 — Detail pages
- Suppliers, Plots, Supply Chains, Due Diligence — info card + related collections + edit/delete.
- Plot detail embeds a Leaflet map of the geometry.
- Most list pages navigate to detail on row click. ⚠️ **Plots does not** — the card's `onClick` only selects the plot on the map, and the only link to `/plots/[id]` anywhere in the app is on DDS detail (#133).

### Priority 4 — Document management
- `/documents` list with type/archived/confidential filters.
- `/documents/[id]` detail with version history table, archive action, delete.

### Priority 5 — Dashboard charts
- SVG donut chart (DDS by status) + bar chart (plot validation status).
- No third-party charting library.

### Priority 6 — Theming + settings
- Dark mode toggle in sidebar, flash-free init, persisted in `localStorage`.
- `/settings` page for profile.

### Priority 7 — Auth + token refresh
- `authFetch` with 401 → refresh → retry → login fallback.
- Cookie-based access/refresh tokens.

### Priority 8 — Data Integration v1
- `/integrations` source cards with type badge, connection status, schema count.
- `/integrations/[sourceId]` step-by-step pipeline (originally 6 steps).
- `source-form.tsx` Sheet with dynamic config per source type.

### Priority 9 — Transform Pipeline v2
- Expanded the pipeline to 8 steps with extracted components: QueryStep (SQL editor), MapStep (auto-map + custom targets), PreviewStep, ReviewStep.
- Prismjs syntax highlighting in the SQL editor.

### Integrations 4-tab restructure (most recent)
- Replaced the 8-step monolith with 4 tabs: Sources, Transformations, Mappings, Syncs.
- Source detail page reduced to ingestion only (Configure → Discover → Select → Ingest).
- New components: `transformations-tab.tsx`, `mappings-tab.tsx`, `syncs-tab.tsx`.
- Deleted: `query-step.tsx`, `map-step.tsx`, `preview-step.tsx`, `review-step.tsx`.
- Mappings tab now preloads target fields as rows, auto-matches by name, and lists source columns from the configured source object.
- Field mapping sends `default_value: ""` (not null) to satisfy the backend serializer.

### Production Ingestion surface (v0.1.0 frontend trio, merged 2026-06-21)
- **Shared error toasts** (#8) — single root `sonner` Toaster + `getErrorMessage` helper; success/error toasts on CRUD + sync/ingest triggers across the integrations tabs. `authFetch`'s contract is unchanged; the helper is called at call sites.
- **Schedule editor** (#7) — a Schedule step on the source detail page: presets dropdown + editable raw cron (`src/lib/cron.ts` via cronstrue + cron-parser, enforcing the backend's 5-field rule), live validation + human-readable preview, timezone, last/next run, pause/resume. `PUT sources/<id>/schedule/`.
- **Run-now + run status** (#9) — `SourceCard` shows each source's latest ingestion run as a badge (Running/Completed/Failed), polled every 3s while RUNNING, plus a Run-now button (`POST sources/<id>/ingest/`).

### TRACES Submission surface (v0.2.0 frontend, merged 2026-07-12)
The frontend half of the TRACES round-trip. Ships the three v0.2.0 FE surfaces. The round-trip is now **live-verified**: `DDS-2025-GH-001` submitted through this UI as the compliance officer reached **AVAILABLE** on live TRACES acceptance (2026-07-14; ref `26FREQVKTA7K2V`). v0.2.0's success criterion is MET; the milestone closes on the formal design-partner demo + retro (see the backend roadmap's "TRACES round-trip (v0.2.0)" and vault `Current Milestone.md`).

- **DDS-detail TRACES panel** (#2, PRs #35 + #40) — the round-trip demo surface: Submit-to-TRACES action + submission timeline across Not-submitted / Submitting / RETRYING / AVAILABLE / REJECTED / Locked states, derived from the detail serializer's `traces_status`. #40 aligned the in-flight state set with ADR-0017 (RETRYING is in-flight). Design: `dds-traces-submission.design-prompt.md`.
- **TRACES Connection Settings** (#17, PR #34) — admin UI for `TracesCredential` + operator identity (EORI + authorised-representative), write-only secret. Design: `dds-traces-submission.design-prompt.md` (ADMIN credentials variant).
- **Submissions-hub list** (#22, PR #37) — the shipped DDS list reframed to surface TRACES status; list badge derives from the latest submission's regulator state. Carries the **Due Diligence → Submissions** nav rename (Submissions half). Referenced-statements card deliberately OUT (v0.5.0 / ADR-0015).
- Known follow-ups filed from this work (v0.2.0 demo-readiness / v0.2.1 cleanup): #36 (COMPLIANCE_OFFICER Submit disabled — credentials pre-check hits an admin-only endpoint; v0.2.0), #41 (single source of truth for in-flight states), #33 (types.ts `Batch` drift), #39 (e2e locator collision).

### Sourcing readiness surface (v0.2.1, merged 2026-07-16 · milestone closed 2026-09-06)
The compliance-officer reframe's Phase 2 and 3, all five screens over the backend readiness endpoint.
- **Sourcing list** (#28) — readiness stages, tonnes coverage bars, deadline sort.
- **PO Detail** (#29) — coverage funnel, "what's blocking readiness" checklist, gated File DDS CTA with a keyboard-reachable explanation when it is disabled.
- **Dashboard worklist** (#30) — Needs filing / Needs remediation / Awaiting data; retired the charts.
- **Supplier Detail** (#31) — sourcing coverage and data-gap additions.
- **File DDS composition** (#26) — prefill from a PO, payload meter, split by shipment, 72-hour lock dialog.
- Retro: `eudr-vault/50-Retros/v0.2.1-sourcing-readiness.md`.

### Shipments surface (v0.3.0, merged 2026-07-30 · milestone closed 2026-09-06)
- **Shipments list** (#64) and **detail** (#66) — RAG and tracking badges, manual lot assignment, compose a DDS from a consignment.
- **Port map** (ADR-0025) — Leaflet map plus a "Currently at <port>" readout, degrading to "No location yet"; a "Held at" column on the list.
- **Reference ledger** (#74) — copyable TRACES chips, customs reference capture, CSV export, on `/shipments/[id]`.
- **Assign plots to a lot** (#78) — the Sheet that closed the "Complete plots" dead end. Every such CTA used to land on the `/plots` list with no assign path and no way back.
- **Plot identity** (#83) — plots became distinguishable in pickers and lists (`PLOT-000412` plus the source's own code), per ADR-0026.
- **23 Playwright journeys** covering `shipments.md`'s 13 acceptance criteria across four roles, plus the map.
- Retro: `eudr-vault/50-Retros/v0.3.0-shipment-readiness.md`.

### Product identity (v0.3.1, merged 2026-09-06)
The app read as a generic EUDR tool. Spec: vault `10-Specs/product-voice-and-identity.md`; enforcement decision ADR-0027.

- **Brand chrome** (#115, PR #123) — `src/lib/brand.ts` is the single definition of the product name (four competing descriptors existed because nothing defined it once); the real Grovetrace mark replaces three stock lucide glyphs; the stock Next.js favicon is gone.
- **Login + shared strings** (#116, #117, PR #123) — the hero opens on a customs deadline rather than an ESG tagline; `DataTable` and `getErrorMessage` defaults state the specific fact instead of "Something went wrong".
- **Copy sweep + CI gate** (#118, #119, PR #124) — 52 em dashes out of copy, en-GB throughout, 39 `toLocale*` calls behind `src/lib/format.ts` pinned to en-GB (and date-only values in UTC, fixing a latent previous-day bug). **`eslint-rules/grovetrace-voice.mjs` gates all of it** in `npm run lint`, with `RuleTester` proving each check reds. Left open: #120 (comment em dashes), #121 (route/label mismatch).

### Visual identity (v0.3.2, merged 2026-09-06)
The research inverted its own brief: a good design system already existed in `globals.css` (full light + dark palettes, a derived radius scale, a card-elevation idiom) and 704 arbitrary-value utilities bypassed it. The wave made every bypass either fixed or un-bypassable, and forked no primitive — the "no custom design system" non-objective stood throughout. Spec: vault `10-Specs/visual-identity.md`.

- **Semantic status tokens** (#125, PR #131) — the NEGLIGIBLE badge's hardcoded `text-[#1A6B5A]` measured **2.12:1** in dark mode; `success`/`warning`/`pending`/`info` pairs now clear AA on their tint in both themes, held by `status-token-contrast.test.ts`.
- **Typography dials** (#130, PR #138) — Fraunces' `WONK`/`SOFT` axes were in the font file, switched off; now loaded and held as tokens. Display face carried through Sheet/Dialog titles via the primitives; `tabular-nums` the `TableCell` default.
- **One type scale** (#126, PR #139) — xs 11 / sm 13 / base 15 in `@theme`, replacing 13 arbitrary sizes (six half-pixel). A `2xs` step was tried and rejected by the test's own 1px-gap check.
- **Token gate** (#128, PR #141) — `eslint-rules/grovetrace-tokens.mjs`: no hex in a utility, no arbitrary font size, no literal shadow. Found 33 hexes in `.ts` status maps every prior `*.tsx` grep had missed.
- **Radius rule** (#127, PR #143) — stated in `.claude/rules/components.md` (radius steps up with nesting depth); 61 usages reconciled. Corrected the spec: the distribution was flat only in aggregate, 73–100% consistent per element kind.

Left open from the identity wave, re-homed: #121 → v0.3.3 (it is a flow-legibility item); #120 → unmilestoned.

### Testing
- 18 Vitest suites: API client, auth, types, utils, DataTable, AppSidebar, cron helpers, integrations (syncs/schedule/source-card), and page-level smoke tests for the major routes.

### CI + Docker
- `.github/workflows/ci.yml` runs lint + build (build includes type-check).
- Multi-stage Dockerfile, standalone Next.js output, node:22-alpine runner.
- `issue-link` fails any PR with no closing keyword and no `no-issue` label.
- The Playwright journeys run against a real backend on every PR, in this repo and on backend PRs. Both e2e jobs fail on zero passes **or any skip**, so a suite that quietly stops testing cannot go green.

## Planned

### In flight

- **v0.3.3 Flow Legibility** — the screens exist; the paths between them do not.
  - **#132** — four of nine sourcing blockers offer a "Fix" button that scrolls to a read-only table. The backend already accepts every field they name, so the fix is a lot-edit Sheet.
  - **#133** — plot detail is unreachable from the Land Plots list.
  - **#134** — the plot → lot → PO → shipment chain is invisible; cross-link the detail screens. The deep lineage visualisation stays at v0.4.0 (#24).
  - **#84** — the remaining context-free remediation CTAs.
  - **#121** — `/due-diligence` is labelled "Submissions" and `/supply-chains` "Sourcing"; the URL is visible in every demo. Needs a redirect decision (`/data-import` already redirects).
### Next

- **v0.3.4 Operational Readiness** — running it for real.
  - **#135** — no user administration at all; Settings shows only your own profile, and `accounts/users` has never been called. Depends on eudr-app#218 for invitations.
  - **#67** and **#137** — the paging defects above. Both silently truncate today.
  - **#136** — Settings reports a hardcoded version `0.1.0`, three milestones out of date.

### Later

- **v0.4.0 Geospatial Maturity** — #19 (surface deforestation validation results and plot triage), #24 (end-to-end lineage view: plots → co-ops and processors → DDS), #4 (draw-on-map, clustering, satellite tiles), #79 (contextual `/plots?assignTo=<lotId>` map-based selection).
- **v0.5.0 DDS Production-Ready** — #25 (risk assessment → mitigation → sign-off UI, over endpoints the backend already has), #5 (PDF UI and bulk DDS generation).
- **v0.6.0 Operational Visibility** — #6, the notifications dropdown, audit-log viewer and webhook management, all over backend surfaces that already exist.
- **v0.7.0 Role-Aware Access** — #3, role-aware UI and the `SUPPLIER_CONTACT` portal scope. Today every role sees every button; the backend's admin-only checks surface as a 403 toast rather than a hidden control.

### Unmilestoned, still true

- **Connector config UIs** — #18 (FarmForce, priority:high: the backend connector is live but a person cannot configure it without a management command). AS400, SFTP and Webhook remain backend stubs, so their UIs wait on the backend.
- **#20** — decide whether commodities and products get a dedicated management UI or stay batch-embedded.
- **#45** — remove the committed macOS-duplicate e2e spec files.
- **#120** — 393 em dashes in code comments. No user impact; deferred from v0.3.1 so the copy diff stayed readable. Lands as a pure-noise diff whenever convenient.

## How to add work

1. New page → use the `new-page` skill.
2. New form → use the `new-form` skill (Sheet + react-hook-form + zod pattern).
3. New endpoint shape → run `sync-types` after the backend serializer change is merged.
4. Use `DataTable` for every list. Don't roll a one-off table.
5. Use `authFetch`, not raw `fetch`.
6. `npm run lint && npm run build && npm test` before opening a PR — CI runs lint + build.
7. Update `ARCHITECTURE.md` if the page tree or component pattern changes, and this roadmap when shipping anything user-visible.
