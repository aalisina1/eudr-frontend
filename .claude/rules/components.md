---
paths: ["src/components/**/*.tsx"]
---

- Use `"use client"` directive for interactive components
- UI primitives from `@/components/ui/` (shadcn-based, `@base-ui/react`)
- Icons from `lucide-react`
- Use `cn()` from `@/lib/utils` for conditional classNames
- Forms use react-hook-form + `zodResolver` + `Sheet` wrapper
- Support both create and edit mode via optional entity prop on form components
- Integration pipeline steps are in `src/components/integrations/` (query-step, map-step, preview-step, review-step). Each receives `sourceId` and relevant data as props, manages its own React Query queries/mutations internally.
- SQL editor uses `react-simple-code-editor` + `prismjs` for syntax highlighting
