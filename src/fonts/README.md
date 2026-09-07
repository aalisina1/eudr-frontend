# Licensed type drop-in (eudr-frontend#157)

The app runs on **Geist Sans + Geist Mono** (SIL OFL, `geist` package), the
open faces closest to the Render direction. If the founder licenses the faces
Render actually uses, this directory is where they land, and the swap is
contained to `src/app/layout.tsx`.

## The faces

| Role | Render uses | Foundry | Open stand-in today |
|---|---|---|---|
| headings (`--font-display`) | **Roobert** 500 | Displaay | Geist Sans 500, `letter-spacing: -0.015em` |
| body / UI (`--font-sans`) | **Neue Montreal** | Pangram Pangram | Geist Sans |
| chips, labels, ids (`--font-mono`) | **Neue Montreal Mono** | Pangram Pangram | Geist Mono |

Pangram Pangram's page says "licenses start at $40"; exact web tiers are behind
their configurator and depend on pageviews and domains. Roobert is Displaay's,
not Pangram Pangram's. The spec originally had that wrong.

## The swap

1. Put the `.woff2` files here, e.g. `NeueMontreal-Regular.woff2`,
   `NeueMontreal-Medium.woff2`, `NeueMontrealMono-Regular.woff2`,
   `Roobert-Medium.woff2`.
2. In `src/app/layout.tsx`, replace the two `geist/font/*` imports with:

```ts
import localFont from "next/font/local";

const sans = localFont({
  src: [
    { path: "../fonts/NeueMontreal-Regular.woff2", weight: "400" },
    { path: "../fonts/NeueMontreal-Medium.woff2", weight: "500" },
  ],
  variable: "--font-geist-sans", // keep the variable name; globals.css reads it
  display: "swap",
});
const mono = localFont({
  src: "../fonts/NeueMontrealMono-Regular.woff2",
  variable: "--font-geist-mono",
  display: "swap",
});
const display = localFont({
  src: "../fonts/Roobert-Medium.woff2",
  weight: "500",
  variable: "--font-roobert",
  display: "swap",
});
```

3. Add `${display.variable}` to the `<body>` className, and in `globals.css`
   point `--font-display: var(--font-roobert);`.

Nothing else changes: `.text-display`, `.eyebrow`, the type scale and every
component read the variables, not the faces.

## Before buying

Look at the app as it renders on Geist first. If it already reads as owned,
the purchase is smaller than it looks. That is the roadmap ladder's rule, and
it still applies here.
