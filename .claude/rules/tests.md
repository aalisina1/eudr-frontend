---
paths: ["src/__tests__/**"]
---

- Vitest + `@testing-library/react` + jsdom
- Use `renderWithProviders()` from `__tests__/helpers.tsx` (wraps QueryClientProvider)
- Mock `fetch` with `vi.fn()` in `beforeEach`, restore original in `afterEach`
- Use `mockPaginatedResponse()` helper for API responses
- Mocks for `next/navigation` and `next/link` are already set up in `setup.ts`
- Test user-facing behavior, not implementation details
- Test files go in `src/__tests__/` (utils, auth, api-client) or `src/__tests__/pages/` (page tests)
