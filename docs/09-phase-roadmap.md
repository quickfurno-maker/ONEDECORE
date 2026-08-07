# 09 — PHASE IMPLEMENTATION ROADMAP

**Document Status:** Locked Roadmap (truth-synced post Phase 6A closeout, August 7, 2026)
**Current Phase:** Phase 6A — Meta WhatsApp Data & Webhook Foundation (**COMPLETE**)
**Next Implementation Phase:** Phase 6B — Premium Shared Inbox & Controlled Outbound Messaging (**runtime NOT STARTED**)

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
Phase 5C2B: Manual Lead Creation & Duplicate-Safe Flow ───────────── COMPLETED
Phase 5C2C: Lifecycle Collaboration Mutations ───────────────────── COMPLETED
Phase 5C-Closeout: Integrated CRM Invariant Audit ─────────────────── COMPLETED
Phase DB-2: Managed Migrations 11–13 Apply (OneDecore Supabase) ─── COMPLETED
Phase DB-3B: Managed Migration 14 Apply (OneDecore Supabase) ─────── COMPLETED
Phase 5D: Bulk Import Approval & Source-Based Assignment ─────────── COMPLETED
  • Implementation merged (PR #13)
  • Migration 15 applied managed (Phase DB-4B, August 3, 2026)
  • Closeout truth-sync: current PR
Phase DB-4A-X / DB-4B: M15 logical recovery checkpoint + managed apply ─ COMPLETED
Phase 5E: Sales Target Configuration & CRM Reporting Foundation ───── COMPLETED
  • 5E-A: architecture preflight frozen
  • 5E-B: implementation complete (PR #15 merged)
  • 5E-C: PR gate complete
  • DB-5A-L: verified logical recovery checkpoint accepted
  • DB-5B: managed M16 apply complete
  • Closeout truth-sync: current PR
Phase DB-5A-L / DB-5B: M16 logical recovery checkpoint + managed apply ─ COMPLETED
Phase 5F: Controlled Public Lead Activation Gate ─────────────────── READY TO CLOSE
  • 5F-A: architecture/evidence preflight frozen
  • 5F-B: implementation complete (PR #17 merged)
  • 5F-C: PR gate complete
  • H1: real browser/mobile QA PASS
  • DB-6A: physical recovery Route A (backup 1281893546)
  • DB-6B: managed M17 apply complete
  • Closeout truth-sync: current PR
Phase DB-6A / DB-6B: M17 physical recovery readiness + managed apply ─ COMPLETED
Phase 6A: Meta WhatsApp Data & Webhook Foundation ─────────────────── COMPLETED
  • 6A implementation merged; M18 applied managed (DB-7B, August 7, 2026)
  • DB-7A-R2: physical recovery Route A (backup 1306358570)
  • Foundation only — no deployment; no Meta callback/token; no outbound; no n8n/Kriti activation
  • Closeout truth-sync: current PR
Phase DB-7A-R2 / DB-7B: M18 physical recovery readiness + managed apply ─ COMPLETED
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
Phase 5C ──► Lead Workspace & Premium Role-Aware CRM [COMPLETED]
    │         • 5C1: read-only workspace
    │         • 5C2A: assignment mutations
    │         • 5C2B: manual lead + duplicate-safe flow
    │         • 5C2C: lifecycle collaboration
    ▼
Phase 5D ──► Bulk Import Approval & Source-Based Assignment [COMPLETED]
    │         • CSV/XLSX import batches, mapping, preview, manager approval
    │         • Super Admin direct import + source rules + Unassigned fallback
    │         • No round-robin; M15 applied managed
    ▼
Phase 5E ──► Sales Target Configuration & CRM Reporting Foundation [COMPLETED]
    │         • Monthly target config, append-only history, lock/reopen
    │         • SA-only mutation; role-scoped reads; non-commercial reporting
    │         • M16 applied managed; achievement inactive until 7B
    ▼
Phase 5F ──► Controlled Public Lead Activation Gate [COMPLETED]
    │         • M17 applied managed; public intake remains inactive
    ▼
Phase 6A ──► Meta WhatsApp Data & Webhook Foundation [COMPLETED]
    │         • M18 foundation managed; webhook ingestion schema only
    │         • No production Meta callback/token/outbound activation
    ▼
Phase 6B ──► Premium Shared Inbox & Controlled Outbound Messaging [NEXT — runtime NOT STARTED]
    ▼
Phase 6C ──► Groq Human-Controlled Copilot
    ▼
Phase 7A ──► Commercial Quotation Data & Draft Foundation
    ▼
Phase 7B ──► Quotation Finalization, Premium PDF, Secure Delivery & Client Acceptance
    │         • No internal quotation approval (ADR-0022)
    │         • Activates authoritative accepted-quotation target achievement (`taxable_base_paise`)
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
Phase 9B ──► Landing Page Lab & Experimentation [ROADMAP-LOCKED — NOT IMPLEMENTED]
    │         • Landing page factory; reusable structured blocks
    │         • Campaign-specific variants; preview/publish/pause/archive
    │         • A/B/C experiments; UTM attribution; fbclid/gclid preservation
    │         • CRM lead-quality linkage; variant analytics; experiment history
    │         • Role-aware admin access; CRM/Supabase remains source of truth
    ▼
Phase 9C ──► Campaign Execution, Attribution & Conversion Feedback [NOT IMPLEMENTED]
    │         • Meta/Google campaign execution integrations (where approved)
    │         • Server-side conversion feedback; QualifiedLead / ConsultationScheduled / ProposalSent
    │         • Authoritative later commercial conversion; attribution comparison
    │         • Cost per lead / qualified lead / later commercial conversion; no double counting
    ▼
Phase 10 ──► Security Hardening, Full E2E, Performance & Deployment
```

**Landing Page Lab principles (9B):** Structured blocks (not unrestricted drag-and-drop V1); optimize for qualified outcomes; public submissions reuse controlled intake architecture; no fabricated marketing consent; production use remains Phase 10 gated.

---

## 3. Phase Objectives & Exit Gates

### Phase 5C (Completed)
- **Objective:** Premium role-aware CRM UI for leads (not WhatsApp/quotations/projects).
- **Exit gate:** Executive isolation proven; manual lead + duplicate + lifecycle flows E2E; closeout merged.
- **Dependencies:** 5B.

### Phase 5D (Completed)
- **Objective:** Bulk import approval chain; source-based assignment rules.
- **Exit gate:** Manager cannot approve own batch; executive bulk rejected; Unassigned fallback verified; imported leads use `entry_method=import` and `source=bulk-import`; M15 applied managed.
- **Dependencies:** 5C.
- **Closeout:** [Phase 5D Closeout Audit](audits/phase-5d-bulk-import-source-assignment-closeout.md)

### Phase 5E (Completed)
- **Objective:** Monthly target configuration, append-only target history, lock/reopen controls, role visibility, and non-commercial CRM performance reporting.
- **Exit gate:** Target configuration/history/permissions and non-commercial CRM reporting proven; M16 applied managed; **commercial achievement explicitly inactive** until Phase 7B.
- **Dependencies:** 5D complete; PR #15 merged; DB-5A-L + DB-5B complete.
- **Closeout:** [Phase 5E Closeout Audit](audits/phase-5e-sales-targets-reporting-closeout.md)

### Phase 5F (Completed)
- **Objective:** Controlled public lead activation hardening (identity, DNC, loopback); **not** production activation.
- **Exit gate:** PR #17 merged; M17 applied managed (DB-6B); DB-6A physical recovery Route A; H1 browser QA PASS; governance closeout merged.
- **Dependencies:** 4B2 merged; 5F-A preflight complete.
- **Status:** Public intake **inactive** (`copy-only` / `disabled`); production activation Phase 10 only.
- **Closeout:** `docs/audits/phase-5f-controlled-public-lead-activation-closeout.md`

### Phase 6A (Completed)
- **Objective:** Meta WhatsApp data model and verified webhook **foundation** (managed schema + server ingest RPCs).
- **Exit gate:** M18 applied managed (DB-7B); seven tables RLS-enabled; service-role-only ingest RPCs; private helpers hardened; pre-existing business data unchanged; consent boundary documented.
- **Dependencies:** Phase 5F closeout merged.
- **Status:** **COMPLETE** — foundation managed only. **No deployment**; **no production Meta callback/token**; **no outbound WhatsApp**; **no n8n/Kriti activation**; **public intake inactive**. CRM consent (`contacts` / `contact_channels` / `consent_events`) remains authoritative; M18 does not grant `MARKETING` consent or fabricate consent from inbound messages.
- **Closeout:** `docs/audits/phase-6a-meta-whatsapp-data-webhook-foundation.md`

### Phase 6B (Next — runtime not started)
- **Objective:** Premium shared inbox and controlled outbound messaging (`WHATSAPP_SERVICE` boundary).
- **Exit gate:** Role-scoped inbox, controlled outbound, consent/DNC/template gates — **not yet implemented**.
- **Dependencies:** Phase 6A complete (M18 managed).
- **Status:** Architecture may be frozen in ignored artifacts; **runtime NOT STARTED**. No M19 allocated in Phase 6A closeout.

### Phase 6C (Architecture frozen / runtime not started)
- **Objective:** Groq human-controlled copilot (summarize, draft, suggest, explain only).
- **Status:** **NOT STARTED** — no production Kriti runtime; no autonomous send or mutation.

### Phases 7–8
See [Phase 5A Audit](audits/phase-5a-crm-architecture-freeze.md) and ADRs 0020–0021.

### Phase 7A
- **Objective:** Commercial quotation data and draft foundation (planned).
- **Exit gate:** Draft editor, canonical money calculation, one-mutable-draft invariant, RLS foundation proven.
- **Dependencies:** Phase 6 sequencing per owner roadmap.

### Phase 7B
- **Objective:** Quotation finalization (no internal approval), premium PDF, secure delivery via Phase 6B, client acceptance.
- **Exit gate:** Authoritative accepted-quotation revenue (`taxable_base_paise`) and Closed-Won achievement calculations proven and tested.
- **Dependencies:** 7A.

### Phase 8A
- **Objective:** Closed-Won project conversion and PM handover.
- **Exit gate:** Project-value reconciliation (when used) proven without double counting against quotation acceptance.
- **Dependencies:** 7B. **Closed-Won remains blocked until 7B.**

### Phase 9B (Landing Page Lab)
- **Status:** Owner-approved roadmap placement; **not implemented** (no routes/schema/integrations).
- **Dependencies:** 9A consent foundation; production use Phase 10 gated.

### Phase 9C
- **Status:** Roadmap-locked; **not implemented**. No Meta/Google campaign execution live.

### Phase 10
- **Objective:** Security hardening, full E2E, performance budgets, Hostinger VPS deployment.
- **Exit gate:** Production deployment authorized separately; all prior phase exit gates met.

---

## 4. Dependency Rules

1. No public lead **production activation** before Phase 10 gates (legal/owner/backup/PITR); Phase 5F hardening does not enable intake.
2. No Closed-Won project conversion (8A) before quotation acceptance (7B).
3. No WhatsApp outbound (6B) before webhook foundation (6A) and consent records.
4. No Groq copilot (6C) before message persistence (6A).
5. No campaigns (9A/9B/9C) before consent/suppression foundation.
6. ERP modules remain out of scope for all phases (ADR-0005).
7. Authoritative target achievement requires Phase 7B (quotation acceptance); Phase 5E configures targets only.
8. Project-value reconciliation (Phase 8A) must not double-count quotation acceptance.
9. Landing Page Lab (9B) does not move earlier than roadmap sequence; production use requires Phase 10.

---

## 5. Related Governance Documents

- [Project Truth](00-project-truth.md)
- [Phase 5D Closeout Audit](audits/phase-5d-bulk-import-source-assignment-closeout.md)
- [Phase 5A Audit](audits/phase-5a-crm-architecture-freeze.md)
- [Decision Register](10-decision-register.md)
- [ADR-0019: Five-Role CRM Authorization](ADR/ADR-0019-five-role-crm-authorization-model.md)
