# ADR-0026: Phase 8C Project Execution Workspace

**Status:** Accepted (architecture freeze — **M30 NOT CREATED**)  
**Date:** August 16, 2026  
**Deciders:** Business Owner, Senior Product Architect  
**Technical Scope:** Phase 8C project execution workspace  
**Owner authorization:** `LOCK PHASE 8C OWNER DECISIONS AS RECOMMENDED WITH THE THREE REFINEMENTS`  
**Depends on:** [ADR-0019](ADR-0019-five-role-crm-authorization-model.md), [ADR-0020](ADR-0020-closed-won-project-handover-invariants.md), [ADR-0024](ADR-0024-phase-8a-project-materialization-pm-handover.md), [ADR-0025](ADR-0025-phase-8b-designer-assignment-design-collaboration.md), [ADR-0005](ADR-0005-version-1-no-erp-boundary.md)

This ADR **concretizes** Phase 8C implementation architecture. It does **not** supersede ADR-0020 wholesale. ADR-0020 remains authoritative for Closed-Won, PM handover, Designer/design business invariants, and No-ERP. ADR-0024 remains authoritative for Phase 8A materialization and handover status. ADR-0025 remains authoritative for Phase 8B design collaboration (OD8B-1–OD8B-8 are not reopened).

The **three refinements** are locked with OD8C-1–OD8C-12 (not a thirteenth decision):

1. **M29 is the only persisted truth** for measurement, design development, client approval, Production Ready, and Design Completed. Do not persist duplicate 8C states `project_created`, `site_measurement`, `design_development`, or `design_approval`. ADR-0020’s historical 12-stage 8C graph is **partially superseded** here (same class as ADR-0022 vs quotation “approval”). Display-only aliases of M29 states (Option C) may exist later; they are never persisted 8C truth.
2. **Entry = `handover_accepted` AND `design_completed`.** No execution before PM acceptance. `production_ready` authorizes drawings and **must not** claim production started and **must not** create an 8C row. Phase 8B / M29 still must not write 8C rows; later M30 may auto-create the 1:1 execution row when Design Completed is recorded on an accepted-handover project.
3. **Do not persist `material_finalisation`.** It is a procurement/PO disguise risk. Material selections already live in 8B deliverables / `approval_pack`. Production, dispatch, delivery, and installation are **status + evidence tracking only** (No-ERP).

---

## Context

