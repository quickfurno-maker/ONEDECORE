# ADR-0025: Phase 8B Designer Assignment and Design Collaboration

**Status:** Accepted (architecture freeze — **M29 NOT CREATED**)  
**Date:** August 15, 2026  
**Deciders:** Business Owner, Senior Product Architect  
**Technical Scope:** Phase 8B Designer assignment and design collaboration  
**Owner authorization:** `LOCK PHASE 8B OWNER DECISIONS AS RECOMMENDED`  
**Depends on:** [ADR-0019](ADR-0019-five-role-crm-authorization-model.md), [ADR-0020](ADR-0020-closed-won-project-handover-invariants.md), [ADR-0024](ADR-0024-phase-8a-project-materialization-pm-handover.md), [ADR-0005](ADR-0005-version-1-no-erp-boundary.md)

This ADR **concretizes** Phase 8B implementation architecture. It does **not** supersede ADR-0020 wholesale. ADR-0020 remains authoritative for Closed-Won, PM handover, Designer/design business invariants, and No-ERP. ADR-0024 remains authoritative for Phase 8A project materialization and handover status. Phase 8C persisted architecture is concretized by [ADR-0026](ADR-0026-phase-8c-project-execution-workspace.md); OD8B-1–OD8B-8 are not reopened.

---

## Context

Phase 8A is complete on protected main (`db879b5ca27fe9d26543c23d8f130811c7feadab`, PR #57). Managed OneDecore is M1–M28. `public.projects.status` is handover-only. No design tables, designer assignments, or design storage exist. A migration-independent Phase 8B prebuild exists but is not binding persistence.

---

## Decision Outcome

### 1. Entry only after handover accepted

Phase 8B operates only when `public.projects.status = 'handover_accepted'`. No design workflow while awaiting PM assignment or acceptance. Do not rewrite the Phase 8A status model.

### 2. First Lead assignment initializes workflow (OD8B-1)

The 1:1 design workflow is created/reused idempotently on the first current Lead Designer assignment, initial state `brief_received`. Supporting assignment does not start workflow. Handover acceptance alone does not create a workflow row. Init failure must not falsify Phase 8A handover.

### 3. Separate design state from `projects.status`

`public.projects.status` remains Phase 8A handover truth. Phase 8B current state lives in a separate 1:1 `project_design_workflows` model. Do not add design substates to `projects.status`. Current Lead is derived from assignments, not duplicated on the workflow row.

### 4. Lead owns ordinary transitions (OD8B-2)

Current Lead Designer owns ordinary design-state advancement. Supporting Designers collaborate and version permitted deliverables but cannot independently advance state. Current PM has no ordinary advancement. SA/SM have staffing/read authority, not routine state override. No persisted blanket Lead+Supporting `canUpdateDesignWorkflow`.

### 5. Client approval capture (OD8B-4)

`client_approved` requires immutable auditable evidence. Current Lead or current primary PM may record it (atomic evidence + transition). Supporting Designer cannot. SA/SM have no routine override. Evidence is business audit, not e-signature. No client portal. Sources: uploaded artifact, inbound WhatsApp message, offline note. Do not fabricate marketing consent.

### 6. Hold / resume (OD8B-5)

Current Lead or current primary PM may hold and resume with a mandatory non-empty reason. No extra evidence file. Hold only from eligible non-terminal main-path states; never after `design_completed`. Resume only to `held_from_state`. Supporting Designer cannot hold/resume.

### 7. Measurement-sheet gate (OD8B-3)

`measurement_pending → measurement_completed` requires a current versioned `measurement_sheet`. Practical PDF/image/scan is sufficient. No CAD/BIM. No text-only completion.

### 8. Versioned immutable deliverables and private storage

Design files are versioned; historical versions immutable; no silent overwrite; exactly one current version per logical deliverable. Prefer a single append-only version table. Dedicated private bucket `project-design-documents`. Do not reuse `quotation-documents` or `portfolio-public`. Bounded signed URLs; server authorization; no browser service-role; no public design files.

### 9. Production Ready (Lead only)

`production_ready` requires accepted handover, valid transition, current Lead as actor, prior evidenced `client_approved`, at least one current `production_drawing` or `approval_pack`, and Production Ready evidence. Event + durable idempotency. No Phase 8C row.

### 10. Design Completed (OD8B-7)

Current Lead only: `production_ready → design_completed`. Simple terminal closeout. No second evidence pack. No PM acknowledgement. Prebuild reapplication of Production Ready evidence to `design_completed` is not V1.

### 11. Lead reassignment continuity (OD8B-6)

Reassignment preserves state, files, evidence, and prior Production Ready approval. Authority transfers immediately. Absent Lead blocks Lead-only transitions. Staffing change is not a design revision.

### 12. Event and idempotency reuse

Reuse `public.project_events` and `private.project_idempotency_requests` / `private.project_idempotency_xact_lock`. Do not create second ledgers. Lock-before-lookup remains binding (M28 precedent).

### 13. Staffing (canonical)

Exactly one current Lead once the workflow is staffed; zero or more current Supporting Designers; SA/SM only; PM cannot execute staffing; Designers cannot self-assign; changes audited. PM designer-request tickets **DEFERRED** (OD8B-8).

### 14. Phase 8C excluded / No-ERP

This section bound **Phase 8B / M29**. No execution-stage persistence, procurement, inventory, dispatch, delivery, installation, snags, completion execution, client portal, CAD/BIM, or autonomous Kriti mutation **in M29**. `production_ready` must not create or activate Phase 8C rows and must not claim production started. `design_completed` must not write 8C rows from M29.

**Concretization (August 16, 2026):** Phase 8C architecture is frozen in ADR-0026. Later M30 may auto-create a 1:1 execution workflow when `design_completed` is recorded on a `handover_accepted` project. ADR-0005 remains locked. OD8B-1–OD8B-8 are unchanged.

---

## Consequences

- Phase 8A handover remains the only project-level status truth.
- Design collaboration can start without expanding M28 statuses.
- Prebuild graph is reusable; prebuild authority/evidence extras must be corrected in M29.
- M29 is conceptually reserved as `designer_assignment_design_collaboration` and is **not created by this ADR**.

---

## Related Documents

- [Phase 8B architecture freeze](../audits/phase-8b-designer-assignment-design-collaboration-architecture-freeze.md)
- [ADR-0020: Closed-Won Project Handover Invariants](ADR-0020-closed-won-project-handover-invariants.md)
- [ADR-0024: Phase 8A Project Materialization and PM Handover](ADR-0024-phase-8a-project-materialization-pm-handover.md)
- [ADR-0019: Five-Role CRM Authorization](ADR-0019-five-role-crm-authorization-model.md)
- [ADR-0005: Version 1 No-ERP Boundary](ADR-0005-version-1-no-erp-boundary.md)
- [ADR-0026: Phase 8C Project Execution Workspace](ADR-0026-phase-8c-project-execution-workspace.md)
- [Decision Register](../10-decision-register.md)
