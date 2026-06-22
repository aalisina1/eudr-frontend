# EUDR Frontend — Source Map & Invariants

Next.js 16 (App Router) + React 19 dashboard for the EUDR compliance platform. Talks to the
Django backend over REST. See `CLAUDE.md` and `docs/ARCHITECTURE.md` (routing, data fetching
via `authFetch`, 4-tab integrations, component patterns) before non-trivial work.

## Layout (path alias `@/` → `src/`)
- `src/app/` — App Router. Route groups: `(auth)` (login), `(dashboard)` (authenticated).
  Detail pages: `/{entity}/[id]/page.tsx`. `layout.tsx`, `globals.css` at root.
- `src/components/` — UI; `ui/` holds shadcn primitives; `forms/` holds react-hook-form+zod
  examples; `data-table.tsx` is the shared list component.
- `src/lib/` — `api/` (client + types), `auth.ts`, `utils.ts`.
- `src/hooks/`, `src/providers/` (React Query etc.), `src/__tests__/` (setup + helpers).

## Invariants
- **`"use client"` on ALL interactive components**; server components only for layouts.
- **Always use `authFetch()`** from `@/lib/api/client.ts` for API calls — it handles JWT 401
  refresh. Never use raw `fetch()` for API calls.
- **`src/lib/api/types.ts` mirrors Django serializers and is kept in sync MANUALLY.** List
  serializers often omit fields (e.g. `Transformation.output_columns` is detail-only) — use
  optional chaining when iterating list results.
- **Integrations = 4 sibling tabs** on `/integrations` (Sources, Transformations, Mappings,
  Syncs), NOT an 8-step pipeline. Old `QueryStep`/`MapStep`/`PreviewStep`/`ReviewStep` were deleted.

See also `mem:tech_stack`, `mem:suggested_commands`, `mem:conventions`, `mem:task_completion`.