# Canopy EUDR Design System — how to build with it

shadcn-style React components (built on `@base-ui/react`) for the Canopy EUDR
compliance platform. Brand: a warm "parchment botanical" palette — forest-green
primary, copper accent, parchment background; body type DM Sans, display type
Fraunces. **Compose the library components; do not rebuild their look.**

## Setup & wrapping

Tokens are global CSS variables (no ThemeProvider needed — they live in
`styles.css`). Two components need a context provider; wrap once, high in the tree:

- **`Tooltip`** → wrap the subtree in **`TooltipProvider`**. Without it, tooltips throw.
- **`Sidebar`** and its `Sidebar*` parts → wrap in **`SidebarProvider`**. Use
  `<Sidebar collapsible="none">` for a static, always-expanded nav.
- **`Toaster`** → mount **once** at the app root (it renders the toast region; trigger
  toasts imperatively with sonner's `toast()`).

Dark mode: add the class `dark` to a root ancestor (`<html class="dark">`). There is
no theme context — the `.dark` selector reassigns the same CSS variables.

## Styling idiom — Tailwind v4 with brand tokens

`styles.css` ships a **complete Tailwind v4 utility set** (spacing, layout, type,
color, radius, shadow, ring, position, effects) plus the brand tokens — write normal
Tailwind and it applies.

1. **Brand color is token-driven.** The palette lives in these `:root` CSS variables,
   exposed as color utilities across `bg-`/`text-`/`border-`/`ring-`: `--background
   --foreground --primary --primary-foreground --secondary --secondary-foreground
   --muted --muted-foreground --accent --accent-foreground --destructive --card
   --card-foreground --popover --popover-foreground --border --input --ring --radius
   --font-sans --font-display` plus `--sidebar*`. So `bg-primary text-primary-foreground`,
   `bg-muted`, `text-muted-foreground`, `border-border`, `bg-accent`, and opacity
   variants like `bg-primary/10` all work. Prefer these token utilities over hard-coded
   palette colors (`bg-emerald-600`) so designs stay on-brand and theme with dark mode.
2. **Layout/spacing/type utilities are fully available** — `flex grid grid-cols-{1..12}
   gap-* p-* m-* w-* max-w-* items-* justify-* text-{xs..6xl} font-{medium,semibold,bold}
   rounded-* shadow-* ring-* line-clamp-* truncate` etc. Use `font-display` for Fraunces
   display headings, `font-sans` for DM Sans body.
3. **Let the components carry their own design.** They already encode spacing, radius,
   focus rings, and variants — pass props (`variant`, `size`, `side`, `disabled`,
   `aria-invalid`) rather than re-styling them.

## Where the truth lives

- `styles.css` (and the `_ds_bundle.css` it `@import`s) — the tokens and component CSS.
- `components/<group>/<Name>/<Name>.prompt.md` — per-component usage and examples.
- `components/<group>/<Name>/<Name>.d.ts` — the prop contract.
- Component variants worth knowing: `Button`/`Badge` `variant` =
  `default | secondary | outline | ghost | destructive | link`; `Button` `size` =
  `xs | sm | default | lg | icon | icon-sm | icon-lg`; `Card` composes with
  `CardHeader / CardTitle / CardDescription / CardAction / CardContent / CardFooter`.

## Idiomatic snippet

```tsx
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter, Button, Badge } from "<pkg>";

<Card style={{ width: 360 }}>
  <CardHeader>
    <CardTitle>Fazenda Boa Vista</CardTitle>
    <CardDescription>Coffee · Minas Gerais, Brazil</CardDescription>
  </CardHeader>
  <CardContent>
    <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13 }}>
      <span style={{ color: "var(--muted-foreground)" }}>Status</span>
      <Badge>Verified</Badge>
    </div>
  </CardContent>
  <CardFooter className="gap-2">
    <Button size="sm">View supplier</Button>
    <Button size="sm" variant="outline">New batch</Button>
  </CardFooter>
</Card>
```
