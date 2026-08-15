# 07 — CRM PIPELINE AND COMMERCIAL QUOTATION BOUNDARY

**Document Status:** Locked CRM & Quotation Baseline (truth-synced post Phase 8A complete / Phase 8B architecture freeze, August 15, 2026)
**Internal Prefix:** `/admin`
**Implementation Status:** CRM workspace merged (Phase 5C–5E); commercial quotation 7A/7B complete (PR #55). Phase 8A **COMPLETE** (PR #57 merged). Phase 8B architecture frozen; M29 **not created** (production not activated).

---

## 1. CRM Pipeline Workflow (Locked — Phase 5C+)

**Primary active progression:**

```
New → Assigned → Contacted → Qualified → Consultation Scheduled → Proposal Sent → Negotiation
```

**State graph (branches — not a single serial line):**

```
                              ┌──► Closed-Won (terminal; requires Accepted quotation)
                              │         └──► Project creation (Phase 8A only)
Negotiation ──┬──► On Hold ───┤              (Awaiting PM Assignment)
              │    (pause)    │
              │    resume     ├──► Closed-Lost (terminal; reason required)
              │               │
(any active) ─┴───────────────┘
```

| State | Type | Rules |
| :--- | :--- | :--- |
| **Closed-Won** | Terminal success | Requires Accepted authoritative quotation. Project creation **only** from Closed-Won. Must not normally transition to Closed-Lost or On Hold. |
| **Closed-Lost** | Terminal loss | From any permitted active stage; reason required. No project. |
| **On Hold** | Non-terminal pause | From permitted active stages; resumes via audited transition to permitted active stage. |

Reopening a terminal state requires explicit audited transition with reason.

### 1.1 Stage Rules
- **New:** Intake, manual entry, import, or WhatsApp-origin lead created.
- **Assigned:** Owner assigned (manual or source rule); Sales Executive sees only assigned leads.
- **Contacted / Qualified / Consultation Scheduled / Proposal Sent / Negotiation:** Standard active progression; all transitions audited.
- See state graph above for Closed-Won, Closed-Lost, and On Hold branch semantics.

### 1.2 Role Boundaries (Summary)

| Action | Super Admin | Sales Manager | Sales Executive | PM | Designer |
| :--- | :---: | :---: | :---: | :---: | :---: |
| View all leads | ✓ | ✓ | — | — | — |
| View assigned leads | ✓ | ✓ | ✓ | — | — |
| Manual lead (one) | ✓ | ✓ | ✓ (self-assign) | — | — |
| Bulk import | ✓ direct | submit | — | — | — |
| Assign/reassign lead | ✓ | ✓ | — | — | — |
| Create/finalize/send quotation (assigned lead) | ✓ | broad scope | ✓ (own assigned) | — | — |
| Assign PM | ✓ | ✓ | — | — | — |
| Assign Designer | ✓ | ✓ | — | — | — |

Full model: [ADR-0019](ADR/ADR-0019-five-role-crm-authorization-model.md).

---

## 2. Lead Sources & Assignment

### 2.1 Source Catalogue (Controlled)
Website; Website Planner; Google Organic; Google Ads; Google Business Profile; Instagram Organic; Instagram Ads; Facebook Organic; Facebook Ads; WhatsApp; Phone Call; Walk-in; Client Referral; Vendor Referral; Architect Referral; Interior Partner; Housing Society; Event or Exhibition; Offline Advertisement; Manual Entry; Other.

- One primary source per lead; zero or more touchpoints.
- Super Admin manages definitions; disabled sources remain on historical records.
- No uncontrolled free text as authoritative source.

### 2.2 Assignment
- **Manual:** Super Admin and Sales Manager only; audited.
- **Automated:** Source-based rules (Super Admin); optional service/locality/budget filters; active eligible target; fallback to **Unassigned** queue.
- **Round-robin excluded.**

### 2.3 Bulk Import Lifecycle
`Draft` → `Validation Failed` → `Ready for Review` → `Pending Super Admin Approval` → `Approved` / `Rejected` → `Importing` → `Completed` / `Completed with Errors` / `Cancelled`.

- Sales Executive: backend rejection.
- Sales Manager: cannot approve own batch.
- Super Admin: direct import after preview; approves manager batches.
- Never fabricate consent on imported rows.

---

## 3. Commercial Quotation Engine (Phase 7A/7B — Implemented)

### 3.1 Capabilities
- Lead/client/property linkage; room/area sections; line items with materials, measurements, quantities, rates.
- Tax, discount, total, validity, inclusions/exclusions, payment schedule.
- Warranty references without unverified claims.
- Immutable versions; premium PDF; auditable acceptance acknowledgement.

### 3.2 Lifecycle (state graph)

**Main path:** `Draft` → `Finalized/Frozen` → `Sent`

**Observed:** `Viewed` may occur after Sent without forcing the next outcome.

**Client interaction / outcomes:**

| Outcome | Type | Rules |
| :--- | :--- | :--- |
| **Accepted** | Terminal (version) | Authoritative for Closed-Won; cannot become Rejected or Expired |
| **Rejected** | Terminal (version) | Rejection of that version |
| **Expired** | Terminal (version) | Validity lapsed; must not override an already accepted version |
| **Revision Requested → Revised** | Loop | Staff creates one new mutable draft version; full finalize/send cycle for new version (no internal approval) |

See [ADR-0020](ADR/ADR-0020-closed-won-project-handover-invariants.md) and [ADR-0022](ADR/ADR-0022-v1-direct-quotation-finalization-and-send.md).

### 3.3 Quotation Authority (V1 — no internal approval)

- **Sales Executive:** create, edit draft, finalize/freeze, generate PDF (planned), and send for **currently assigned** leads only.
- **Sales Manager:** broad sales-scope create/edit/finalize/send; audit/history; controlled revoke/reissue when implemented. **No quotation approval action.**
- **Super Admin:** full commercial administrative scope; configure hard commercial bounds (when implemented); audited void/revoke. **No ordinary quotation approval step.**
- **Project Manager / Designer:** no Phase 7 quotation mutation or send authority.
- **Closed-Won requires Accepted quotation** (unchanged).

### 3.4 Client Acceptance
Auditable acknowledgement (hash, timestamp, client identifier, privacy-safe keyed network fingerprint if network evidence is needed) — **not** raw IP persistence; not automatic legal e-signature.

---

## 4. Closed-Won to Project Handover (Phase 8A — Architecture Freeze)

See [ADR-0020](ADR/ADR-0020-closed-won-project-handover-invariants.md) and [ADR-0024](ADR/ADR-0024-phase-8a-project-materialization-pm-handover.md).

1. Quotation **Accepted** (Phase 7B; already implemented).
2. Lead **Closed-Won** (atomic with acceptance; already implemented).
3. **Separate** Phase 8A materializer creates/reuses one project (`awaiting_project_manager_assignment`). M28 is managed-applied; PR #57 is merged.
4. Sales Manager or Super Admin assigns exactly **one primary PM**.
5. Status **Awaiting Project Manager Acceptance**.
6. Current PM accepts handover (`handover_accepted`).
7. Execution stages may activate **only in Phase 8C** (not in 8A).

- No execution or Designer assignment in Phase 8A (8B/8C).
- Sales Executive cannot assign PM; high-level read of own won-origin project only.
- SA/SM may reassign PM before or after handover acceptance; new PM must re-accept.
- One Lead Designer + Supporting Designers is Phase 8B (ADR-0025 / OD8B-1–OD8B-8; M29 not created).

---

## 5. Monthly Sales Targets (Phase 5E — Planned)

**Phase 5E — Sales Target Configuration & CRM Reporting Foundation**

| Role | Target configuration (V1) |
| :--- | :--- |
| Sales Executive | Personal monthly revenue target + Closed-Won count target |
| Sales Manager | **Team** monthly revenue + team Closed-Won count only |
| Super Admin | Sets, revises, locks, reopens all targets |

**Scope in Phase 5E:**
- Target assignments, append-only target history, lock/reopen controls, role visibility.
- Non-commercial CRM performance reporting (activity, pipeline movement, follow-ups).
- Revenue and Closed-Won **achievement** display as **unavailable / not activated** until Phase 7B.
- No manual self-reported revenue achievement. No placeholder numbers presented as real performance.

**Phase 7B:** Activates authoritative quotation-accepted revenue (`taxable_base_paise`; GST excluded from sales achievement) and Closed-Won achievement calculations.

**Phase 8A:** Project-value reconciliation is **deferred**. Sales achievement remains `quotation_acceptances.taxable_base_paise` (no double counting).

---

## 6. Version 1 Scope Boundary (No ERP)

CRM and project execution exclude: accounting ledgers, vendor POs, inventory, labour dispatch, vendor payments. PM and Designer roles **are in scope** for execution and design (ADR-0020).

---

## 7. Related Governance Documents

- [ADR-0019: Five-Role CRM Authorization](ADR/ADR-0019-five-role-crm-authorization-model.md)
- [ADR-0020: Closed-Won Handover](ADR/ADR-0020-closed-won-project-handover-invariants.md)
- [ADR-0022: V1 Direct Quotation Finalization and Send](ADR/ADR-0022-v1-direct-quotation-finalization-and-send.md)
- [ADR-0024: Phase 8A Project Materialization and PM Handover](ADR/ADR-0024-phase-8a-project-materialization-pm-handover.md)
- [Phase 8A Architecture Freeze](audits/phase-8a-closed-won-project-pm-handover-architecture-freeze.md)
- [Product Requirements](01-product-requirements.md)
- [ADR-0005: Version 1 No-ERP Boundary](ADR/ADR-0005-version-1-no-erp-boundary.md)
