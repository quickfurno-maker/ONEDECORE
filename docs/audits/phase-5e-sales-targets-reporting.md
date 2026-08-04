# Phase 5E — Sales Targets & CRM Reporting

**Status:** COMPLETE — implementation merged; M16 applied managed; closeout PR pending merge
**Implementation date:** August 3, 2026
**Implementation merge:** PR #15 — `4340a669e6dcf107081097c1edc2b79a113e36cd`
**Managed apply:** Phase DB-5B — 2026-08-03T18:56:14Z–18:56:22Z (UTC)
**Migration:** M16 — `20260803140000_crm_sales_targets_reporting_foundation.sql`
**M16 SHA-256:** `777A0DDB77910B7BB9A069048B10B40CE48144D5FB1D34E714875CFF0F972A58`
**Managed project:** OneDecore (`lpurlfmpvriyvpkujvyl`, ap-south-1)

---

## 1. Scope

Phase 5E implements the frozen Phase 5E-A architecture:

1. Sales target configuration (`executive_personal`, `sales_team`)
2. Append-only target history/events
3. Role-aware target visibility (RLS-backed)
4. Non-commercial CRM reporting foundation
5. Premium internal CRM targets/reports UI
6. Local and managed database verification

**Commercial achievement remains inactive until Phase 7B.** No deployment or public intake activation.

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

**Totals after M16:** permissions 29; role_permissions 90

### Public RPCs (SECURITY INVOKER)

| RPC | Authority |
| :--- | :--- |
| `create_sales_target` | `sales_targets.manage` (SA only) |
| `revise_sales_target` | `sales_targets.manage` (SA only) |
| `lock_sales_target` | `sales_targets.manage` (SA only) |
| `reopen_sales_target` | `sales_targets.manage` (SA only) |

Private `*_impl` helpers: SECURITY DEFINER, `search_path = ''`. Anon execute grants: 0.

### RLS

- `sales_targets`: SELECT via `private.crm_can_view_sales_target`
- `sales_target_events`: SELECT follows parent target visibility
- No direct INSERT/UPDATE/DELETE grants to authenticated on either table
- Mutations only through RPCs
- Public RLS policies: 52; RLS-enabled public application tables: 28

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

## 4. QA evidence

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

## 5. Managed database state (DB-5B)

| Check | Result |
| :--- | :--- |
| Managed before apply | M1–M15 aligned; M16 pending |
| Managed after apply | M1–M16 aligned |
| Post dry-run | Up to date |
| `sales_targets` / `sales_target_events` | Present; 0 rows each at verification |
| Existing 26 table row counts | Preserved except RBAC deltas |
| Managed lint | PASS (0 schema errors) |
| Security Advisor | No lints |
| Performance Advisor | INFO only (nonblocking) |
| Managed synthetic data | None |

---

## 6. Recovery evidence (DB-5A-L)

| Item | Value |
| :--- | :--- |
| Package label | `DB5A-L-20260803T133124Z` (owner-local, outside Git) |
| Capture window (UTC) | 2026-08-03T13:31:24Z – 13:33:32Z |
| Verification | 26/26 public application table row-count match; RBAC/RLS match |
| Limitation | Logical checkpoint only; auth/storage platform not fully restored in disposable target; not equivalent to physical backup/PITR |
| Physical backup | Still delayed |

---

## 7. Regression gates

| Gate | Result |
| :--- | :--- |
| Public intake | inactive / unchanged |
| Deployment | none |
| Closed-Won operational | blocked until Phase 7B |
| Phase 5F | not started |
| Landing Page Lab | not implemented |
| Chart library | not added |
| Service role in reporting | not used |

---

## 8. Phase 7B seam

Commercial achievement will be derived at query-time from accepted quotation truth + target configuration. No nullable achieved columns stored in M16. Phase 8A must not double-count future conversion.

---

## 9. Closeout

**Closeout audit:** [phase-5e-sales-targets-reporting-closeout.md](phase-5e-sales-targets-reporting-closeout.md)
**Decisions:** DEC-0052 (managed M16 + commercial boundary), DEC-0053 (logical recovery policy)
**Phase 5E formally closes** after closeout docs PR merges on protected main.
