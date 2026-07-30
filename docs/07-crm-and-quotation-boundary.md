# 07 — CRM PIPELINE AND COMMERCIAL QUOTATION BOUNDARY

**Document Status:** Locked CRM & Quotation Baseline (reconciled Phase 5A, July 30, 2026)
**Internal Prefix:** `/admin`
**Implementation Status:** Architecture frozen; **CRM workspace not yet built**

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
| Approve quotation | override | policy | — | — | — |
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

## 3. Commercial Quotation Engine (Phase 7 — Planned)

### 3.1 Capabilities
- Lead/client/property linkage; room/area sections; line items with materials, measurements, quantities, rates.
- Tax, discount, total, validity, inclusions/exclusions, payment schedule.
- Warranty references without unverified claims.
- Immutable versions; premium PDF; auditable acceptance acknowledgement.

### 3.2 Lifecycle (state graph)

**Main path:** `Draft` → `Submitted for Approval` → `Approved` → `Sent`

**Observed:** `Viewed` may occur after Sent without forcing the next outcome.

**Alternative outcomes:**

| Outcome | Type | Rules |
| :--- | :--- | :--- |
| **Accepted** | Terminal (version) | Authoritative for Closed-Won; cannot become Rejected or Expired |
| **Rejected** | Terminal (version) | Rejection of that version |
| **Expired** | Terminal (version) | Validity lapsed; must not override an already accepted version |
| **Revision Requested → Revised** | Loop | New immutable version → Submitted for Approval again |

See [ADR-0020](ADR/ADR-0020-closed-won-project-handover-invariants.md) for full contract.

### 3.3 Approval Authority
- Sales Executive: drafts for own leads only.
- Sales Manager: approves within configured owner policy.
- Super Admin: audited override, catalogue, discount, void authority.
- **Closed-Won requires Accepted quotation.**

### 3.4 Client Acceptance
Auditable acknowledgement (hash, timestamp, client identifier, IP) — not automatic legal e-signature.

---

## 4. Closed-Won to Project Handover (Phase 8A — Planned)

See [ADR-0020](ADR/ADR-0020-closed-won-project-handover-invariants.md).

1. Quotation **Accepted**.
2. Lead **Closed-Won**.
3. Project **Awaiting Project Manager Assignment**.
4. Sales Manager or Super Admin assigns exactly **one primary PM**.
5. Status **Awaiting Project Manager Acceptance**.
6. PM accepts handover.
7. Execution stages may activate.

- No execution before PM acceptance.
- Sales Executive cannot assign PM.
- One Lead Designer + Supporting Designers assigned manually by Manager/Admin only.

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

**Phase 7B:** Activates authoritative quotation-accepted revenue and Closed-Won achievement calculations.

**Phase 8A (optional):** Project-value reconciliation when business chooses project value as authoritative measure; no double counting with quotation acceptance.

---

## 6. Version 1 Scope Boundary (No ERP)

CRM and project execution exclude: accounting ledgers, vendor POs, inventory, labour dispatch, vendor payments. PM and Designer roles **are in scope** for execution and design (ADR-0020).

---

## 7. Related Governance Documents

- [ADR-0019: Five-Role CRM Authorization](ADR/ADR-0019-five-role-crm-authorization-model.md)
- [ADR-0020: Closed-Won Handover](ADR/ADR-0020-closed-won-project-handover-invariants.md)
- [Product Requirements](01-product-requirements.md)
- [ADR-0005: Version 1 No-ERP Boundary](ADR/ADR-0005-version-1-no-erp-boundary.md)
