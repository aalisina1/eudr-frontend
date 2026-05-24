---
name: new-form
description: Create a new CRUD form following the Sheet + react-hook-form + zod pattern
argument-hint: [entity-name]
allowed-tools: Read, Write, Edit, Glob
---

Create `src/components/forms/$ARGUMENTS-form.tsx`:

1. Read `src/components/forms/supplier-form.tsx` as the reference pattern
2. Define a zod schema matching the backend serializer fields
3. Use `useForm` with `zodResolver` and appropriate `defaultValues`
4. Render in a `Sheet` with `SheetHeader`, `SheetContent`, `SheetFooter`
5. Use `useMutation` for both create (`POST`) and edit (`PATCH`)
6. Accept an optional entity prop — when provided, pre-fill form and use PATCH
7. Invalidate related React Query cache keys on success
8. Show mutation errors below the form fields
9. Reset form when Sheet closes
