---
paths: ["src/components/**/*.tsx", "src/app/**/*.tsx"]
---

- Use `"use client"` directive for interactive components
- UI primitives from `@/components/ui/` (shadcn-based, `@base-ui/react`)
- Icons from `lucide-react`
- Use `cn()` from `@/lib/utils` for conditional classNames
- Forms use react-hook-form + `zodResolver` + `Sheet` wrapper
- Support both create and edit mode via optional entity prop on form components
- Integrations is four sibling tabs on `/integrations` (Sources, Transformations, Mappings, Syncs) in `src/components/integrations/`. The old step components were deleted; do not reintroduce a pipeline.
- SQL editor uses `react-simple-code-editor` + `prismjs` for syntax highlighting

## Radius is 0 (visual direction: Render, eudr-frontend#155)

`--radius: 0`. Every derived step (`rounded-sm` … `rounded-4xl`) resolves to square, so
the class you pick no longer changes anything and the nesting-depth rule below is moot.
`rounded-full` is a literal `9999px` and still means "a circle": status dots, avatars.
Keep using the semantic step that *would* be right (`lg` on controls, `2xl` on cards) so
that if the founder's Decision 2/3 review brings a radius back, nothing has to be
re-audited. The rule is kept for that reason.

## Micro-labels are one class

Eyebrows, sidebar section labels and table headers all use `.eyebrow` (mono, uppercase,
tracked, muted — `globals.css`). Do not compose `font-mono text-xs uppercase tracking-…`
by hand; four pages had an identical `TH` constant and the dashboard cards a fifth
variant before this existed.

## Radius follows nesting depth (historical — moot while `--radius: 0`)

Every step derives from `--radius: 0.875rem` (14px), so the scale is sound; what was
missing was a rule for which step goes where. Derived from what the codebase already
does 73–100% of the time per element kind (eudr-frontend#127), not from taste:

| Element | Class | px | Why |
|---|---|---|---|
| Pills, status dots, avatars, `<Badge>` | `rounded-full` (Badge's own default is `4xl`, a pill at badge height) | — | circular or capsule by nature |
| Controls: inputs, buttons, selects, hand-rolled chips and tags | `rounded-lg` | 14 | innermost; this is what the `Input`/`Button`/`Select` primitives ship with |
| Callouts, list rows, icon tiles, `Dialog` | `rounded-xl` | 20 | one step out |
| Cards, panels, sheets | `rounded-2xl` | 25 | outermost container |

The principle: **the deeper an element nests, the smaller its radius.** A `rounded-2xl`
card holds `rounded-xl` rows which hold `rounded-lg` controls. Two adjacent levels at
the same radius read as flat; a control rounder than its row reads as a sticker.

Two drifts this rule reconciled, worth recognising if you see them again:

- A hand-rolled `<select>` or `<input>` at `rounded-xl`. The `Input`/`Select` primitives
  are `rounded-lg`; a bare element beside them at `xl` is visibly rounder than its
  siblings. Prefer the primitive. If you must hand-roll, match it.
- `<Badge className="rounded-lg …">`. 60 of 68 badges keep the pill; the eight that
  overrode it looked like a different component. Don't override Badge's radius.

**Named exception:** the `Card` primitive manages its own corners (`rounded-t`/`rounded-b`
on header and footer) and is not subject to the table above.

**Deliberately not lintable.** Choosing `rounded-lg` over `rounded-xl` is a design call,
and the element kinds above are judgements a rule cannot make from a class string. Per
ADR-0027's closing note, naming what cannot be encoded is part of the decision. The
colour, type-size and shadow tokens *are* gated (`eslint-rules/grovetrace-tokens.mjs`).
