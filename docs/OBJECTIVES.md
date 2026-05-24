# Frontend Objectives

## Mission

Give compliance teams a fast, focused workspace for EUDR (Regulation (EU) 2023/1115) due diligence. The frontend's job is to make a regulator-readiness workflow that would normally live in spreadsheets and emails feel like a normal SaaS product.

## Why this exists

Compliance officers need to:

- See, at a glance, which plots, batches, suppliers, and statements are in what state.
- Drill into any one of them, edit it, and see the audit trail.
- Pull data from whatever upstream system the operator already uses (SQL Server, FarmForce, AS400, CSV uploads, REST APIs) without writing code.
- Build a Due Diligence Statement, attach the evidence, and submit it.
- Trust that what they see is what the regulator will see.

A wall of REST endpoints does none of that. The frontend turns the backend into a workflow.

## Target users

| Role | What the UI gives them |
|------|------------------------|
| **ADMIN** | Full nav, settings, integration management, user invites |
| **COMPLIANCE_OFFICER** | DDS creation/review, sync record approval, risk assessment |
| **VIEWER** | Read-only views with the same layout — no edit buttons |
| **SUPPLIER_CONTACT** | Scoped views of their own plots / batches / documents only (planned) |

Today the UI shows the same chrome to all roles. Role-aware UI scoping (hide/disable actions based on `user.role`) is on the roadmap.

## What "done" looks like for the frontend

A compliance officer should be able to:

1. **Log in** and see a dashboard with the current statement status mix and plot validation status mix.
2. **Browse, search, sort, filter, paginate, export** any list of plots/batches/suppliers/DDS/documents.
3. **Open a detail page** for any of those entities and see related data — a plot's validation history, a batch's chain links, a DDS's risk assessments, a document's version history.
4. **Create or edit** any entity from a slide-over Sheet with inline validation. No page reloads.
5. **See plots on a map** with their actual geometry.
6. **Connect a data source** (SQL Server today, more later), test the connection, discover its objects, pick which to ingest.
7. **Write SQL transformations** across raw data with a syntax-highlighted editor and a live schema sidebar.
8. **Build a mapping** that ties source columns to target object fields, with auto-mapping as a starting point.
9. **Run syncs**, review the resulting records, approve/reject, and promote to core models.
10. **Switch themes** without a flash on reload.

## Non-objectives

- **No offline mode.** This is an authenticated SaaS dashboard.
- **No mobile-first layout.** Designed for desktop compliance work.
- **No global state management library.** React Query is enough; adding Redux/Zustand is a regression unless something specific demands it.
- **No bundled API mocking.** Tests stub `authFetch`; we don't run MSW.
- **No bundled PDF rendering.** Belongs on the backend if it ships.
- **No custom design system.** Stay on shadcn/Tailwind primitives — accept their defaults, don't rebuild Button.

## Quality bars

- **Build is the gate.** TypeScript + lint must pass; CI mirrors this.
- **Types stay in sync.** `src/lib/api/types.ts` mirrors backend serializers. Frontend PRs that touch types should be paired with the backend PR that changed them. (The `sync-types` skill scaffolds this.)
- **Every list view is a `DataTable`.** Don't roll a one-off table.
- **Every form is a Sheet + react-hook-form + zod.** Don't roll a one-off form.
- **Every fetch goes through `authFetch`.** This is what makes the 401 → refresh → retry flow uniform.
- **Detail pages always handle the loading and the not-found states.** No bare spinners forever; no white screens.

## Success signals (UX)

- A compliance officer can go from login to opening a specific plot/batch/statement in three clicks.
- "New X" Sheets validate inline, with clear errors and no surprise required fields.
- The integrations 4-tab flow stays understandable: each tab does one thing.
- Dark mode works without a flash and without anything looking broken.
- The Leaflet map never sits above a Sheet overlay.
