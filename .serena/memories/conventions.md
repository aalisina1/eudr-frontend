# EUDR Frontend — Conventions

- **Client vs server**: `"use client"` on every interactive component; reserve server
  components for layouts.
- **API access**: only through `authFetch()` (`@/lib/api/client.ts`). Types in
  `src/lib/api/types.ts` mirror Django serializers, synced manually; list responses may omit
  detail-only fields — guard with optional chaining.
- **List pages**: use `DataTable` from `@/components/data-table.tsx` (search, filters, sorting,
  pagination, CSV export).
- **Forms**: react-hook-form + zod inside `Sheet` slide-overs; patterns in `src/components/forms/`.
- **Detail pages**: `/{entity}/[id]/page.tsx` using `useParams()` + React Query `useQuery`.
- **React Query**: query keys `[resourceName, params]`, `staleTime` 60s, invalidate related
  queries on mutation success.
- **UI/styling**: shadcn primitives in `src/components/ui/`, lucide-react icons, Tailwind v4.
  Forest/botanical palette; DM Sans body, Fraunces italic display headings; dark mode via class toggle.
- **Routing**: route groups `(auth)` and `(dashboard)`. Path alias `@/` → `src/`.
- **Leaflet**: dynamic import with `ssr: false`; overlays at z-index 1100 above the map;
  use `requestAnimationFrame` for post-layout sizing.
- **Integrations** vocabulary: 4 sibling tabs (Sources/Transformations/Mappings/Syncs), never
  the old step-pipeline components.