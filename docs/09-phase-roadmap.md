# 09 — PHASE IMPLEMENTATION ROADMAP

**Document Status:** Locked Roadmap (truth-synced post DB-2, August 1, 2026)
**Current Phase:** Phase 5C — Lead Workspace & Premium Role-Aware CRM (**in progress**)
**Next Implementation Phase:** Remaining Phase 5C lead-workspace mutation/collaboration scope (next subphase preflight)

---

## 1. Completed Baseline (Repository Evidence)

```
Phase 1A: Read-Only Project Baseline Audit ───────────────────────── COMPLETED
Phase 1B: Architecture, Scope & Decision Freeze ──────────────────── COMPLETED
Phase 1C: Documentation Baseline & Clean Git Setup ───────────────── COMPLETED
Phase 2A: Next.js Engineering Scaffold & Quality Baseline ────────── COMPLETED
Phase 2B: Supabase SSR Connection Foundation ─────────────────────── COMPLETED
Phase 2C / 2C1 / 2C2 / 2C3: Identity & RBAC (remote deployed) ─────── COMPLETED
Phase 2D1: Staff Auth, authorize RPC, Proxy Guard & Admin Shell ──── COMPLETED
Phase 2D2: Active Staff Authorization & Super Admin Bootstrap ────── COMPLETED
Phase 2E1 / 2E1A: Portfolio Data & Media Storage Foundation ──────── COMPLETED
Phase 2E2 / 2E2A: Portfolio Admin CMS & Secure Media Pipeline ───── COMPLETED
Phase 2E3A / 2E3B / 2E3C / 2E3D: Public Portfolio Experience ─────── COMPLETED
Phase 3: Premium Public Site, Design & Legal Presentation Foundation ─ COMPLETED*
Phase 4A: Secure Lead Intake Data Plane ──────────────────────────── COMPLETED
Phase 4A.1: Pre-Apply Security Correction ────────────────────────── COMPLETED
Phase 4B1: Managed Migration 9 Apply & Verification ────────────── COMPLETED
Phase 4B2: Migration 10, Dual-Gated Public Form, Activation Readiness COMPLETED**
Phase 5A: CRM & Operations Architecture Freeze ───────────────────── COMPLETED
Phase 5B: CRM Identity, Authorization & Core Data Foundation ─────── COMPLETED
Phase 5C1: Premium Read-Only CRM Workspace ─────────────────────── COMPLETED
Phase 5C2A: Lead Assignment Mutations ───────────────────────────── COMPLETED
Phase DB-2: Managed Migrations 11–13 Apply (OneDecore Supabase) ─── COMPLETED
```

\*Phase 3 scope delivered to the extent proved by merged premium homepage (R4/R5), legal pages, and design tokens — not a separate numbered migration phase.
\*\*Public intake **not activated**; defaults remain `copy-only` + server `disabled`.

---

## 2. Forward Roadmap

```
Phase 5A ──► CRM & Operations Architecture Freeze [COMPLETED]
    │
    ▼
Phase 5B ──► CRM Identity, Authorization & Core Data Foundation [COMPLETED]
    │
    ▼
Phase 5C ──► Lead Workspace & Premium Role-Aware CRM [IN PROGRESS]
    │         • 5C1: read-only workspace — COMPLETED
    │         • 5C2A: assignment mutations — COMPLETED
    │         • Remaining: manual lead creation, duplicate-safe flows,
    │           further collaboration mutations (next subphase)
    ▼
Phase 5D ──► Bulk Import Approval & Source-Based Assignment
    │         • CSV/XLSX import batches, mapping, preview, manager approval
    │         • Super Admin direct import + source rules + Unassigned fallback
    │         • No round-robin
    ▼
Phase 5E ──► Sales Target Configuration & CRM Reporting Foundation
    │         • Target assignments, history, lock/reopen, role visibility
    │         • Non-commercial CRM reporting; achievement inactive until 7B
    ▼
Phase 5F ──► Controlled Public Lead Activation Gate
    │         • Owner/legal/proxy/secrets/monitoring/rollback evidence required
    │         • Separate explicit authorization only
    ▼
Phase 6A ──► Meta WhatsApp Data & Webhook Foundation
    ▼
Phase 6B ──► Premium Shared Inbox & Controlled Outbound Messaging
    ▼
Phase 6C ──► Groq Human-Controlled Copilot
    ▼
Phase 7A ──► Commercial Quotation Data Foundation
    ▼
Phase 7B ──► Quotation Workflow, Premium PDF & Acceptance
    │         • Activates authoritative accepted-quotation target achievement
    ▼
Phase 8A ──► Closed-Won Project Conversion & PM Handover
    │         • Optional project-value reconciliation (no double counting)
    ▼
Phase 8B ──► Designer Assignment & Design Collaboration
    ▼
Phase 8C ──► Project Execution Workspace
    ▼
Phase 9A ──► Campaign Consent, Audience & Approval Foundation
    ▼
Phase 9B ──► Campaign Execution, Replies & Attribution
    ▼
Phase 10 ──► Security Hardening, Full E2E, Performance & Deployment
```

