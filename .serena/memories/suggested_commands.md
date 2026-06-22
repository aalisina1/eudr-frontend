# EUDR Frontend — Commands

Plain npm; runs on the host (no Docker requirement for the frontend).

```
npm install            # install deps
npm run dev            # dev server on :3000 (expects backend API on :8000)
npm test               # Vitest run (jsdom, ~74 tests)
npm run test:watch     # Vitest watch
npm run test:coverage  # coverage
npm run lint           # ESLint
npm run build          # production build (standalone output)
npm start              # serve production build
```

Type generation from backend OpenAPI is available via `openapi-typescript` (devDep) when
regenerating `src/lib/api/types.ts` — but note types are also maintained by hand to mirror
Django serializers (see `mem:core`). Darwin host; standard BSD shell utils.