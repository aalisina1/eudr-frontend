# Frontend Roadmap

Tracks what's shipped versus what's planned. The integrations 4-tab restructure is the most recent major work.

## Shipped

### Priority 1 — Search, filter, pagination
- Reusable `DataTable` (`src/components/data-table.tsx`) — debounced search, multi-filter, sortable columns, pagination, CSV export.
- Applied to Suppliers, Supply Chains, Due Diligence, Documents.
- Plots list is client-side filtered because all plots are loaded for the map.

### Priority 2 — CRUD forms
- `supplier-form.tsx` — create/edit.
- `plot-form.tsx` — create with GeoJSON paste.
- `batch-form.tsx` — create/edit.
- `dds-form.tsx` — create/edit + state actions (submit / approve / reject / withdraw / delete).
- `document-form.tsx` — create/edit with full metadata.

### Priority 3 — Detail pages
- Suppliers, Plots, Supply Chains, Due Diligence — info card + related collections + edit/delete.
- Plot detail embeds a Leaflet map of the geometry.
- All list pages navigate to detail on row click.

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

### Testing
- 13 Vitest suites: API client, auth, types, utils, DataTable, AppSidebar, and page-level smoke tests for the major routes.

### CI + Docker
- `.github/workflows/ci.yml` runs lint + build (build includes type-check).
- Multi-stage Dockerfile, standalone Next.js output, node:22-alpine runner.

## Planned

### Near-term
- **Role-aware UI** — hide/disable actions based on `user.role` (ADMIN / COMPLIANCE_OFFICER / VIEWER / SUPPLIER_CONTACT). Today every role sees every button.
- **`SUPPLIER_CONTACT` portal scope** — once the backend ships object-level permissions, surface only the supplier's own plots / batches / docs.
- **Sync schedules UI** — `IngestionSchedule` exists on the backend; surface a cron editor in the Sources tab.
- **Inline error toasts** — currently most errors render in-place. A consistent toast/snackbar pattern would unify the feedback.

### Medium-term
- **Draw-on-map plot creation** — today plots are created via GeoJSON paste. Adding draw tools (Leaflet.draw) would close the loop for non-technical users.
- **Plot clustering + satellite tiles** — current map is a single tile layer with raw markers.
- **PDF export of DDS** — depends on a backend renderer.
- **Connector config UIs for FarmForce, AS400, SFTP, REST API, Webhook** — backend stubs exist; UI only handles SQL Server config well.
- **Custom target definition UI** — even though the backend removed `CustomTargetDefinition` in the 4-domain restructure, a future generalisation may bring it back; if so, build it as a tab inside Mappings.

### Longer-term
- **Notifications dropdown** — backend ships notification CRUD + read actions; the UI doesn't surface them yet.
- **Audit log viewer** — backend has `/audit/logs/`; build a "history" panel on entity detail pages.
- **Webhook management UI** — backend has CRUD; needs an Admin Settings sub-page.
- **Bulk DDS generation** — UI for selecting multiple batches and producing DDS records at once.

## How to add work

1. New page → use the `new-page` skill.
2. New form → use the `new-form` skill (Sheet + react-hook-form + zod pattern).
3. New endpoint shape → run `sync-types` after the backend serializer change is merged.
4. Use `DataTable` for every list. Don't roll a one-off table.
5. Use `authFetch`, not raw `fetch`.
6. `npm run lint && npm run build && npm test` before opening a PR — CI runs lint + build.
7. Update `ARCHITECTURE.md` if the page tree or component pattern changes, and this roadmap when shipping anything user-visible.
