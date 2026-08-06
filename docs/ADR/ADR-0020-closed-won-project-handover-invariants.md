# ADR-0020: Closed-Won Conversion and PM/Designer Assignment Invariants

**Status:** Accepted  
**Date:** July 30, 2026  
**Deciders:** Business Owner, Senior Product Architect  
**Technical Scope:** Sales-to-Operations Handover (Phase 5A freeze)

> **Partial supersession (August 6, 2026):** Quotation **approval** portions of this ADR are superseded by [ADR-0022: V1 Direct Quotation Finalization and Send Authority](ADR-0022-v1-direct-quotation-finalization-and-send.md). Current V1 quotation workflow is **Draft → Finalized/Frozen → Sent** (no internal Submitted for Approval / Approved states). All **Closed-Won, PM handover, Designer assignment, Phase 8 execution/design, and No-ERP invariants** below remain accepted unless explicitly noted in ADR-0022.

---

## Context and Problem Statement

Early documentation tied project creation to advance payment and described a simplified CRM pipeline. The approved operating model requires authoritative commercial acceptance before execution, explicit PM handover acceptance, and manual Designer staffing — without ERP scope creep.

Phase 4B2 delivered a disabled public intake path only. No CRM workspace, quotation engine, or project execution modules are live.

---

## Decision Drivers

- Commercial truth must flow from accepted quotation versions, not self-reported sales fields.
- Execution must not begin before PM accepts handover.
- Assignment authority must be limited to Sales Manager and Super Admin for PM and Designer roles.
- One primary PM per project; one Lead Designer plus zero or more Supporting Designers.
- Preserve No-ERP boundary while enabling project execution tracking.

---

## Decision Outcome

### Quotation prerequisite for Closed-Won

- **Closed-Won requires an Accepted authoritative quotation** (immutable version with auditable acceptance acknowledgement).
- Advance payment alone is not sufficient to mark Closed-Won or create an execution project.
- Sales Executive may create, finalize, and send quotations for **currently assigned** leads without manager approval (see ADR-0022). Sales Manager and Super Admin have broad-scope finalize/send authority within sales scope. Super Admin retains audited override/catalogue/discount/void authority.

### Quotation lifecycle (future — Phase 7 — state graph)

> **Historical note:** This section originally described Draft → Submitted for Approval → Approved → Sent. **Current V1 governance** is defined in ADR-0022.

**Current V1 main path:**

```
Draft → Finalized/Frozen → Sent
```

**Observed/interaction state:**

- **Viewed** may occur after Sent without forcing the next outcome.

**Alternative outcomes** (after a finalized/sent quotation):

| Outcome | Type | Rules |
| :--- | :--- | :--- |
| **Accepted** | Terminal (version) | Authoritative for Closed-Won. Cannot then become Rejected or Expired. Only one accepted authoritative version drives a given Closed-Won conversion unless a later formal commercial-change workflow is separately designed. |
| **Rejected** | Terminal (version) | Client or business rejection of that version. |
| **Expired** | Terminal (version) | Validity lapsed without acceptance. Must not silently override an already accepted version. |
| **Revision Requested → Revised Draft/New Version** | Loop | Staff creates one new mutable draft version; prior finalized versions remain immutable. Full finalize/send cycle for the new version (no internal approval). |

### Design workflow (future — Phase 8B — state graph)

**Main path:**

```
Brief Received → Measurement Pending → Measurement Completed → Concept Design
  → Internal Review → Client Review → Client Approved → Production Drawings
  → Production Ready → Design Completed
```

**Branches:**

| State | Type | Rules |
| :--- | :--- | :--- |
| **Revision Required** | Loop | May branch from Internal Review or Client Review; loops back to the appropriate design stage. |
| **Design On Hold** | Non-terminal pause | From permitted active stages; resumes through audited transition. Not a post-completion step. |
| **Design Completed** | Terminal | Approved design package complete. |

- Files/deliverables versioned; never silently overwritten.
- Production Ready requires Lead Designer approval and evidence.
- Client approvals require evidence.
- PM remains primary execution coordinator.

### Project execution stages (future — Phase 8C — state graph)

**Main path:**

```
Project Created → Site Measurement → Design Development → Design Approval
  → Material Finalisation → Production → Ready for Dispatch → Delivery
  → Installation → Snag Resolution → Handover → Completed
```

**Branches:**

| State | Type | Rules |
| :--- | :--- | :--- |
| **On Hold** | Non-terminal pause | From permitted active (non-completed) stages; reason required; resumes through audited transition. Completed must not normally transition to On Hold. |
| **Cancelled** | Terminal alternative | From permitted non-completed stages; authority and reason required. |

- PM updates permitted stages on assigned projects only.
- Important transitions require evidence/reason per Phase 8 contract.
- Sales Executive sees high-level status for projects from own won leads but cannot control execution.

### Locked Closed-Won → project flow

1. Quotation **Accepted**.
2. Lead marked **Closed-Won** (audited).
3. Project created as **Awaiting Project Manager Assignment**.
4. Only **Sales Manager** or **Super Admin** manually assigns/reassigns PM (exactly one primary PM in V1).
5. Status becomes **Awaiting Project Manager Acceptance**.
6. PM reviews scope/commercial summary and **accepts handover**.
7. Execution stages may become active.

**Invariants:**

- No execution before PM acceptance.
- Sales Executive cannot assign PM.
- PM may request reassignment but cannot execute assignment changes.
- No project from Closed-Lost or incomplete sales states.

### Designer assignment (manual only)

- Multiple Designer accounts; exactly **one Lead Designer** and **zero or more Supporting Designers** per project.
- Assignment/reassignment/removal only by Sales Manager or Super Admin.
- PM cannot assign Designers; may request.
- Designers cannot self-assign.
- All assignment changes audited.

### Explicit exclusions (unchanged No-ERP)

No accounting ledger/GST filing, procurement/PO, inventory/warehouse, labour attendance/dispatch, vendor payment ledger, or autonomous operational control.

---

## Consequences

### Positive

- Clear gate between sales closure and operations start.
- Prevents premature site/production activity without PM accountability.

### Negative / trade-offs

- Additional handover step may delay execution start until PM acceptance.
- Requires quotation module (Phase 7) before Closed-Won automation (Phase 8A).

### Implementation phases

- **Phase 7A/7B:** Quotation data foundation, finalize/send workflow (no internal approval — ADR-0022), PDF, acceptance; **7B activates authoritative target achievement from accepted quotations** (`taxable_base_paise`; GST excluded from achievement).
- **Phase 8A:** Closed-Won conversion and PM handover; optional project-value reconciliation without double counting.
- **Phase 8B:** Designer assignment and design collaboration.
- **Phase 8C:** Project execution workspace.

---

## Related Documents

- [ADR-0005: Version 1 No-ERP Boundary](ADR-0005-version-1-no-erp-boundary.md)
- [ADR-0019: Five-Role CRM Authorization Model](ADR-0019-five-role-crm-authorization-model.md)
- [ADR-0022: V1 Direct Quotation Finalization and Send Authority](ADR-0022-v1-direct-quotation-finalization-and-send.md)
- [CRM & Quotation Boundary](../07-crm-and-quotation-boundary.md)
