# Phase 5C1 Audit — Premium Role-Aware CRM Shell and Read-Only Lead Workspace

> **Current outcome (August 1, 2026):** Phase 5C1 is **closed**. Implementation merged to protected main (PR #5). Migration 12 applied to managed OneDecore Supabase on 2026-08-01 as part of ordered migrations 11→12→13 (Phase DB-2). Managed Supabase is at migrations **1–13**. Application is **not production-deployed**. Public lead intake remains inactive.

**Date:** July 31, 2026
**Branch:** `phase-5c-lead-workspace-premium-crm`
**Baseline:** `8493e8f70e9cf933c773c504336e7c9e5553cff4`
**Status:** Implementation complete (historical — see current-outcome addendum above)

## Scope delivered

- Premium internal CRM shell under `/admin/crm`
- CRM-specific permission enforcement via `crm-auth.ts` and RLS-backed reads
- Role-aware navigation and admin shell CRM link (permission-gated, not security boundary)
- Read-only lead list with search, filters, and offset pagination (`updated_at DESC`, `id DESC`)
- Read-only lead detail workspace with overview, contact, source, assignment, timeline, notes, follow-ups, and consent summary
- Responsive desktop table and mobile card layouts
- Keyboard-accessible filters, links, focus states, and skip link
- Local migration 12 and pgTAP coverage

## Prerequisites resolved

1. **`admin.access` for canonical sales roles** — migration 12 grants portal access to `sales_manager` and `sales_executive` without granting CRM access to `project_manager` or `designer`.
2. **Safe assignee directory** — `public.list_crm_assignable_executives()` returns only `user_id`, `display_name`, and `role_code` for broad-read callers; assignment-scoped executives are denied.
3. **Claims probing** — `getClaims()` now probes CRM permissions used by server routes.
4. **Repository auth alignment** — CRM reads use `getStaffClaims()` / `getCrmAccessContext()` instead of `getUser()`.

## Explicit non-goals honored

- No CRM mutation controls
- No managed Supabase migration application
- No deployment
- No public-site or portfolio redesign
- No public lead activation

## Managed Supabase status (historical — superseded)

At implementation time: managed project at migrations 1–11; migration 12 local-only.

**Superseded by Phase DB-2 (2026-08-01):** migrations 11, 12, and 13 applied to managed OneDecore (`lpurlfmpvriyvpkujvyl`); remote history aligned 1–13.

## Recommended next action (historical)

Owner review complete. Application tests: 347/347. Database tests: 272/272. Local owner QA:

```bash
PHASE_5C1_QA_PASSWORD='<local-only>' node scripts/phase-5c1-owner-qa.mjs
PHASE_5C1_QA_PASSWORD='<local-only>' PHASE_5C1_BASE_URL=http://localhost:3000 node scripts/phase-5c1-browser-qa.mjs
```

Phase 5C2 mutation slices were authorized after this audit; Phase 5C2A subsequently merged (PR #7).
