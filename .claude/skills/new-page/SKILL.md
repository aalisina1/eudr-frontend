---
name: new-page
description: Create a new dashboard page following Canopy project patterns
argument-hint: [page-name]
allowed-tools: Read, Write, Edit, Glob
---

Create a new page at `src/app/(dashboard)/$ARGUMENTS/page.tsx`:

1. Read an existing page (e.g., `suppliers/page.tsx`) for pattern reference
2. Add `"use client"` directive
3. Use `authFetch()` for data fetching via React Query `useQuery`
4. For list pages: use `DataTable` component with column definitions, filters, and query key
5. For detail pages: use `useParams()` to get ID, Card layout for info sections
6. Add navigation item in `src/components/app-sidebar.tsx` with appropriate lucide-react icon
7. Add types to `src/lib/api/types.ts` if the backend returns new data shapes
8. Add a test in `src/__tests__/pages/` using `renderWithProviders()` and mocked fetch