---

## 3. Phase Objectives & Exit Gates

### Phase 5A (Completed)
- **Objective:** Reconcile truth/PRD/architecture/data/security/boundary docs; lock roles, visibility, workflows, invariants; ADRs + audit.
- **Exit gate:** Owner approval of architecture freeze; no code/migrations.
- **Deliverables:** ADR-0019, ADR-0020, ADR-0021; updated governance docs; Phase 5A audit.

### Phase 5B (Completed)
- **Objective:** Five-role RBAC extension; core CRM schemas with RLS; server repositories; pgTAP coverage.
- **Exit gate:** All CRM core tables RLS-tested; legacy role remap migration applied locally; `npm run check` + `check:db` green.
- **Dependencies:** 5A approved.
- **Managed apply:** Migration 11 applied August 1, 2026 (with 12–13 in ordered DB-2 push).

### Phase 5C1 (Completed)
- **Objective:** Premium read-only CRM workspace under `/admin/crm`.
- **Exit gate:** Role-aware navigation, lead list/detail, RLS-backed reads; migration 12 applied managed.
- **Dependencies:** 5B.

### Phase 5C2A (Completed)
- **Objective:** Assign, reassign, and safe-unassign via hardened `assign_lead` RPC.
- **Exit gate:** PR #7 merged; migration 13 applied managed; full QA green.
- **Dependencies:** 5C1.

### Phase 5C (In progress — overall exit gate not met)
- **Objective:** Premium role-aware CRM UI for leads (not WhatsApp/quotations/projects).
- **Exit gate:** Executive isolation proven via RLS tests; manual lead + duplicate flows E2E locally.
- **Dependencies:** 5B.

### Phase 5D
- **Objective:** Bulk import approval chain; source-based assignment rules.
- **Exit gate:** Manager cannot approve own batch; executive bulk rejected; Unassigned fallback verified.
- **Dependencies:** 5C.

### Phase 5E
- **Objective:** Monthly target configuration, append-only target history, lock/reopen controls, role visibility, and non-commercial CRM performance reporting.
- **Exit gate:** Target configuration/history/permissions and non-commercial CRM reporting proven; **commercial achievement explicitly inactive** (displayed unavailable/not activated).
- **Dependencies:** 5C.

### Phase 5F
- **Objective:** Controlled public lead activation only after legal/owner evidence.
- **Exit gate:** Separate owner authorization; rollback runbook exercised.
- **Dependencies:** 4B2 merged; legal gates complete.

### Phases 6–9
See [Phase 5A Audit](audits/phase-5a-crm-architecture-freeze.md) and ADRs 0020–0021.

### Phase 7B
- **Objective:** Quotation workflow, premium PDF, client acceptance.
- **Exit gate:** Authoritative accepted-quotation revenue and Closed-Won achievement calculations proven and tested.
- **Dependencies:** 7A.

### Phase 8A
- **Objective:** Closed-Won project conversion and PM handover.
- **Exit gate:** Project-value reconciliation (when used) proven without double counting against quotation acceptance.
- **Dependencies:** 7B.

### Phase 10
- **Objective:** Security hardening, full E2E, performance budgets, Hostinger VPS deployment.
- **Exit gate:** Production deployment authorized separately; all prior phase exit gates met.

---

## 4. Dependency Rules

1. No public lead activation (5F) before legal/owner gates and 4B2 readiness evidence.
2. No Closed-Won project conversion (8A) before quotation acceptance (7B).
3. No WhatsApp outbound (6B) before webhook foundation (6A) and consent records.
4. No Groq copilot (6C) before message persistence (6A).
5. No campaigns (9A/9B) before consent/suppression foundation.
6. ERP modules remain out of scope for all phases (ADR-0005).
7. Authoritative target achievement requires Phase 7B (quotation acceptance); Phase 5E configures targets only.
8. Project-value reconciliation (Phase 8A) must not double-count quotation acceptance.

---

## 5. Related Governance Documents

- [Project Truth](00-project-truth.md)
- [Phase 5A Audit](audits/phase-5a-crm-architecture-freeze.md)
- [Decision Register](10-decision-register.md)
- [ADR-0019: Five-Role CRM Authorization](ADR/ADR-0019-five-role-crm-authorization-model.md)
