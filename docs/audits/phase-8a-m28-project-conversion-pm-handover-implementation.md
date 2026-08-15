# Phase 8A M28 — Closed-Won Project Conversion & PM Handover Implementation

**Date:** 2026-08-15  
**Branch:** `phase-8a-m28-project-conversion-pm-handover`  
**Base main:** `e46aa5341132ab710de543369ebb0a68747dac77`  
**Architecture:** ADR-0024 / DEC-0071 / OD8A-1–OD8A-4  
**Gate:** repository implementation only — **no managed M28 apply**, **no merge**, **no production activation**

---

## 1. Preflight

- Local HEAD at branch creation = `origin/main` = `e46aa5341132ab710de543369ebb0a68747dac77`
- PR #56 MERGED; post-merge CI `31791289861` SUCCESS
- Repository before this gate: M1–M27; M28 absent
- Managed OneDecore `lpurlfmpvriyvpkujvyl`: M1–M27; pending NONE
- Historical stash left untouched

---

## 2. Collision / prebuild audit

| Finding | Action |
|---|---|
| TypeScript Phase 8 prebuild exists at `src/features/projects` | Reused handover UI/contracts; Design/Execution remain unmounted |
| `public.portfolio_projects` is CMS, not execution projects | Untouched |
| `/admin/projects` was absent | Mounted Phase 8A list + detail |
| `handover-transitions.ts` allowed assign only from `awaiting_project_manager_assignment` | Updated for OD8A-3 (reassign from awaiting acceptance and handover accepted) |
| `canShowReassignPm` hid after `handover_accepted` | Corrected so SA/SM can reassign after accept |
| PM reassignment-request helpers exist | Left as pure contracts; no persistence/ticket UI |
| Phase 8B/8C prebuild panels | Not mounted; no designer/execution tables |

---

## 3. M28

**File:** `supabase/migrations/20260815140000_closed_won_project_conversion_pm_handover.sql`  
**Git blob:** `46a92d464092ae4d8947497bb33d95cf9c39ee4e`  
**Raw SHA-256:** `07AEF3E942CDEB510ADF74410141EF668344E20785381622CF5FD8F13DBC1A8F`

Forward-only. No M1–M27 edits. No production seeds.

### Permissions

- `projects.read` → super_admin, sales_manager, sales_executive, project_manager
- `projects.assign_pm` → super_admin, sales_manager
- `projects.accept_handover` → project_manager
- Designer: no Phase 8A grant
- Legacy `management` / `sales` / `project_operations`: none
- No `projects.admin`

### Tables

- `public.projects` — one per lead/acceptance; statuses Phase 8A only; `OD-P-YYYY-SEQ6`
- `public.project_manager_assignments` — history; one current via partial unique
- `public.project_events` — append-only
- `private.project_idempotency_requests` — system/staff actor scheme; no fake UUID

### RPCs

- `private.materialize_closed_won_project_impl` — canonical shared implementation
- `public.materialize_closed_won_project_internal` — service_role only
- `public.repair_closed_won_project_materialization` — SA/SM
- `public.list_pending_closed_won_project_materializations` — SA/SM repair queue
- `public.list_assignable_project_managers` — SA/SM
- `public.assign_project_manager` — SA/SM; initial + pre/post-accept reassignment
- `public.accept_project_handover` — current PM only
- `public.can_view_project_handover_baseline` — SA/SM/current PM PDF/baseline

No Closed-Won DB trigger. No Phase 7B acceptance rewrite.

---

## 4. Application runtime

- Post-acceptance orchestration in `quotation-acceptance-actions.ts` after committed `accept_quotation_by_capability`
- Trusted `quotation_version_id` from `get_quotation_by_capability` (not browser-supplied)
- Materialize failure → acceptance still succeeds; `projectMaterialization = pending_repair`
- Server actions: repair, assign PM, accept handover, 15-minute signed PDF URL via `quotation-documents`
- Routes: `/admin/projects`, `/admin/projects/[projectId]`
- Nav: Projects link for `projects.read`
- SE: high-level list/detail only
- Designer: no Phase 8A route access (`projects.read` denied)

---

## 5. Tests (actual local runs)

| Suite | Result |
|---|---|
| `supabase test db` | PASS — 20 files, **930** tests |
| Phase 8A pgTAP (`20_project_conversion_pm_handover_test.sql`) | PASS — **82** assertions |
| `test:phase-8-p0` | PASS — 11 |
| `test:phase-8a` | PASS — 47 |
| `test:phase-8b` | PASS — 31 |
| `test:phase-8c` | PASS — 39 |
| `test:phase-8-shell` | PASS — 2 |
| `db lint --local --level warning` | PASS; no new M28 advisor function warnings |

| `test:phase-7a` | PASS — 42 |
| `test:phase-7b` | PASS — 62 |
| `test:app` | PASS — **660** |
| `lint` | PASS — 0 errors / 11 pre-existing warnings |
| `typecheck` | PASS |
| `build` | PASS |
| `git diff --check` | PASS |

---

## 6. Security inspection

- All new SECURITY DEFINER functions use `SET search_path = ''`
- Internal materializer: EXECUTE service_role only; anon/authenticated/PUBLIC denied
- Trigger helpers: EXECUTE revoked from PUBLIC/anon/authenticated
- Direct authenticated DML on project tables denied
- Service-role helper imported only in server modules
- No project editable revenue field
- No 8B/8C persistence

Intentional authenticated RPCs: repair, list pending, list assignable PMs, assign PM, accept handover, baseline check. Authorization is inside each function.

---

## 7. Managed / production

- Managed remains **M1–M27**
- M28 **not** managed-applied
- No managed schema/data/migration/storage writes in this gate
- Production activation **NONE**
- Phase 8B **NOT STARTED**
- Phase 8C **NOT STARTED**

---

## 8. Remaining blockers

None for repository certification. Next authorized gate:

`PHASE_8A_M28_RECOVERY_MANAGED_APPLY`
