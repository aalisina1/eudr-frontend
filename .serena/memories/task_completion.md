# EUDR Frontend — Definition of Done

Before considering a frontend coding task complete, run on the host:

1. **Lint**: `npm run lint` (ESLint 9 + eslint-config-next) — must be clean.
2. **Tests**: `npm test` (Vitest, jsdom). Use `renderWithProviders()` from
   `src/__tests__/helpers.tsx` (wraps QueryClient) and `mockPaginatedResponse()` for API mocks;
   setup file `src/__tests__/setup.ts` mocks next/navigation, IntersectionObserver, etc.
3. **Build**: `npm run build` must succeed (catches type errors and App Router issues that lint
   and unit tests miss).

If types were touched, verify `src/lib/api/types.ts` still matches the backend serializers
(manual sync — see `mem:conventions`). All three steps green = done.