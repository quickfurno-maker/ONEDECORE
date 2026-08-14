# ADR-0024: Phase 8A Project Materialization and PM Handover

**Status:** Accepted (architecture freeze — **M28 NOT CREATED**)  
**Date:** August 14, 2026  
**Deciders:** Business Owner, Senior Product Architect  
**Technical Scope:** Phase 8A Closed-Won project conversion and PM handover  
**Owner authorization:** `LOCK PHASE 8A OWNER DECISIONS AS RECOMMENDED`  
**Depends on:** [ADR-0019](ADR-0019-five-role-crm-authorization-model.md), [ADR-0020](ADR-0020-closed-won-project-handover-invariants.md), [ADR-0022](ADR-0022-v1-direct-quotation-finalization-and-send.md), [ADR-0005](ADR-0005-version-1-no-erp-boundary.md)

This ADR **concretizes** Phase 8A implementation architecture. It does **not** supersede ADR-0020 wholesale. ADR-0020 remains authoritative for Closed-Won, PM handover, Designer (Phase 8B), execution (Phase 8C), and No-ERP business invariants.

---

## Context

Phase 7B is complete on protected main (`a30c733003fb08b3250148c61f7c4f74f11d4c14`, PR #55). Client acceptance atomically writes `quotation_acceptances` and sets `leads.status = 'closed_won'`. No execution project is created. Phase 8A must materialize one project per Closed-Won lead and complete PM handover without rewriting commercial truth.

---

## Decision Outcome

### 1. Separate post-Closed-Won materialization (OD8A-2)

Normal path: Phase 7B acceptance commits Closed-Won, then a **separate** Phase 8A server-side materializer creates or reuses the project.

- Do not rewrite the Phase 7B acceptance transaction
- Do not use a database trigger on Closed-Won
- Do not make “Create project” the normal staff path
- Automatic orchestration may call a service-role/internal materializer after successful acceptance
- Super Admin / Sales Manager repair/retry uses the same private implementation
- Retry is idempotent and returns the existing project
- Materializer re-proves Closed-Won + valid `quotation_acceptances` identity
- Materialization failure must never undo acceptance / Closed-Won

### 2. Project numbering (OD8A-1)

`OD-P-{YYYY}-{SEQ6}`: server/database-generated, Asia/Kolkata year, race-safe monotonic sequence within year, gaps permitted, unique, immutable after creation. UUID remains the technical PK.

### 3. Cardinality and commercial baseline

Exactly one execution project per Closed-Won lead (`lead_id` UNIQUE). Immutable linkage to `quotation_acceptance_id` plus accepted quotation root/version. `quotation_acceptances` remains the commercial ledger. Sales achievement remains `taxable_base_paise` (GST excluded). **Project-value reconciliation is deferred.** No second editable revenue field.

### 4. Handover state graph and PM reassignment (OD8A-3)

```
awaiting_project_manager_assignment
  → awaiting_project_manager_acceptance
  → handover_accepted
```

Only `super_admin` and `sales_manager` assign/reassign the single current primary PM. Target must be an active canonical `project_manager`. Sales Executive, PM, Designer, and Kriti cannot assign. PM cannot self-assign.

Reassignment is allowed **before or after** `handover_accepted`. Every reassignment closes the prior assignment, makes the new PM current primary, sets state to `awaiting_project_manager_acceptance`, and requires a new explicit acceptance. Former-PM accept attempts are rejected.

Handover is **accept-only** in V1 Phase 8A: explicit, audited, current-PM only, idempotent same-PM replay. No reject/request-changes workflow. No evidence-storage subsystem is required beyond the audit event.

### 5. PM reassignment requests (OD8A-4)

**Deferred.** No request table or ticket workflow in Phase 8A.

### 6. Visibility

Sales Executive: read-only high-level handover/status for own won-origin project. No mutation.

Designer: no Phase 8A workflow (Phase 8B). Execution stages: Phase 8C. No 8A cancel/archive.

### 7. No-ERP (ADR-0005)

Exclude accounting ledger, GST filing, procurement, purchase orders, inventory/warehouse, vendor payment ledger, labour dispatch, and autonomous operations.

---

## Consequences

### Positive

- Preserves Phase 7B commercial truth as a committed fact independent of project materialization
- Race-safe one-project-per-lead with repair without duplicate rows
- Reassignment cannot leave a stale PM able to accept or inherit handover

### Trade-offs

- Automatic materialization can lag Closed-Won; SA/SM repair is required
- Post-accept reassignment returns the project to awaiting PM acceptance and delays 8B/8C

### Implementation note

M28 is conceptually reserved as `closed_won_project_conversion_pm_handover` and is **not created by this ADR**. Recommended future permissions: `projects.read`, `projects.assign_pm`, `projects.accept_handover`. Mutations via SECURITY DEFINER RPCs; append-only assignment history and project events; private project idempotency ledger separate from quotations.

---

## Related Documents

- [Phase 8A architecture freeze](../audits/phase-8a-closed-won-project-pm-handover-architecture-freeze.md)
- [ADR-0020: Closed-Won Project Handover Invariants](ADR-0020-closed-won-project-handover-invariants.md)
- [ADR-0019: Five-Role CRM Authorization](ADR-0019-five-role-crm-authorization-model.md)
- [ADR-0022: V1 Direct Quotation Finalization and Send](ADR-0022-v1-direct-quotation-finalization-and-send.md)
- [ADR-0005: Version 1 No-ERP Boundary](ADR-0005-version-1-no-erp-boundary.md)
- [Decision Register](../10-decision-register.md)
