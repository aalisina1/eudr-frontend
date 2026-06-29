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

## Styling idiom (read this — the stylesheet is partial)

`styles.css` ships the app's **compiled** Tailwind v4 output, so it is NOT a full
utility set — only classes the app already used are present. Consequences:

1. **Color & brand: use the CSS-variable tokens, not invented color utilities.** These
   `:root` variables are always defined: `--background --foreground --primary
   --primary-foreground --secondary --secondary-foreground --muted --muted-foreground
   --accent --accent-foreground --destructive --card --card-foreground --popover
   --popover-foreground --border --input --ring --radius --font-sans --font-display`
   plus `--sidebar*`. Apply them inline for your own glue, e.g.
   `style={{ background: "var(--card)", color: "var(--muted-foreground)" }}`. Color
   utilities like `bg-accent`, `font-display`, `shadow-sm`, `grid-cols-3` are NOT in
   the shipped CSS — they will render unstyled. (These DO ship and are safe:
   `bg-primary`, `bg-secondary`, `bg-muted`, `bg-card`, `bg-background`,
   `bg-destructive`, `text-foreground`, `text-muted-foreground`,
   `text-primary-foreground`, `border-border`, `border-input`.)
2. **Layout utilities that ARE shipped and safe**: `flex grid gap-2 gap-4 gap-6 p-4 p-6
   px-3 w-full items-center justify-between justify-center text-xs text-sm font-medium
   border rounded-md rounded-lg rounded-xl grid-cols-2`. For anything beyond these,
   prefer inline `style` so you never depend on a utility that wasn't compiled.
3. **Let the components carry the design.** They already encode spacing, radius, focus
   rings, and variants — pass their props (`variant`, `size`, `side`, `disabled`,
   `aria-invalid`) instead of re-styling.

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
