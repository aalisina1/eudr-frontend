# Canopy EUDR Frontend

Next.js 16 (App Router) + React 19 for the EUDR compliance platform.

## Documentation

Read these before non-trivial work:

- [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) — routing, data fetching (`authFetch`), 4-tab integrations, component patterns
- [docs/ROADMAP.md](docs/ROADMAP.md) — shipped + planned (role scoping, draw-on-map, notifications dropdown, audit viewer)

Project-wide context is single-sourced in the Obsidian vault (see also the
umbrella `../CLAUDE.md`, which auto-loads here):

- `../eudr-vault/00-Index/Objectives.md` — EUDR compliance requirements, target users, quality bars, non-objectives
- `../eudr-vault/00-Index/Workflow.md` — how work ships (issues, branches, PRs, releases)

## Commands

- `npm run dev` — dev server (port 3000, expects backend on :8000)
- `npm test` — Vitest (74 tests, jsdom)
- `npm run lint` — ESLint
- `npm run build` — production build (standalone output)

## Critical Rules

- **"use client"** on ALL interactive components. Server components only for layouts.
- **Use `authFetch()`** from `@/lib/api/client.ts` for ALL API calls — handles JWT 401 refresh automatically. Never use raw `fetch()` for API calls.
- **Types** in `src/lib/api/types.ts` mirror Django serializers — keep in sync manually. List serializers often omit fields (e.g. `Transformation.output_columns` is detail-only); use optional chaining when iterating list results.
- **Leaflet maps**: dynamic import (`ssr: false`), z-index 1100 for overlays above map, `requestAnimationFrame` for post-layout sizing.
- **Path alias**: `@/` maps to `src/`
- **Integrations is 4 tabs, not an 8-step pipeline**: Sources, Transformations, Mappings, Syncs (sibling tabs on `/integrations`). Old `QueryStep` / `MapStep` / `PreviewStep` / `ReviewStep` components were deleted. Source detail page handles ingestion only.

## Patterns

- **List pages**: Use `DataTable` from `@/components/data-table.tsx` (search, filters, sorting, pagination, CSV export)
- **Forms**: react-hook-form + zod in `Sheet` slide-overs — see `src/components/forms/` for examples
- **Detail pages**: `/{entity}/[id]/page.tsx`, use `useParams()` + React Query `useQuery`
- **React Query**: keys `[resourceName, params]`, staleTime 60s, invalidate related queries on mutation success
- **UI**: shadcn primitives in `src/components/ui/`, lucide-react icons, Tailwind CSS v4
- **Styling**: Forest/botanical palette, DM Sans (body), Fraunces (italic display headings), dark mode via class toggle
- **Route groups**: `(auth)` for login, `(dashboard)` for authenticated pages

## Testing

- Vitest + @testing-library/react + jsdom
- Setup file: `src/__tests__/setup.ts` (mocks next/navigation, IntersectionObserver, etc.)
- Use `renderWithProviders()` from `src/__tests__/helpers.tsx` (wraps QueryClient)
- Use `mockPaginatedResponse()` helper for API response mocks
