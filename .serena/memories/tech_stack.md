# EUDR Frontend — Tech Stack

- **Framework**: Next.js 16.1.6 (App Router) + React 19.2, TypeScript 5.
- **Package manager**: npm (`package.json`, no pnpm/yarn lock convention here).
- **Data fetching**: @tanstack/react-query v5 over a typed REST client (`openapi-fetch`;
  types generated/maintained with `openapi-typescript`). Wrapper: `authFetch()` in
  `@/lib/api/client.ts` (JWT refresh on 401). Auth token via `js-cookie`.
- **Forms / validation**: react-hook-form + zod (`@hookform/resolvers`).
- **UI**: shadcn (v4) primitives on @base-ui/react, Tailwind CSS v4 (`@tailwindcss/postcss`),
  class-variance-authority + clsx + tailwind-merge, lucide-react icons, tw-animate-css.
- **Maps**: leaflet + react-leaflet (dynamic import, `ssr: false`).
- **Fonts/design**: DM Sans (body), Fraunces (italic display headings), forest/botanical
  palette, dark mode via class toggle.
- **Lint**: ESLint 9 + eslint-config-next.
- **Tests**: Vitest 4 + @testing-library/react + jsdom (~74 tests).
- **Build**: `next build` → standalone output. Dev server port 3000, expects backend on :8000.