# Phase 5E-B — Sales Targets & CRM Reporting (Local Implementation Record)

**Status:** IMPLEMENTATION COMPLETE LOCALLY — PR/MANAGED GATES PENDING  
**Implementation date:** August 3, 2026  
**Base commit:** `79e437b3aebb98dc74b23777914d7908f638bb4b`  
**Feature branch:** `phase-5e-b-sales-targets-reporting` (local, not pushed)  
**Migration:** M16 — `20260803140000_crm_sales_targets_reporting_foundation.sql`  
**M16 SHA-256:** `777A0DDB77910B7BB9A069048B10B40CE48144D5FB1D34E714875CFF0F972A58`

---

## 1. Scope

Phase 5E-B implements the frozen Phase 5E-A architecture:

1. Sales target configuration (`executive_personal`, `sales_team`)
2. Append-only target history/events
3. Role-aware target visibility (RLS-backed)
4. Non-commercial CRM reporting foundation
5. Premium internal CRM targets/reports UI
6. Local DB/app/owner/browser QA

**Not in scope:** managed M16 apply, commit, push, PR, deployment, public intake activation, commercial achievement (Phase 7B), Phase 5F/9 work.

---

## 2. Database surface (migration 16)

### Tables

| Table | Purpose |
| :--- | :--- |
| `public.sales_targets` | Monthly target configuration (revenue paise + Closed-Won count) |
| `public.sales_target_events` | Append-only history (`target.created`, `target.revised`, `target.locked`, `target.reopened`) |

**Forbidden columns:** no `achieved_*`, attainment, variance, forecast, commission, margin, or commercial leaderboard fields.

### Permissions

| Permission | Roles |
| :--- | :--- |
| `sales_targets.read` | super_admin, sales_manager, management, sales_executive, sales |
| `sales_targets.manage` | super_admin only |
| `crm.reporting.read` | super_admin, sales_manager, management, sales_executive, sales |

**Denied:** project_manager, designer, project_operations

### Public RPCs (SECURITY INVOKER)

| RPC | Authority |
| :--- | :--- |
| `create_sales_target` | `sales_targets.manage` (SA only) |
| `revise_sales_target` | `sales_targets.manage` (SA only) |
| `lock_sales_target` | `sales_targets.manage` (SA only) |
| `reopen_sales_target` | `sales_targets.manage` (SA only) |

Private `*_impl` helpers: SECURITY DEFINER, `search_path = ''`.

### RLS

- `sales_targets`: SELECT via `private.crm_can_view_sales_target`
- `sales_target_events`: SELECT follows parent target visibility
- No direct INSERT/UPDATE/DELETE grants to authenticated on either table
- Mutations only through RPCs

### Reporting index

- `idx_lead_follow_ups_owner_status_due` on `(owner_id, status, due_at)`

---

## 3. Application layer

### Contracts

- `sales-target-contracts.ts` — scopes, statuses, events, money bounds, achievement inactive copy
- `reporting-contracts.ts` — summary, trend, source mix, workload, follow-ups, aging, closed-lost
- `reporting-date-range.ts` — Asia/Kolkata presets, 366-day custom max

### Auth / capabilities

- `canReadSalesTargets`, `canManageSalesTargets`, `canReadCrmReporting` via `public.authorize`

### Server

- `crm-sales-target-service.ts`, `crm-sales-target-actions.ts` — RPC mutations, RLS queries
- `crm-reporting-queries.ts` — SSR reporting, no service role, no materialized views

### UI routes

| Route | Nav label (role-dependent) |
| :--- | :--- |
| `/admin/crm/targets` | Sales Targets / My Target |
| `/admin/crm/reports` | Reports / Team Performance / My Performance |

Achievement UI: **"Not activated until quotation acceptance (Phase 7B)"** — no fake progress, 0%, or ₹0 achieved.

---

## 4. Local QA

| Suite | Result |
| :--- | :--- |
| `npx supabase db reset` (M1–M16) | PASS |
| `npm run check:db` (lint + pgTAP) | 458/458 PASS |
| `npm run check` | PASS |
| `npm run test:app` | 430/430 PASS |
| `node scripts/phase-5e-owner-qa.mjs` | 19/19 PASS |
| `node scripts/phase-5e-browser-qa.mjs` | 31/31 PASS (390×844 mobile viewport) |

### Test files

- `supabase/tests/database/10_crm_sales_targets_reporting_test.sql` (plan 24)
- `src/features/crm/__tests__/phase-5e-sales-targets-reporting.test.ts` (12 tests)

---

## 5. Managed database state

| Check | Result |
| :--- | :--- |
| Managed before | M1–M15 aligned |
| M16 remote | blank (local only) |
| Managed after | M1–M15 aligned; M16 still local only |
| Managed write | none |

---

## 6. Regression gates

| Gate | Result |
| :--- | :--- |
| Public intake | inactive / unchanged |
| Closed-Won operational | blocked until Phase 7B |
| Phase 5F | not bundled |
| Landing Page Lab | not implemented |
| Chart library | not added |
| Service role in reporting | not used |

---

## 7. Phase 7B seam

Commercial achievement will be derived at query-time from accepted quotation truth + target configuration. No nullable achieved columns stored in M16. Phase 8A must not double-count future conversion.

---

## 8. Next gate

**Phase 5E-C PR gate:** containment review, commit, push, PR, exact-head CI, owner merge review.  
**DB-5A/DB-5B:** managed M16 apply after merge + fresh physical-backup gate.
