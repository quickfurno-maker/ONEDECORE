# 07 — CRM PIPELINE AND COMMERCIAL QUOTATION BOUNDARY

**Document Status:** Locked CRM & Quotation Baseline (truth-synced through Phase 9B architecture freeze, August 18, 2026)
**Internal Prefix:** `/admin`
**Implementation Status:** CRM workspace merged (Phase 5C–5E); commercial quotation 7A/7B complete (PR #55). Phase 8A **COMPLETE** (PR #57 merged). Phase 8B **COMPLETE** (PR #59 merged `6b31052973cf9e50e25803b232ce446308c1fa3a`). Phase 8C **COMPLETE** (ADR-0026 / DEC-0075–DEC-0076; PR #61 true merge `8f4f3ecf082450e82ab15f02703c951e50f0817e`; production not activated). Phase 9A **COMPLETE** (ADR-0027 / DEC-0077–DEC-0080; PR #62 merged `caff9d0864e1546dff38646df4355dafa851a473`; PR #63 true merge `26e6346ef6722b7c6ff5908c12f208854b513ad6`; M31 managed immutable). Phase 9D-A **ARCHITECTURE_FROZEN** (ADR-0030 / DEC-0083); `/shop` **not implemented**. Guest checkout does not auto-create interior leads. Interior quotation ecommerce remains Phase 7 — not `/shop`.

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

## 1a. Pipeline Stage is NOT the Sales Bucket

Two independent dimensions. Neither replaces the other, and both are shown side
by side in the Leads workspace.

**Pipeline stage — how far the work has got.** Owner-locked, audited, and the
only thing a transition changes:

```
new → assigned → contacted → qualified → consultation → proposal → negotiation → won / lost
                                                                 (or on hold, a pause)
```

**Sales bucket — how the owner organises selling effort.** Derived, never
stored, never manually set:

| Bucket | Meaning |
| :--- | :--- |
| **HOT** | Strongest operational queue — call these first. |
| **WARM** | Nurture and convert. |
| **COLD** | Lower intent — re-engagement. |
| **LOST** | Terminal. Kept out of the active conversion queues. |
| **WON** | Terminal success. |
| **ON HOLD** | Parked by decision. |

Resolution is a total function of `(lifecycle status, canonical score band)`, in
`src/features/crm/contracts/lead-sales-bucket.ts`:

1. `closed_lost` → **LOST**
2. `closed_won` → **WON**
3. `on_hold` → **ON_HOLD**
4. otherwise, score band `HOT` → **HOT**
5. otherwise, score band `WARM` → **WARM**
6. otherwise (`NURTURE` or `COLD`) → **COLD**

Lifecycle outcome beats temperature: a lost lead is LOST no matter how hot it
once scored, because ranking dead work at the top of a call queue is worse than
losing the temperature detail.

**NURTURE still exists.** The canonical score engine
(`lead-score-contracts.ts`) keeps all four bands — HOT ≥ 70, WARM ≥ 45,
NURTURE ≥ 20, COLD ≥ 0 — and none of those thresholds moved. The owner asked
for a simple HOT / WARM / COLD language, so NURTURE collapses into COLD **only
at the user-facing bucket layer**. The band itself stays visible in the score
chip.

There is deliberately **no manual temperature override**: a rep-controlled
HOT/WARM/COLD goes stale, can be gamed, and would contradict the deterministic
score. A future owner-authorized override needs actor, reason, timestamp,
expiry and an audit trail, and is out of scope.

Site visit and quotation state remain their **own** milestones, and both are
rendered as separate columns beside the bucket and the stage. They feed the
canonical score as input signals where the existing architecture already uses
them, but they never become the lead's sales bucket:

| Lead | Bucket | Stage | Site visit | Quotation |
| :--- | :--- | :--- | :--- | :--- |
| A | HOT | Negotiation | Completed | Issued to client |
| B | WARM | Qualified | Scheduled | None |
| C | LOST | Closed Lost | Completed | Issued to client |

**Site visit** is derived only from `lead_follow_ups` rows with
`activity_type = 'site_visit'`, through the canonical `open` / `completed` /
`cancelled` status vocabulary (`scheduled` is the display name for an open
visit). It is **never** inferred from the `consultation_scheduled` pipeline
stage — that is a different fact, reachable without any site visit existing.

**Quotation** reuses the canonical commercial state already resolved for deal
value (`unknown` / `draft` / `finalized` / `issued` / `accepted`) with its
existing labels. There is no second quotation state model.

## 1b. Lead Received Month

The Leads workspace is organised month by month. **Month means the month the
lead was RECEIVED**, in Asia/Kolkata, from `public.leads.created_at` — never
`updated_at`, so a lead cannot jump from August to September because someone
edited it in September.

Boundaries are half-open, `created_at >= month_start AND created_at <
next_month_start`, computed at the fixed +05:30 offset (no DST). September 2026
therefore begins at `2026-08-31T18:30:00Z`.

This is **cohort** reporting, not outcome reporting. A lead received in August
and lost in September stays in the August cohort and is counted there; it is
labelled "Leads received in August 2026" and never "lost in August". Anything
that needs "lost during September" belongs in Reports, keyed on the actual
transition timestamp.

Bucket counts are exact for the whole received-month cohort and the active
non-bucket filters — the bucket is resolved for every candidate row **before**
counting, filtering and pagination, so a count is never a count of the current
page. The cohort is read in bounded chunks under the caller's RLS.

Bucket counts are core sales numbers, so they **fail closed**: if the cohort
exceeds the read ceiling the counts are marked non-exact and the strip renders
them as `—` with an explanation, rather than showing a partial figure that looks
authoritative. The rows themselves stay correctly ranked.

The month and the bucket are the workspace's organisation, not ordinary filters.
They are carried as hidden fields on the filter form and preserved by the Clear
control and every pagination link, so applying a secondary filter can never move
the operator to a different cohort without their asking.

Ordering uses the **canonical primary next action** (`is_primary_next_action`
and still open), never any open follow-up: a generic follow-up would let a lead
with nothing actually scheduled escape the `no_next_action` urgency rank.

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
7. Execution stages may activate **only in Phase 8C after `handover_accepted` and `design_completed`** (ADR-0026; not in 8A).

- No execution or Designer assignment in Phase 8A (8B/8C).
- Sales Executive cannot assign PM; high-level read of own won-origin project only.
- SA/SM may reassign PM before or after handover acceptance; new PM must re-accept.
- One Lead Designer + Supporting Designers is Phase 8B (ADR-0025 / OD8B-1–OD8B-8; M29 managed-applied; PR #59 **merged**).
- Phase 8C persisted path is post-design only (ADR-0026 / OD8C-1–OD8C-12). M30 is not created.

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

CRM and project execution exclude: accounting ledgers, vendor POs, warehouse inventory, labour dispatch, vendor payments. PM and Designer roles **are in scope** for execution and design (ADR-0020). Phase 9D later adds **store SKU stock** for ready-made furniture only (ADR-0028 / ADR-0030) — not WMS. Furniture orders do **not** become projects.

---

## 7. Related Governance Documents

- [ADR-0019: Five-Role CRM Authorization](ADR/ADR-0019-five-role-crm-authorization-model.md)
- [ADR-0020: Closed-Won Handover](ADR/ADR-0020-closed-won-project-handover-invariants.md)
- [ADR-0022: V1 Direct Quotation Finalization and Send](ADR/ADR-0022-v1-direct-quotation-finalization-and-send.md)
- [ADR-0024: Phase 8A Project Materialization and PM Handover](ADR/ADR-0024-phase-8a-project-materialization-pm-handover.md)
- [Phase 8A Architecture Freeze](audits/phase-8a-closed-won-project-pm-handover-architecture-freeze.md)
- [ADR-0025: Phase 8B Designer Assignment and Design Collaboration](ADR/ADR-0025-phase-8b-designer-assignment-design-collaboration.md)
- [ADR-0026: Phase 8C Project Execution Workspace](ADR/ADR-0026-phase-8c-project-execution-workspace.md)
- [Phase 8C Architecture Freeze](audits/phase-8c-project-execution-workspace-architecture-freeze.md)
- [Product Requirements](01-product-requirements.md)
- [ADR-0005: Version 1 No-ERP Boundary](ADR/ADR-0005-version-1-no-erp-boundary.md)
- [ADR-0028: Phase 9D Ready-Made Furniture E-commerce](ADR/ADR-0028-phase-9d-ready-made-furniture-ecommerce.md)
- [ADR-0030: Phase 9D architecture freeze](ADR/ADR-0030-phase-9d-ready-made-furniture-ecommerce-architecture.md)

<!-- PHASE_9B_ARCHITECTURE_FREEZE_START -->
## Phase 9B CRM Attribution Boundary

Landing Page Lab does not own lead identity, lead quality, quotation state, or commercial truth.

Authoritative flow:

`Landing exposure → existing secure lead intake → CRM lead → existing lead_source_touchpoints → existing CRM stages → quotation/project truth`

Phase 9B reuses:

- `leads.landing_path`;
- `leads.attribution`;
- `lead_source_touchpoints`;
- CRM states `qualified`, `consultation_scheduled`, `proposal_sent`, and later `closed_won`.

M32 may forward-only enrich the existing first-touchpoint trigger with trusted landing/campaign metadata. It must not modify historical M11/M17 or add a competing attribution/lead-quality lifecycle.

Quotation and Closed-Won rules remain unchanged.
<!-- PHASE_9B_ARCHITECTURE_FREEZE_END -->
