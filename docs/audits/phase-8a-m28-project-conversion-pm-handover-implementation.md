# Phase 8A M28 — Closed-Won Project Conversion & PM Handover Implementation

**Date:** 2026-08-15  
**Branch:** `phase-8a-m28-project-conversion-pm-handover`  
**Base main:** `e46aa5341132ab710de543369ebb0a68747dac77`  
**Architecture:** ADR-0024 / DEC-0071 / OD8A-1–OD8A-4  
**Gate:** managed M28 applied — **PR #57 OPEN / NOT MERGED**, **no production activation**

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
**Pre-correction Git blob:** `46a92d464092ae4d8947497bb33d95cf9c39ee4e`  
**Pre-correction raw SHA-256:** `07AEF3E942CDEB510ADF74410141EF668344E20785381622CF5FD8F13DBC1A8F`  
**Corrected Git blob:** `b3f831136af809de9286dcc190160a93ec73c5fa`  
**Corrected raw SHA-256:** `934EC3D65FB89DFB4271DA2E319EF9A998FD069AE357ABDA8FA33E2CAAB37538`

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
| `supabase test db` | PASS — 20 files, **936** tests |
| Phase 8A pgTAP (`20_project_conversion_pm_handover_test.sql`) | PASS — **88** assertions |
| `test:phase-8-p0` | PASS — 11 |
| `test:phase-8a` | PASS — 48 |
| `test:phase-8b` | PASS — 31 |
| `test:phase-8c` | PASS — 39 |
| `test:phase-8-shell` | PASS — 2 |
| `db lint --local --level warning` | PASS; no new M28 advisor function warnings |
| `test:phase-7a` | PASS — 42 |
| `test:phase-7b` | PASS — 62 |
| `test:app` | PASS — **661** |
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

## 7. Managed / production (superseded by §10)

Historical repository-only state before this apply gate: managed **M1–M27**, M28 unapplied. See §10 for current managed-apply truth.

---

## 8. Independent-review correction — durable idempotency concurrency

- **Initial certified head:** `4af063dcce3974b016a40de62e16529c72ceb210`
- **Defect:** durable idempotency lookup-before-lock race on same-key concurrent retries
- **Affected operations:** `materialize`, `assign_pm`, `accept_handover`
- **Correction:** `private.project_idempotency_xact_lock` acquires `pg_advisory_xact_lock` on the exact durable identity **before** the first `private.project_idempotency_requests` SELECT. Payload mismatch remains `request_hash` after lock. Unique constraints retained. No defensive catch of business unique violations.
- **Concurrency test method:** sequential same-key replay + source-order static proof that the advisory lock precedes ledger lookup in all three paths. True two-session interleaving was **not** implemented (pgTAP is single-connection; no extra client dependency added).
- Correction landed before any managed apply; no M29; no architecture or OD8A change
- Pre-correction identity is historical only; corrected fingerprint is the managed-applied artifact

---

## 9. Remaining blockers (pre-apply)

None for repository certification. Managed apply executed in §10.

---

## 10. Managed M28 apply certification (2026-08-15)

| Item | Value |
| :--- | :--- |
| Recovery package | `C:\Users\KESHAV SHARMA\Desktop\ONEDECORE_RECOVERY\M28_PREAPPLY_20260815T092323Z\` |
| Physical backup | ID `1374687462` (`2026-08-14T19:53:30.663Z`, COMPLETED, `is_physical_backup=true`) |
| WALG | enabled |
| PITR | disabled |
| Logical evidence | `roles.sql`, `schema.sql`, `data.sql`, `migration_history_*` (sensitive data dump outside repo) |
| Apply command | `npx supabase@2.109.1 db push --linked --yes` |
| Supabase CLI | `2.109.1` |
| APPLY_START_UTC | `2026-08-15T09:26:39.9786906Z` |
| APPLY_END_UTC | `2026-08-15T09:26:44.3196945Z` |
| Apply exit | `0` SUCCESS |
| Pre-apply managed | M1–M27; pending M28 only; no M29 |
| Post-apply managed | M1–M28; pending NONE; dry-run “Remote database is up to date.” |
| Corrected M28 Git blob | `b3f831136af809de9286dcc190160a93ec73c5fa` |
| Corrected M28 raw SHA-256 | `934EC3D65FB89DFB4271DA2E319EF9A998FD069AE357ABDA8FA33E2CAAB37538` |
| M28 bytes | 40700 |
| Non-fatal apply note | pg-delta catalog cache warning (same class as M26/M27) |
| Security advisors | 47 WARN; M28-specific blockers **NONE**; +6 intentional authenticated SECURITY DEFINER RPC WARNs |
| Managed schema write | M28 only |
| Managed data write | RBAC metadata only (`projects.read` / `projects.assign_pm` / `projects.accept_handover` + role mappings); **0** project/assignment/event/idempotency business rows |
| Managed storage write | NONE (`storage.objects` count 0) |
| Business test fixtures | NONE |
| Phase 8B / 8C | NOT STARTED |
| Production activation | NONE |

Next authorized gate after independent review:

`PHASE_8A_PR57_MERGE`
