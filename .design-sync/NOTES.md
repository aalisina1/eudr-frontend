# design-sync notes — eudr-frontend (Canopy Design System)

This repo is a **Next.js 16 app**, not a published component-library package. There
is no built `dist/`/`.d.ts`, so the converter runs in **synth-entry mode** (it
synthesizes a bundle entry from `src/components` and derives the component list from
PascalCase value exports via ts-morph).

## Setup quirks (how the build is wired)

- **Self-symlink** `node_modules/eudr-frontend -> ..` makes `PKG_DIR` resolve to the
  app root (the converter computes `PKG_DIR = <node-modules>/<pkg>`; an app never
  self-installs). Gitignored; **recreate on a fresh clone**:
  `ln -sfn .. node_modules/eudr-frontend`.
- `--node-modules` points at `<app>/node_modules` (where react/react-dom live).
- `cfg.srcDir = "src/components"` scopes synth discovery to the design system, not
  app pages/hooks/lib.
- `cfg.tsconfig = tsconfig.json` so esbuild resolves the `@/* -> src/*` path alias.

## Styling — Tailwind v4

- Tokens are CSS variables in `src/app/globals.css` (`@theme inline` + `:root` —
  "warm parchment botanical" / forest palette), but the **utility classes are
  generated at build time**, so `cfg.cssEntry` points at the **compiled** stylesheet
  `.next/static/chunks/c1f3ec77ad9e22b1.css` (production build output), which carries
  both `:root` token vars and the generated utilities.

## Process shim (committed fork)

`.design-sync/overrides/bundle.mjs` forks the converter's bundler to add a one-line
browser `process` polyfill banner to the IIFE. Without it, Next.js internals pulled
in by `app-sidebar` (`next/navigation`, `next/link`) and the API client
(`process.env.NEXT_PUBLIC_API_URL`) read `process.*` at module eval and throw
`process is not defined`, crashing the whole bundle before `window.CanopyDS` is
assigned (all 29 previews fail). Declared in `cfg.libOverrides`. The fork needs
`.design-sync/node_modules -> ../.ds-sync/node_modules` (gitignored) so esbuild
resolves; recreate on a fresh clone. The fork repoints its `./common.mjs` import to
`../../.ds-sync/lib/common.mjs`.

## Gotchas learned

- **Synth mode + `componentSrcMap` string pins don't mix.** In synth-entry mode the
  component list is auto-derived by scanning all `src/components` for PascalCase
  exports — but ONLY when no non-null `componentSrcMap` entry exists. Adding even one
  string pin (`"X": "path"`) makes the discovered set non-empty and SKIPS the scan,
  collapsing the build to just the pinned component(s). Use `null` exclusions freely
  (they only delete), but never string pins here.
- `DDSForm` is grouped under `general` instead of `forms` because its kebab-case
  (`DDSForm` → `DDSForm`, not `dds-form`) doesn't fuzzy-match `dds-form.tsx`. Cosmetic;
  left as-is (a string pin would trigger the gotcha above; a docsMap stub could fix it).

## Component split (29 total)

- **15 ui/ primitives** (Button, Badge, Card, Dialog, Input, Label, Select, Separator,
  Sheet, Sidebar, Skeleton, Table, Textarea, Tooltip, Toaster) — authored rich previews.
- **14 app composites** (6 forms, 4 integration tabs, SourceCard, ScheduleSection,
  DataTable, AppSidebar, LandPlotMap) — ship as floor cards (functional/importable, but
  bound to live API/React Query/Next router/Leaflet so they can't render statically).
  All 63 shadcn compound sub-parts (CardHeader, SelectTrigger, Sidebar* …) are excluded
  from cards via `componentSrcMap: null` but REMAIN in the bundle (window.CanopyDS has
  95 exports), composed inside their parent's preview.

## Known render warns (benign — re-syncs should not treat as new)

- **`[RENDER_THIN]` on Dialog and Sheet** (rendered height 1px): benign. Both are
  overlay components whose content is portaled with `position: fixed`, so the measured
  card *root* is empty even though the overlay renders correctly (confirmed in the
  `_screenshots/review/` sheets). They carry `cardMode: single` + `viewport` overrides.
  Do not "fix" — the previews are correct.
- `[GRID_OVERFLOW]` on Card/Skeleton/Table/Textarea (wide → `cardMode: column`) and
  Select (fixed/portal → `cardMode: single`, `primaryStory: Triggers`) are RESOLVED via
  `cfg.overrides`; they should not re-fire.

## Re-sync risks (watch-list for the next sync)

- **`cfg.cssEntry` is a content-hashed Next build artifact** — the filename changes on
  every `npm run build`. After rebuilding, re-point `cssEntry` at the new
  `.next/static/chunks/<hash>.css` (the large ~100KB one with `:root` + utilities).
  A more deterministic source (a dedicated Tailwind CLI compile) is the better
  long-term fix.
- The self-symlink is gitignored and must be recreated per clone (see above).
- Fonts (DM Sans body / Fraunces display) are loaded by `next/font/google` at
  runtime — there is no `@font-face` to ship. Expect `[FONT_MISSING]`; resolved via
  `cfg.runtimeFontPrefixes` or a remote `@import` (decide during self-heal).
- App-specific composites (`forms/`, `integrations/`, `map/`, `app-sidebar`,
  `data-table`) depend on app context (authFetch, React Query, Next router, API
  types) and will likely floor-card rather than render statically.
- **Shipped CSS is a PARTIAL utility set.** `cssEntry` is the app's *static* compiled
  Tailwind v4 output, so only utilities the app already used exist (e.g. `bg-accent`,
  `font-display`, `shadow-sm`, `grid-cols-3` are ABSENT). All design *tokens* are
  defined as `:root` CSS variables, so brand styling via `var(--*)` always works. The
  conventions header steers the design agent accordingly. A more robust long-term fix
  would be to ship a fuller compiled utility sheet. Re-verify the verified/absent class
  lists in `conventions.md` after any `npm run build`, since the used-class set shifts.
