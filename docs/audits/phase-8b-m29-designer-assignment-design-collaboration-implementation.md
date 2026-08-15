# Phase 8B M29 — Designer Assignment & Design Collaboration Implementation

**Date:** 2026-08-15  
**Branch:** `phase-8b-m29-designer-design-collaboration`  
**Base main:** `b7afef60e41900e7832ea41b249067841aebbaea` (PR #58 true merge; post-merge CI `31884887844` SUCCESS)  
**Architecture:** ADR-0025 / DEC-0073 / OD8B-1–OD8B-8  
**Gate:** repository implementation only — **managed M29 NOT applied**; **PR #59 OPEN / NOT MERGED**; **no production activation**; **Phase 8C not started**

---

## 1. Preflight

- Local HEAD at branch creation = `origin/main` = `b7afef60e41900e7832ea41b249067841aebbaea`
- Divergence `0/0`; tracked tree clean; historical stash untouched
- Repository before this gate: M1–M28; M29 absent
- Managed OneDecore `lpurlfmpvriyvpkujvyl`: M1–M28; pending NONE
- Historical branch `phase-8b-prebuild-design` not reused (reference only)

---

## 2. Collision / prebuild audit

| Finding | Action |
|---|---|
| No live Phase 8B DB objects on main | Created in M29 only |
| No M29 migration | Added `20260816140000_designer_assignment_design_collaboration.sql` |
| No `project-design-documents` bucket | Created private in M29 |
| No `project_design.*` permissions | Added six codes; no `.manage` |
| M28 `public.projects.status` is handover-only | Unchanged; design state is 1:1 `project_design_workflows` |
| Reuse `project_events` + `project_idempotency_requests` + `project_idempotency_xact_lock` | Reused; no second ledgers |
| Quotation-documents / portfolio buckets | Not reused |
| Phase 8B prebuild at `src/features/projects/design/*` | Reconciled: Lead-only ordinary transition; PR gate only for `production_ready`; measurement-sheet gate |
| `/admin/projects/[projectId]` denied Designer in 8A | Assigned Lead/Supporting may open design workspace; unassigned Designer `notFound` |
| Phase 8C execution workspace | Remains unmounted |
| `01_identity_rbac_test.sql` counts | Forward-updated for 58 permissions / 67 public tables (test file only; M1–M28 untouched) |

---

## 3. M29

**File:** `supabase/migrations/20260816140000_designer_assignment_design_collaboration.sql`

**PRE-CORRECTION Git blob:** `1e8866633be5841b50cc4db0c415332505b20b5f`

**PRE-CORRECTION raw SHA-256:** `0294CECFAEFC2767E4686462EC4CDDCBF0DA8080F6402C5B970137F3D02A7FB0`

**Git blob:** `4038cbfc85cd024443f99b3d586eedd7afc7791a`

**Raw SHA-256:** `7E82070A6F17517965B5F4E82695568F47F9473CA9F9E53C9892CE7AEA5ADCFC`
Forward-only. No M1–M28 edits. No business/project/design seed rows. No automatic backfill.

### Permissions

- `project_design.read` → super_admin, sales_manager, project_manager, designer (**not** sales_executive)
- `project_design.staff` → super_admin, sales_manager
- `project_design.collaborate` → designer
- `project_design.transition` → designer
- `project_design.client_approval` → project_manager, designer
- `project_design.hold` → project_manager, designer
- Legacy `management` / `sales` / `project_operations`: none
- No `project_design.manage`

Row-level current assignment is still required on mutating RPCs.

### Tables

- `public.project_designer_assignments` — append-only history; one current Lead; no current Lead+Supporting overlap; no two current rows for same person
- `public.project_design_workflows` — 1:1 project; states per ADR-0025; created only by first Lead staffing
- `public.project_design_evidence` — append-only client_approval / production_ready
- `public.project_design_deliverable_versions` — pending→ready; current = highest READY version per `(project_id, deliverable_key)`

### Storage

- Private bucket `project-design-documents` (`public = false`)
- Browser → authenticated server action → service-role object op
- `upsert: false`; immutable paths; signed reads 900 seconds
- Allowed MIME: `application/pdf`, `image/jpeg`, `image/png`, `image/webp`
- Max size: 20 MiB
- Filename: trimmed, no `..` / `/` / `\`, ≤240 chars

### RPCs

Staffing: `list_assignable_designers`, `set_project_lead_designer`, `add_project_supporting_designer`, `remove_project_designer_assignment`  
Workflow: `transition_project_design`, `record_project_client_approval`, `hold_project_design`, `resume_project_design`, `approve_project_production_ready`, `complete_project_design`  
Deliverables: `reserve_project_design_deliverable_version`, `finalize_project_design_deliverable_version`  
Read: `can_view_project_design`, `get_project_design_high_level_status`

First Lead after `handover_accepted` creates workflow at `brief_received`. Supporting does not. Handover does not.

### Events (two-segment, reused `project_events`)

`project.designer_assigned`, `project.designer_reassigned`, `project.designer_removed`, `project.design_started`, `project.design_changed`, `project.design_revision`, `project.design_held`, `project.design_resumed`, `project.client_approved`, `project.design_deliverable`, `project.production_ready`, `project.design_completed`

### Idempotency

Lock (`private.project_idempotency_xact_lock`) **before** ledger lookup. Codes include `assign_designer`, `transition_design`, `record_client_approval`, `design_hold`, `design_resume`, `approve_production_ready`, `complete_design`, `register_deliverable_version`, `finalize_deliverable`.

### Handover baseline

`private.project_can_view` and `private.project_can_view_handover_baseline` replaced in M29 (not M28 edit) so current assigned designers with `project_design.read` can read immutable accepted-quotation baseline / signed PDF. No quotation mutation grants.

---

## 4. Application runtime

- Server: `project-design-actions.ts`, `project-design-queries.ts`, `project-design-storage.ts` (`server-only`)
- UI: `ProjectDesignWorkspace` on `/admin/projects/[projectId]`
- SA/SM staff; PM client approval + hold; Lead full gates; Supporting upload only; SE high-level RPC only
- No client portal, CAD/BIM, execution panels, or Kriti mutation

---

## 5. Security

- All new SECURITY DEFINER functions use `search_path = ''`
- Private/trigger helpers: PUBLIC/anon/authenticated EXECUTE revoked
- Intended authenticated EXECUTE: public RPCs; `private.project_can_view` and `private.project_design_can_view` for RLS evaluation (M28 precedent)
- Direct authenticated DML on design tables: SELECT only via RLS
- Service-role module not imported by tests/client; no `SUPABASE_SERVICE_ROLE_KEY` in design actions
- Advisor: no new M29 blockers beyond pre-existing extra warnings classified as intended authenticated SECURITY DEFINER RPCs

---

## 6. Tests (local)

Recorded locally: pgTAP 21 files / 1079 tests PASS; `test:phase-8b` 44 pass; `test:app` 705 pass; `npm run check` lint 0 errors / 11 pre-existing warnings, typecheck pass, build pass. Managed apply was **not** run.

---

## 7. Containment / stop

- Repository M1–M29
- Managed M1–M28; M29 unapplied
- Phase 8C persistence/UI activation absent
- Production activation NONE
- Next gate: `PHASE_8B_M29_RECOVERY_MANAGED_APPLY`

---

## 8. Independent-review evidence/storage integrity correction

Starting certified head: `1aba588d94b3904f3d4685bc30d4370ca048a039`

Pre-correction M29:
- Git blob `1e8866633be5841b50cc4db0c415332505b20b5f`
- raw SHA-256 `0294CECFAEFC2767E4686462EC4CDDCBF0DA8080F6402C5B970137F3D02A7FB0`

Defects:
1. uploaded-artifact DB evidence did not prove `storage.objects` existence
2. service-role evidence upload occurred before action-specific DB preauthorization
3. uploaded evidence had no project-scoped signed readback path

Correction:
- `private.project_design_uploaded_evidence_object_exists` plus table/RPC bounds (fixed bucket, project evidence path, source_reference = path, MIME allowlist, ≤20 MiB)
- canonical evidence RPCs require object existence after actor/state proof
- read-only `can_record_project_client_approval` / `can_approve_project_production_ready` before service-role write
- `getProjectDesignEvidenceFileUrlAction` signs DB-resolved uploaded evidence at 900 seconds
- workspace **Open evidence** for uploaded artifacts only; SE high-level surface excluded

No architecture change. No owner-decision change (OD8B-1–OD8B-8). M29 remained managed-unapplied. No M30.
