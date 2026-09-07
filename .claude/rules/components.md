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

## Radius follows nesting depth

Every step derives from `--radius`, and since eudr-frontend#166 that is **`0.375rem`
(6px)**: the founder's D4 answer from the rendered candidate sheet
(`ui-direction-grovetrace.md`), "tight": small corners, hairline cards, no shadow. The
rule for which step goes where is unchanged from #127 (derived from what the codebase
already did 73–100% of the time per element kind), only the values moved:

| Element | Class | px | Why |
|---|---|---|---|
| Status dots, avatars, people chips (role, member), counts | `rounded-full` | full | circular or capsule by nature; pills mean *people and numbers* |
| `<Badge>` and every status chip (stage, RAG, KYC, deadline, tracking) | `rounded-md` (Badge's own default) | ~5 | square chips are the D5 decision; a status is a label, not a pill |
| Controls: inputs, buttons, selects, hand-rolled tags | `rounded-lg` | 6 | innermost; what the `Input`/`Button`/`Select` primitives ship with |
| Callouts, list rows, icon tiles, `Dialog` | `rounded-xl` | ~8 | one step out |
| Cards, panels, sheets | `rounded-2xl` | ~11 | outermost container |

The principle: **the deeper an element nests, the smaller its radius.** A `rounded-2xl`
card holds `rounded-xl` rows which hold `rounded-lg` controls. Two adjacent levels at
the same radius read as flat; a control rounder than its row reads as a sticker.

Elevation: `--shadow-card` is `none` in both themes. A card is a hairline (`ring-1
ring-foreground/10`), not a shadow. The `.shadow-card` utility stays so the idiom is one
token away from returning; do not add literal shadows (the lint forbids them).

Two drifts the earlier rule reconciled, worth recognising if you see them again:

- A hand-rolled `<select>` or `<input>` at `rounded-xl`. The `Input`/`Select` primitives
  are `rounded-lg`; a bare element beside them at `xl` is visibly rounder than its
  siblings. Prefer the primitive. If you must hand-roll, match it.
- `<Badge className="rounded-… ">`. Don't override Badge's radius; if a chip needs a
  different shape it is not a status chip.

**Named exception:** the `Card` primitive manages its own corners (`rounded-t`/`rounded-b`
on header and footer) and is not subject to the table above.

**Deliberately not lintable.** Choosing `rounded-lg` over `rounded-xl` is a design call,
and the element kinds above are judgements a rule cannot make from a class string. Per
ADR-0027's closing note, naming what cannot be encoded is part of the decision. The
colour, type-size and shadow tokens *are* gated (`eslint-rules/grovetrace-tokens.mjs`).
