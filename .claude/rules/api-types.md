---
paths: ["src/lib/api/types.ts"]
---

- Hand-written types mirroring Django serializer output
- When backend adds/changes a serializer field, update the matching interface here
- Use `PaginatedResponse<T>` wrapper for all list endpoints
- Status/enum types as string literal unions matching Django `TextChoices` values (e.g., `"PENDING" | "PASSED" | "FAILED"`)
- Keep interfaces grouped by domain: Auth, Organization, Suppliers, Geolocation, Supply Chain, Due Diligence, Documents, Data Integration, Custom Target Definitions, SQL Query, Auto-map
- Shared type aliases (`TransformMode`, `TargetObjectType`) are defined near their primary consumers in the Data Integration section
