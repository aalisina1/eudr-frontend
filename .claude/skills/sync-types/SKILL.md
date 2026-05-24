---
name: sync-types
description: Compare and sync frontend TypeScript types with backend Django serializers
allowed-tools: Read, Edit, Grep, Glob
---

Compare backend serializers with frontend types and update as needed:

1. Read all serializer classes in `apps/*/serializers.py` (backend repo at `/Users/alisinaahmadi/Documents/Projects/EUDR/EUDR App`)
2. Read `src/lib/api/types.ts` (frontend)
3. For each serializer, check the matching TypeScript interface:
   - Missing fields? Add them.
   - Wrong types? Fix them.
   - New serializer without a matching interface? Create one.
4. Ensure `PaginatedResponse<T>` is used for list endpoints
5. Ensure enum/status types match Django `TextChoices` values exactly
6. Report all changes made
