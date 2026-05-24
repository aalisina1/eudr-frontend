# Frontend Architecture

## Overview

Next.js 16 (App Router) + React 19 dashboard for the Canopy EUDR compliance platform. Server runs in standalone mode behind Docker; all data fetching goes through a JWT-aware `authFetch` wrapper. No global state library — TanStack Query owns server state, local state stays local.

## Tech Stack

| Layer | Choice |
|-------|--------|
| Framework | Next.js 16 (App Router, Turbopack) |
| UI library | React 19 |
| Styling | Tailwind CSS 4 + shadcn/base-ui primitives |
| Icons | lucide-react |
| Forms | react-hook-form + zod + @hookform/resolvers |
| Server state | @tanstack/react-query 5 (+ devtools) |
| Typed fetch | openapi-fetch |
| Maps | Leaflet + react-leaflet |
| Code editor | react-simple-code-editor + prismjs (SQL highlighting) |
| Auth | js-cookie (`eudr_access` / `eudr_refresh`) |
| Tests | Vitest + jsdom + @testing-library/react |
| Lint | ESLint + Next preset |
| Build target | Standalone Node output, Docker multi-stage on node:22-alpine |

## Repo Layout

```
src/
  app/
    (auth)/login/                 Public login route
    (dashboard)/                  Authenticated routes
      dashboard/                  Home + charts
      suppliers/      [id]/       List + detail
      plots/          [id]/       List + detail
      supply-chains/  [id]/       List + detail
      due-diligence/  [id]/       List + detail
      documents/      [id]/       List + detail
      integrations/   [sourceId]/ List + source detail (ingestion flow)
      data-import/                Legacy CSV upload (kept for migration)
      settings/                   User profile + theme
      layout.tsx                  Sidebar + theme + query client wrap
  components/
    forms/                        CRUD Sheets (supplier, plot, batch, dds, document, source)
    integrations/                 sources-tab, transformations-tab, mappings-tab, syncs-tab (4-domain UI)
    ui/                           shadcn primitives (button, card, sheet, dialog, table, …)
    data-table.tsx                Reusable list view: search, filter, sort, paginate, CSV export
    app-sidebar.tsx               Nav, dark/light toggle, logout
    land-plot-map.tsx             Leaflet wrapper
  lib/
    api/
      client.ts                   authFetch + openapi-fetch instance + token refresh
      types.ts                    Shared TypeScript types matching backend serializers
    auth.ts                       Cookie read/write + isAuthenticated helper
  __tests__/                      Vitest suites mirroring src tree
public/                           Static assets
next.config.ts                    output: "standalone"
Dockerfile                        Multi-stage: deps → builder → runner (node:22-alpine)
```

## Routing

App Router with two route groups:

- `(auth)` — unauthenticated. Only `/login`.
- `(dashboard)` — authenticated. Wraps every page in the sidebar layout + React Query provider.

Each compliance entity follows the same pattern:

```
/<entity>/             list page (DataTable, search, filters, "Create" Sheet)
/<entity>/[id]/        detail page (info card, related collections, edit/delete)
```

Detail pages always use `useParams()` + `useQuery({ queryKey: ["<entity>", id] })`.

## Data fetching

All API calls go through `authFetch` in `src/lib/api/client.ts`:

- Attaches `Authorization: Bearer <access>` from cookies.
- On 401, attempts a refresh against `/api/v1/auth/jwt/refresh/`, retries the original request once, and falls back to `/login` if the refresh also fails.
- Returns the raw `Response` so callers can `.json()` or `.text()` as needed.

React Query config:
- `staleTime: 60_000`
- `retry: 1`
- Devtools enabled in development.

## Auth

- Login form posts to `/api/v1/auth/jwt/create/`, stores tokens in cookies:
  - `eudr_access` — 5 min
  - `eudr_refresh` — 24 h
- `auth.isAuthenticated()` checks for a refresh cookie; layout guards redirect to `/login` if missing.
- No auth context — components read cookies through `auth.ts` helpers and React Query keys.

## Integrations (4-tab restructure)

The `/integrations` page is split into four sibling tabs, each backed by its own component:

| Tab | Component | What it does |
|-----|-----------|-------------|
| **Sources** | `integrations/page.tsx` (`SourcesContent` sub-component) | Cards for every `DataSource` with connection status badge. Click → `/integrations/[sourceId]` to run Configure → Discover → Select → Ingest. |
| **Transformations** | `transformations-tab.tsx` | SQL editor (Prism.js) with schema sidebar. Create, edit, validate. |
| **Mappings** | `mappings-tab.tsx` | Three sub-modes: `list` (cards), `edit` (config: name, target type, source object or transformation), `fields` (per-column rules with auto-map). |
| **Syncs** | `syncs-tab.tsx` | List configs, "Run Now", browse `SyncJob`s, review `SyncRecord`s (approve/reject/promote). |

The four tabs map 1:1 to the backend's 4 data_integration domains. The source detail page (`[sourceId]/page.tsx`) only handles ingestion — transformation, mapping, and syncs live in their tabs.

## Form pattern

All CRUD forms in `src/components/forms/` follow the same shape:

- shadcn `Sheet` slide-over (right side).
- `useForm` from react-hook-form with `zodResolver`.
- One component handles both create and edit (`mode: "create" | "edit"` prop).
- Submit calls `useMutation` and on success invalidates the matching list query.

Files: `supplier-form.tsx`, `plot-form.tsx`, `batch-form.tsx`, `dds-form.tsx`, `document-form.tsx`, `source-form.tsx`.

## Reusable building blocks

- **DataTable** (`data-table.tsx`) — debounced search, multi-filter, sortable columns, pagination, CSV export, click-row navigation. Drives every list page.
- **AppSidebar** (`app-sidebar.tsx`) — grouped nav ("Main", "Compliance"), theme toggle, logout. Active state from `usePathname()`.
- **LandPlotMap** — Leaflet wrapper for plot detail. z-index 1100 so it doesn't shoot above Sheet overlays.

## Theme

CSS-class toggle (`html.dark`), no `ThemeProvider`. Initial class applied via inline `<script>` in `app/layout.tsx` so dark mode never flashes. State persisted in `localStorage["theme"]`.

## Testing

Vitest + jsdom + @testing-library/react. 13 test files covering:

- API client (`authFetch`, refresh flow)
- Auth helpers
- Types contract checks
- `DataTable`, `AppSidebar`
- Page-level smoke tests: dashboard, suppliers, documents, due-diligence, supply-chains, settings, integrations

Run: `npm test` / `npm run test:watch` / `npm run test:coverage`.

## Build & deploy

- `npm run dev` — Turbopack on :3000.
- `npm run build` — production build (TypeScript + lint pass required).
- `npm start` — Node server.
- Dockerfile is multi-stage: deps → build → standalone runner on node:22-alpine, runs `server.js` on :3000.
- CI (`.github/workflows/ci.yml`): lint + build (build implicitly runs type-check).

## Conventions

- **One source of truth for types** — `src/lib/api/types.ts` mirrors backend serializers exactly. When backend serializers change, update this file in the same PR. (See `sync-types` skill.)
- **No prop-drilling auth** — read from cookies via `auth.ts`.
- **Never bypass authFetch** — even one-off calls go through it so 401 refresh works uniformly.
- **List endpoints use the list serializer shape** — be careful: list responses often omit fields (e.g. `Transformation.output_columns` is detail-only). Use optional chaining when iterating list results.
- **Sheet z-index** — Leaflet maps need to stay below Sheet overlays; the existing `z-1100` on the map container is intentional.
