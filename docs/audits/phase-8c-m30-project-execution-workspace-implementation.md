# Phase 8C M30 — Project Execution Workspace Implementation

**Date:** 2026-08-17  
**Branch:** `phase-8c-m30-project-execution-workspace`  
**Base main:** `5b4a7f300e63b438884a2b440a69a569d91b9e5d` (PR #60 true merge; post-merge CI `31997689617` SUCCESS)  
**Architecture:** ADR-0026 / DEC-0075 / OD8C-1–OD8C-12  
**Implementation decision:** DEC-0076  
**Gate:** repository implementation only — **M30 NOT managed-applied**; **PR OPEN / NOT MERGED**; **no production activation**; **Phase 9 not started**

---

## 1. Preflight

- Local HEAD at branch creation = `origin/main` = `5b4a7f300e63b438884a2b440a69a569d91b9e5d`
- Divergence `0/0`; tracked tree clean; historical stash untouched
- Repository before this gate: M1–M29; M30 absent
- Managed OneDecore `lpurlfmpvriyvpkujvyl`: M1–M29; pending NONE
- CLI pin: `npx supabase@2.109.1`

## 2. Collision / live-schema audit

| Finding | Action |
|---|---|
| M28 projects / PM assignments / `project_events` / project idempotency | Reused; no second ledgers |
| M29 design workflows / designer assignments / `complete_project_design` | Unchanged (byte-identical M29) |
| No `project_execution_workflows` / snags / evidence | Created in M30 only |
| No `project-execution-documents` bucket | Created private in M30; zero `storage.objects` |
| No `project_execution.*` permissions | Five codes; no `.manage`; no designer/SE/legacy grants |
| Phase 8C prebuild at `src/features/projects/execution/*` | Corrected to post-design graph; client preview remains unmounted |
| `/admin/projects/[projectId]` | Minimum live execution workspace + high-level cards |

## 3. M30

**File:** `supabase/migrations/20260817140000_project_execution_workspace.sql`

**Git blob:** `faa814d69f0768a4251e2b41fedbf517abc9f2bb`

**Raw SHA-256:** `74F3C658A9062D38D39D5D824D30D70A64933077B4E351E2ACB1D0690959AF5D`

Forward-only. No M1–M29 edits. No business/project/execution seed rows. System RBAC metadata + one private bucket metadata row only.

Permissions:

- `project_execution.read` — super_admin, sales_manager, project_manager
- `project_execution.transition` — project_manager
- `project_execution.hold` — project_manager
- `project_execution.snag` — project_manager
- `project_execution.cancel` — super_admin, sales_manager, project_manager

Tables: `project_execution_workflows`, `project_execution_snags`, `project_execution_evidence`.

States: `production`, `ready_for_dispatch`, `delivery`, `installation`, `snag_resolution`, `handover`, `completed`, `on_hold`, `cancelled`. No duplicate Phase 8B states. No `material_finalisation`.

## 4. Auto-init failure semantics

- M30 AFTER UPDATE trigger on `project_design_workflows` when state first becomes `design_completed`
- Calls `private.materialize_project_execution_impl(..., actor_kind=system, key=exec-init-<project_id>)`
- Requires `projects.status = handover_accepted` AND `design.state = design_completed`
- Production Ready does not initialize
- Handover acceptance alone does not initialize
- Trigger **catches** initializer failure and does **not** re-raise; Design Completed is preserved
- Optional bounded `project.execution_init_failed` event after catch
- Existing row is idempotent reuse; initial state `production`

## 5. Repair

`public.repair_project_execution_workflow` — Super Admin or Sales Manager only; staff actor; same canonical materializer. Recovery, not routine stage control.

## 6. RLS / ACL

- RLS SELECT for SA, SM, current PM (`primary_pm_id = auth.uid()`)
- No authenticated INSERT/UPDATE/DELETE policies
- Direct auth storage write denied
- Private helpers EXECUTE denied except `private.project_execution_can_view_detail` (RLS predicate)
- Public mutations authenticated only; anon denied
- SECURITY DEFINER `search_path=''`

## 7. Evidence / storage / preauth

- Types: `stage_transition`, `snag_resolution`, `handover_acknowledgement`, `completion_acknowledgement`
- Uploaded path `projects/<id>/execution/evidence/%`; SHA64; ≤20MiB; PDF/JPEG/PNG/WebP; object existence required
- Server: preauth RPC → validate/hash → service-role upload (`upsert:false`) → mutation RPC → orphan cleanup
- Signed URL 900s by evidence id (not raw path)

## 8. PM continuity

Mutation requires current canonical PM and `handover_accepted`. Reassignment preserves workflow/state/evidence/snags; no reset; no auto-hold.

## 9. UI

Mounted on existing `/admin/projects/[projectId]`:

- SA/SM: detailed read, cancel, repair missing init
- Current PM: full workspace
- Assigned Lead/Supporting + own SE: high-level card only
- Client update preview unmounted

## 10. Tests / managed / production

- pgTAP `22_project_execution_workspace_test.sql`
- App: `phase-8c-execution.test.ts` + `phase-8c-m30-runtime.test.ts`
- Repository M1–M30; managed remains M1–M29; M30 pending only
- Phase 9 persistence/UI absent
- Production activation NONE