Phase 8A is complete on protected main (`db879b5ca27fe9d26543c23d8f130811c7feadab`, PR #57). Phase 8B is complete on protected main (`6b31052973cf9e50e25803b232ce446308c1fa3a`, PR #59 true merge). Managed OneDecore `lpurlfmpvriyvpkujvyl` is M1–M29; pending NONE; M30 absent. `public.projects.status` is handover-only. Design current state lives in `public.project_design_workflows`. A migration-independent Phase 8C prebuild exists (`src/features/projects/execution/`, unmounted UI) and is **not** binding persistence. That prebuild still encodes the historical 12-stage graph beginning at Project Created and must not be implemented as-is.

ADR-0025 §14 bound **Phase 8B / M29**: `production_ready` / `design_completed` must not activate Phase 8C **in that implementation**. This ADR does not reopen that 8B exclusion. It authorizes a later M30 to create 8C rows only after Design Completed, never from Production Ready.

---

## Decision Outcome

### 1. Entry gate (OD8C-1) — refinement 2

Phase 8C operates only when `public.projects.status = 'handover_accepted'` **and** `public.project_design_workflows.state = 'design_completed'`. No execution workspace, row, or mutation while awaiting PM assignment/acceptance, or while design is incomplete. Do not rewrite the Phase 8A status model or the Phase 8B design graph.

### 2. Post-design graph only (OD8C-2) — refinement 1

Persisted 8C main path:

```
production → ready_for_dispatch → delivery → installation → snag_resolution → handover → completed
```

Branches: `on_hold` (non-terminal pause); `cancelled` (terminal alternative). Completed cannot hold or cancel. Resume only to exact `held_from_state`.

Do not persist ADR-0020 / prebuild stages that duplicate M29: `project_created`, `site_measurement`, `design_development`, `design_approval`. Do not persist `material_finalisation` (OD8C-4 / refinement 3).

### 3. Separate execution state from handover and design

`public.projects.status` remains Phase 8A handover truth. `public.project_design_workflows.state` remains Phase 8B design truth. Phase 8C current state lives in a separate 1:1 `public.project_execution_workflows` model. Do not add execution substates to `projects.status`. Current PM is derived from assignments, not duplicated as a competing source of staffing truth.

### 4. Auto-create on Design Completed (OD8C-3) — refinement 2

When Design Completed is recorded on a `handover_accepted` project, create/reuse the 1:1 execution workflow **idempotently**. Initial state: `production`. Production Ready does not create the row. Handover acceptance alone does not create the row. No extra V1 “Start Execution” approval. Init failure must not falsify Phase 8A handover or Phase 8B Design Completed. Current PM’s first 8C action is an evidenced adjacent transition out of `production`, or hold/cancel.

M29 remains forbidden from writing this row. M30 implements the init (including a safe repair/retry of the same canonical path if Design Completed already exists without a workflow).

### 5. No persisted material finalisation (OD8C-4) — refinement 3

Factory/site tracking starts at `production`. Selections and drawings remain 8B deliverable versions. Production / dispatch / delivery / installation never become procurement, inventory, MRP, or logistics ERP.

### 6. Authority (OD8C-5, OD8C-7, OD8C-8, OD8C-9)

- **SA/SM:** detailed read; **no** routine stage mutation, hold, snag, handover, or completion. Cancellation is the only SA/SM execution mutation (OD8C-7).
- **Current primary PM:** sole routine mutate (adjacent transition, hold/resume, snag create/progress/resolve, handover ack, completion).
- **Other PM:** none.
- **Assigned Lead and Supporting Designers:** high-level stage / hold / cancelled / completed only; no snag, photo, note, or acknowledgement detail; no mutation (OD8C-8). Unassigned Designer denied.
- **Sales Executive:** own won-origin high-level only (project number, execution state or absent, hold/cancelled/completed, `updated_at`). No evidence, snags, notes, or other SE projects.
- **Kriti:** none (no transition, hold, cancel, snag, handover, complete, or auto-send).

### 7. PM reassignment continuity (OD8C-6)

Preserve execution workflow, state, evidence, and snags. Former PM authority revoked immediately. Mutation blocked until the new PM accepts (OD8A-3 still resets handover to `awaiting_project_manager_acceptance`). No auto-hold. No execution reset.

### 8. Hold / resume

Current PM only. Mandatory reason ≥10 characters plus reason code: `client_decision_pending` / `site_access_blocked` / `material_delay` / `weather` / `internal_capacity` / `other`. Allowed from any non-terminal 8C main-path state including `snag_resolution` and `handover`. Forbidden after `completed` / `cancelled`. Resume only to `held_from_state`. No extra evidence file in V1.

### 9. Cancellation (OD8C-7)

Current PM **or** Super Admin / Sales Manager. Reason ≥10 characters. Terminal. Not from `completed`. No commercial/quotation undo. No V1 reopen.

### 10. Snags (OD8C-9)

Append-only items: `open` → `in_progress` → `resolved`. Resolve requires evidence + actor/timestamp. No hard delete. No V1 reopen. Open or in-progress snags block entering `handover` and `completed`. Current PM only creates/progresses/resolves.

### 11. Handover and completion (OD8C-10, OD8C-11)

Enter `handover` only from `snag_resolution`; current PM; zero open/in_progress snags; **client handover acknowledgement** evidence required to enter (not also required to leave). Complete only from `handover`; current PM; still zero open snags; **separate completion acknowledgement** evidence; terminal; no extra SA/SM approval.

Acknowledgements are staff-captured by the **current PM** (uploaded artifact, inbound WhatsApp belonging to the project, or offline note ≥8 characters). M29-class integrity: object exists, preauth before service-role upload, project-scoped path, no `..`, SHA/size/MIME bounds, signed read, no overwrite. Not e-signature. No client portal.

### 12. Evidence and storage

Dedicated append-only execution evidence (not `project_design_evidence`). Dedicated private bucket `project-execution-documents`. Do not reuse `project-design-documents`, `quotation-documents`, or `portfolio-public`. Adjacent logistics gates (`ready_for_dispatch`, `delivery`, `installation`) require evidence. File “versioning” is append-only evidence, not design-style current-version rows.

### 13. Events, idempotency, deferred surfaces

Reuse `public.project_events` and `private.project_idempotency_requests` / `private.project_idempotency_xact_lock` (lock **before** ledger SELECT). Do not create second ledgers. **Milestones / generic project files DEFERRED.** Client update preview / auto-send **DEFERRED** (OD8C-12). No project-value, invoice, payment, cost, or profit fields in 8C; accepted quotation remains the commercial baseline.

### 14. No-ERP

ADR-0005 remains locked. No procurement, POs, inventory, warehouse, vendor payment, labour dispatch/attendance coupling, accounting/GST ledger, Gantt/scheduling engine, costing, work orders, CAD/BIM editor, unrestricted file manager, generic project chat, or autonomous Kriti mutation.

---

## Consequences

- M29 remains the only measurement/design/approval/Production Ready/Design Completed persistence.
- Execution can initialize without expanding M28 handover statuses or M29 design states.
- Historical 8C prebuild graph, evidence map, and handover-only eligibility are stale; M30 must correct them, not persist them.
- M30 is conceptually reserved as `project_execution_workspace` and is **not created by this ADR**.

---

## Related Documents

- [Phase 8C architecture freeze](../audits/phase-8c-project-execution-workspace-architecture-freeze.md)
- [ADR-0020: Closed-Won Project Handover Invariants](ADR-0020-closed-won-project-handover-invariants.md)
- [ADR-0024: Phase 8A Project Materialization and PM Handover](ADR-0024-phase-8a-project-materialization-pm-handover.md)
- [ADR-0025: Phase 8B Designer Assignment and Design Collaboration](ADR-0025-phase-8b-designer-assignment-design-collaboration.md)
- [ADR-0019: Five-Role CRM Authorization](ADR-0019-five-role-crm-authorization-model.md)
- [ADR-0005: Version 1 No-ERP Boundary](ADR-0005-version-1-no-erp-boundary.md)
- [Decision Register](../10-decision-register.md)
