---
paths: ["src/app/**/*.tsx"]
---

- Route groups: `(auth)` for login, `(dashboard)` for authenticated pages
- List pages use `DataTable` with: fetchFn, columns, filters, queryKey
- Detail pages at `/[entity]/[id]/page.tsx` use `useParams()` + React Query `useQuery`
- Always wrap data fetching in React Query `useQuery` / `useMutation`
- Use `authFetch()` for all API calls, never raw `fetch()`
- Add `"use client"` directive — all dashboard pages are client components
