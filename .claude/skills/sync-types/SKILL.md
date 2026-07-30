---
name: sync-types
description: Compare and sync frontend TypeScript types with backend Django serializers
allowed-tools: Read, Edit, Grep, Glob
---

Compare backend serializers with frontend types and update as needed:

1. Read all serializer classes in `apps/*/serializers.py` (backend repo at `/Users/alisinaahmadi/dev/EUDR/eudr-backend`)
2. Read `src/lib/api/types.ts` (frontend)
3. For each serializer, check the matching TypeScript interface:
   - Missing fields? Add them.
   - Wrong types? Fix them.
   - New serializer without a matching interface? Create one.
4. Ensure `PaginatedResponse<T>` is used for list endpoints
5. Ensure enum/status types match Django `TextChoices` values exactly
6. **Also sync REQUEST serializers**, not just model serializers — the
   `*RequestSerializer` classes that define POST/PATCH bodies. These are the
   ones eudr-frontend#88 fell through: the Promote button posted
   `sync_record_ids` while the backend read `ids`, and nothing caught it
   because the request body was an untyped object literal. Their TS
   counterparts live under `// ── Request bodies ──` in `types.ts`, and call
   sites should use `satisfies <Interface>` so a divergent key is a build
   error rather than a runtime one.
7. Report all changes made
