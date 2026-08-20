# 09 — PHASE IMPLEMENTATION ROADMAP

**Document Status:** Locked Roadmap (truth-synced through Phase 9D-C unified homepage design lock, August 20, 2026)
**Current Phase:** Phase 9D-B **REPOSITORY MERGED** (DEC-0089; PR #73; repo M1–M35; managed M1–M34; M35 not applied; closeout not started). Phase 9D-C **PREPARATION FROZEN** (ADR-0032 / DEC-0090) + **homepage design locked** (DEC-0091; code not started). Phase 9C **MANAGED APPLY CERTIFIED** (DEC-0088).
**Next Phase:** Recovery-qualified managed apply of M35, then 9D-B docs closeout merge, then 9D-C. Production remains disabled.
**Previous Phase:** Phase 9A — Campaign Consent, Audience & Approval Foundation (**COMPLETE** — PR #63 true merge `26e6346ef6722b7c6ff5908c12f208854b513ad6`; managed **M1–M31**; production **not** activated)

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
Phase 6B: Premium Shared Inbox & Controlled Outbound Messaging ───────── COMPLETED
  • B1–B4 repository merged; M19–M21 applied managed (August 8, 2026)
  • DB-8A physical recovery Route A (backup 1313589467)
  • Managed inbox/send-intent/dispatch foundations; I1 integrated local E2E PASS
  • No deployment; no Meta callback/token; no real outbound; public intake inactive
  • Closeout truth-sync: current PR
Phase DB-8B: M19–M21 sequential managed apply ─────────────────────── COMPLETED
Phase 6C: Groq Human-Controlled Copilot ───────────────────────────── COMPLETED
  • K0–K3 prebuild + formal runtime merged (PR #45)
  • M22 applied managed (August 9, 2026); recovery 1322197903
  • Kriti audit persistence; provider default disabled; no auto-send
  • Closeout truth-sync: current PR
Phase 6D: Staff Administration, Attendance & Leave ─────────────────── COMPLETE / CLOSED
  • Repository + managed M1–M24; PR #51 merged
Phase 7A: Commercial Quotation Data & Draft Foundation ────────────── COMPLETE
  • M25 applied managed; PR #53 merged
Phase 7B: Quotation Finalization, Delivery & Client Acceptance ────── COMPLETE
  • M26 + M27 applied managed; PR #55 merged (`a30c733…`); production not activated
Phase 8A: Closed-Won Project Conversion & PM Handover ─────────────── COMPLETE
  • OD8A-1–OD8A-4 locked; PR #57 merged `db879b5…`; repository/managed M1–M28; pending NONE
Phase 8B: Designer Assignment & Design Collaboration ─────────────── COMPLETE
  • OD8B-1–OD8B-8 locked; PR #59 merged `6b31052…`; repository/managed M1–M29; pending NONE; M30 absent
Phase 8C: Project Execution Workspace ────────────────────────────── COMPLETE
  • OD8C-1–OD8C-12 / ADR-0026 / DEC-0075–DEC-0076; PR #61 true merge `8f4f3ecf…`; repository/managed M1–M30; pending NONE; production not activated
Phase 9A: Campaign Consent, Audience & Approval Foundation ──────── COMPLETE
  • OD9A-1–OD9A-6 / ADR-0027 / DEC-0077–DEC-0080; architecture PR #62 merged `caff9d0…`; M31 managed-applied immutable; PR #63 true merge `26e6346…`; production not activated
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
Phase 6B ──► Premium Shared Inbox & Controlled Outbound Messaging [COMPLETED]
    │         • M19–M21 managed; inbox/send-intent/dispatch foundations
    │         • No production Meta callback/token/outbound activation
    ▼
Phase 6C ──► Groq Human-Controlled Copilot [COMPLETED]
    │         • M22 managed; Kriti audit persistence + staff runtime
    │         • Provider default disabled; human-controlled only
    ▼
Phase 6D ──► Staff Administration, Attendance & Leave [COMPLETED]
    ▼
Phase 7A ──► Commercial Quotation Data & Draft Foundation [COMPLETED]
    ▼
Phase 7B ──► Quotation Finalization, Premium PDF, Secure Delivery & Client Acceptance [COMPLETED]
    │         • No internal quotation approval (ADR-0022)
    │         • Authoritative accepted-quotation achievement (`taxable_base_paise`); PR #55 merged; M1–M27
    ▼
Phase 8A ──► Closed-Won Project Conversion & PM Handover [COMPLETE]
    │         • Project-value reconciliation deferred (OD8A / ADR-0024)
    │         • PR #57 merged; repository/managed M1–M28; production not activated
    ▼
Phase 8B ──► Designer Assignment & Design Collaboration [COMPLETE]
    │         • OD8B-1–OD8B-8 / ADR-0025 / DEC-0074; PR #59 merged; separate design state
    ▼
Phase 8C ──► Project Execution Workspace [COMPLETE]
    │         • OD8C-1–OD8C-12 / ADR-0026 / DEC-0075–DEC-0076; PR #61 merged; managed M1–M30
    ▼
Phase 9A ──► Campaign Consent, Audience & Approval Foundation [COMPLETE]
    │         • OD9A-1–OD9A-6 / ADR-0027 / DEC-0077–DEC-0080; PR #62 merged; M31 managed-applied; PR #63 true merge `26e6346…`
    ▼
Phase 9B ──► Landing Page Lab & Experimentation [M32 MANAGED APPLIED — PRODUCTION OFF]
    │         • Landing page factory; reusable structured blocks
    │         • Campaign-specific variants; preview/publish/pause/archive
    │         • A/B/C experiments; UTM attribution; fbclid/gclid preservation
    │         • CRM lead-quality linkage; variant analytics; experiment history
    │         • Role-aware admin access; CRM/Supabase remains source of truth
    ▼
Phase 9C ──► Campaign Execution, Attribution & Conversion Feedback [ARCHITECTURE FROZEN — NOT IMPLEMENTED]
    │         • ADR-0031 / DEC-0085 / OD9C-1–OD9C-18
    │         • Meta/Google adapters from approved immutable versions (MVP)
    │         • Server-side conversion feedback; CommercialConversion = accepted quotation + Closed-Won
    │         • Provider spend + CRM funnel metrics; no double counting; production still Phase 10
    ▼
Phase 9D ──► Ready-Made Furniture E-commerce [9D-A FROZEN; 9D-B REPO IMPLEMENTED — /shop NOT STARTED]
    │         • Category-based /shop (no Shop by Room / packages / marketplace / ERP)
    │         • Guest checkout; simple variants; COD + online (provider chosen in 9D-A)
    │         • Supabase catalogue/inventory/order/payment-state truth; immutable snapshots
    │         • Existing /admin/commerce shell; WhatsApp support not order truth
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

### Phase 6B (Completed)
- **Objective:** Premium shared inbox and controlled outbound messaging (`WHATSAPP_SERVICE` boundary).
- **Exit gate:** M19–M21 applied managed; role-scoped inbox read; send-intent/idempotency; service-role dispatch boundary; I1 integrated local E2E PASS; future-phase regression PASS.
- **Dependencies:** Phase 6A complete (M18 managed).
- **Status:** **COMPLETE** — managed foundation + repository application. **No deployment**; **no production Meta callback/token**; **no real outbound**; **public intake inactive**.
- **Closeout:** `docs/audits/phase-6b-managed-alignment-closeout.md`

### Phase 6C (Completed)
- **Objective:** Groq human-controlled copilot (summarize, draft, suggest, explain only); append-only audit persistence; staff-authorized CRM/WhatsApp context.
- **Prebuild:** K0–K3 merged (contracts, provider, context/safety, UI components).
- **Exit gate:** M22 applied managed; Kriti audit persistence verified; formal runtime + tests PASS; provider default disabled.
- **Status:** **COMPLETE** — repository + managed aligned through M22. No production Groq activation.
- **Closeout:** `docs/audits/phase-6c-managed-alignment-closeout.md`

### Phase 6D (Completed / Closed)
- **Objective:** Staff administration, attendance, leave, and holiday calendar (see `docs/audits/phase-6d-roadmap-lock.md`).
- **Architecture freeze:** [Phase 6D preflight audit](audits/phase-6d-staff-attendance-leave-architecture-freeze.md), [ADR-0023](ADR/ADR-0023-staff-attendance-leave-architecture.md), [implementation contract freeze](audits/phase-6d-implementation-contract-freeze.md).
- **Exit gate:** M23 baseline applied managed August 10, 2026; M24 forward-only attendance idempotency repair applied managed August 11, 2026 (owner-authorized); 9 public domain tables + private invite saga ledger verified; repaired check-in/check-out RPC ordering verified on managed DB; staff admin/attendance/leave routes + tests PASS; OD-1–OD-10 unresolved (no policy catalogue seeds); PR #51 merged into protected main (`eb524d166e09b3160526ff5d0c642a1a65012f88`).
- **Status:** **COMPLETE / CLOSED** — Repository implementation M1–M24 complete; managed M1–M24 applied and verified; closeout PR #51 merged. Repaired check-in/check-out RPC ordering verified on managed database. No production deployment; attendance production activation blocked until owner OD values.
- **Closeout:** `docs/audits/phase-6d-managed-alignment-closeout.md`

### Phases 7–8
See [Phase 5A Audit](audits/phase-5a-crm-architecture-freeze.md) and ADRs 0020–0021.

### Phase 7A (Completed)
- **Objective:** Commercial quotation data and draft foundation.
- **Status:** **COMPLETE** — M25 managed; PR #53 merged.

### Phase 7B (Completed)
- **Objective:** Quotation finalization (no internal approval), premium PDF, secure delivery via Phase 6B, client acceptance.
- **Exit gate:** Authoritative accepted-quotation revenue (`taxable_base_paise`) and Closed-Won achievement calculations proven and tested.
- **Status:** **COMPLETE** — M26 + M27 managed; PR #55 merged (`a30c733003fb08b3250148c61f7c4f74f11d4c14`); production not activated.
- **Dependencies:** 7A.

### Phase 8A (Completed)
- **Objective:** Closed-Won project conversion and PM handover.
- **Architecture freeze:** [Phase 8A freeze](audits/phase-8a-closed-won-project-pm-handover-architecture-freeze.md), [ADR-0024](ADR/ADR-0024-phase-8a-project-materialization-pm-handover.md).
- **Implementation audit:** [Phase 8A M28 implementation](audits/phase-8a-m28-project-conversion-pm-handover-implementation.md).
- **Dependencies:** 7B complete.
- **Status:** **COMPLETE** — PR #57 MERGED (`db879b5ca27fe9d26543c23d8f130811c7feadab`); repository/managed **M1–M28**; pending **NONE**; project-value reconciliation remains **deferred**; production not activated.

### Phase 8B (Completed)
- **Objective:** Designer assignment and design collaboration.
- **Architecture freeze:** [Phase 8B freeze](audits/phase-8b-designer-assignment-design-collaboration-architecture-freeze.md), [ADR-0025](ADR/ADR-0025-phase-8b-designer-assignment-design-collaboration.md).
- **Implementation:** [Phase 8B M29 implementation](audits/phase-8b-m29-designer-assignment-design-collaboration-implementation.md), DEC-0074.
- **Exit gate:** PR #59 **MERGED** `6b31052973cf9e50e25803b232ce446308c1fa3a`.
- **Dependencies:** 8A complete; architecture PR #58 merged `b7afef60e41900e7832ea41b249067841aebbaea`.
- **Status:** **COMPLETE** — owner locks OD8B-1–OD8B-8; repository/managed **M1–M29** at 8B closeout; production not activated.

### Phase 8C (Completed)
- **Objective:** Project execution workspace (status + evidence tracking after Design Completed; No-ERP).
- **Architecture freeze:** [Phase 8C freeze](audits/phase-8c-project-execution-workspace-architecture-freeze.md), [ADR-0026](ADR/ADR-0026-phase-8c-project-execution-workspace.md), DEC-0075.
- **Implementation:** [Phase 8C M30 implementation](audits/phase-8c-m30-project-execution-workspace-implementation.md), DEC-0076.
- **Owner locks:** OD8C-1–OD8C-12 **as recommended**, with the three refinements (M29-only design truth; entry = handover_accepted + design_completed with auto-create at `production`; no persisted `material_finalisation`).
- **Exit gate:** PR #61 **MERGED** `8f4f3ecf082450e82ab15f02703c951e50f0817e`; post-merge CI `32010340601` SUCCESS.
- **Dependencies:** 8B complete (PR #59 merged); architecture PR #60 merged `5b4a7f300e63b438884a2b440a69a569d91b9e5d`.
- **Status:** **COMPLETE** — repository/managed **M1–M30**; pending **NONE**; M30 immutable; production not activated.

### Phase 9A (Completed)
- **Objective:** Campaign consent, audience rule versioning, and approval foundation (no execution).
- **Architecture freeze:** [Phase 9A freeze](audits/phase-9a-campaign-consent-audience-approval-architecture-freeze.md), [ADR-0027](ADR/ADR-0027-phase-9a-campaign-consent-audience-approval.md), DEC-0077.
- **Implementation:** [Phase 9A M31 implementation](audits/phase-9a-m31-campaign-consent-audience-approval-implementation.md), DEC-0078, DEC-0080.
- **Owner locks:** OD9A-1–OD9A-6 **as recommended** (existing DNC/channel suppression; MARKETING via `consent_events`; freeze rules not recipients; opaque destination / no 9B FK; channels metadata only; budget/creative/window approval snapshot).
- **Exit gate:** PR #63 **MERGED** true merge `26e6346ef6722b7c6ff5908c12f208854b513ad6`; post-merge CI `32097624707` SUCCESS. M31 immutable.
- **Dependencies:** Phase 8C complete (PR #61 merged); architecture PR #62 merged `caff9d0864e1546dff38646df4355dafa851a473`.
- **Status:** **COMPLETE** — architecture COMPLETE_FROZEN; repository implementation COMPLETE; managed DB **CERTIFIED_M1_M31**; repository/managed **M1–M31**; pending **NONE**; M31 **MANAGED_APPLIED_IMMUTABLE**; production not activated.

### Phase 9B (Landing Page Lab)
- **Objective:** Structured Landing Page Lab and deterministic experiments.
- **Architecture freeze:** [ADR-0029](ADR/ADR-0029-phase-9b-landing-page-lab.md), DEC-0081, OD9B-1–OD9B-12.
- **Repository:** PR #66 merged (`39f5a7a69998418bee943168cff218a0aa1f721e`); DEC-0082.
- **Managed apply:** [M32 closeout](audits/phase-9b-m32-managed-apply-closeout.md), DEC-0084; managed **M1–M32**; pending **NONE**.
- **Status:** **M32 MANAGED APPLIED** — production Landing Lab **OFF**. Phase 9C **MANAGED APPLY CERTIFIED** (DEC-0088).

### Phase 9C
- **Objective:** Campaign execution, attribution comparison, and server-side conversion feedback.
- **Architecture freeze:** [ADR-0031](ADR/ADR-0031-phase-9c-campaign-execution-attribution-conversion-feedback.md), [9C-A audit](audits/phase-9c-campaign-execution-attribution-feedback-architecture-freeze.md), DEC-0085, OD9C-1–OD9C-18.
- **Subphases:** 9C-A freeze **MERGED**; 9C-B mock execution foundation **MERGED** (DEC-0086); 9C-C Meta+Google adapters + feedback + metrics **MERGED** (DEC-0087 / PR #71); managed apply **CERTIFIED** (DEC-0088).
- **Status:** **9C MANAGED APPLY CERTIFIED** — production spend **OFF**. Managed **M1–M34**. 9D-B remains blocked until closeout merge.

### Phase 9D (Ready-Made Furniture E-commerce)
- **Objective:** Premium mobile-first category-based ready-made furniture store under `/shop`.
- **Roadmap lock:** [Phase 9D lock](audits/phase-9d-ready-made-furniture-ecommerce-roadmap-lock.md), [ADR-0028](ADR/ADR-0028-phase-9d-ready-made-furniture-ecommerce.md), DEC-0079, OD9D-1–OD9D-12.
- **Architecture freeze:** [ADR-0030](ADR/ADR-0030-phase-9d-ready-made-furniture-ecommerce-architecture.md), [9D-A audit](audits/phase-9d-a-ecommerce-entry-audit-architecture-freeze.md), DEC-0083.
- **Placement:** after 9C, before Phase 10. **9D-C blocked** until M35 is recovery-qualified managed-applied **and** 9D-B docs closeout is merged.
- **Status:** **9D-A ARCHITECTURE FROZEN**. **9D-B REPOSITORY MERGED** (DEC-0089 / M35 / PR #73). **9D-C PREPARATION FROZEN** (ADR-0032 / DEC-0090). **Homepage design locked** (ADR-0032 §9.1 / DEC-0091). No `/shop` runtime, checkout, or payment provider. Managed still **M1–M34**.

### Phase 10
- **Objective:** Security hardening, full E2E, performance budgets, Hostinger VPS deployment.
- **Exit gate:** Production deployment authorized separately; all prior phase exit gates met.

---

## 4. Dependency Rules

1. No public lead **production activation** before Phase 10 gates (legal/owner/backup/PITR); Phase 5F hardening does not enable intake.
2. No Closed-Won project conversion (8A) before quotation acceptance (7B).
3. No WhatsApp outbound (6B) before webhook foundation (6A) and consent records.
4. No Groq copilot (6C) before message persistence (6A).
5. No campaigns (9A/9B/9C) before consent/suppression foundation. Phase 9A **reuses** existing DNC (`contacts.status`) and channel suppression (`contact_channels.status`); it does **not** add `contact_suppressions`. Execution remains Phase 9C.
6. ERP modules remain out of scope for all phases (ADR-0005). Phase 9D SKU stock is storefront inventory only (ADR-0028), not WMS/procurement.
7. Authoritative target achievement requires Phase 7B (quotation acceptance); Phase 5E configures targets only.
8. Project-value reconciliation (Phase 8A) must not double-count quotation acceptance.
9. Landing Page Lab (9B) does not move earlier than roadmap sequence; production use requires Phase 10.
10. Phase 8C M30 is applied and merged; do not persist duplicate M29 measurement/design/approval truth. Phase 9A must not create M31 before ADR-0027 is merged.
11. Phase 9D implementation does not start before 9C complete and 9D-A architecture freeze merged. No room-wise or quotation ecommerce under `/shop`. Commerce migration timestamps are allocated at 9D-B, not reserved as M33.

---

## 5. Related Governance Documents

- [Project Truth](00-project-truth.md)
- [Phase 5D Closeout Audit](audits/phase-5d-bulk-import-source-assignment-closeout.md)
- [Phase 5A Audit](audits/phase-5a-crm-architecture-freeze.md)
- [Decision Register](10-decision-register.md)
- [ADR-0019: Five-Role CRM Authorization](ADR/ADR-0019-five-role-crm-authorization-model.md)
- [Phase 6D roadmap lock](audits/phase-6d-roadmap-lock.md)
- [Phase 6D architecture freeze](audits/phase-6d-staff-attendance-leave-architecture-freeze.md)
- [ADR-0023: Staff attendance architecture](ADR/ADR-0023-staff-attendance-leave-architecture.md)
- [ADR-0024: Phase 8A project materialization and PM handover](ADR/ADR-0024-phase-8a-project-materialization-pm-handover.md)
- [Phase 8A architecture freeze](audits/phase-8a-closed-won-project-pm-handover-architecture-freeze.md)
- [ADR-0025: Phase 8B designer assignment and design collaboration](ADR/ADR-0025-phase-8b-designer-assignment-design-collaboration.md)
- [Phase 8B architecture freeze](audits/phase-8b-designer-assignment-design-collaboration-architecture-freeze.md)
- [ADR-0026: Phase 8C project execution workspace](ADR/ADR-0026-phase-8c-project-execution-workspace.md)
- [Phase 8C architecture freeze](audits/phase-8c-project-execution-workspace-architecture-freeze.md)
- [ADR-0027: Phase 9A campaign consent, audience and approval](ADR/ADR-0027-phase-9a-campaign-consent-audience-approval.md)
- [Phase 9A architecture freeze](audits/phase-9a-campaign-consent-audience-approval-architecture-freeze.md)
- [Phase 9A M31 implementation](audits/phase-9a-m31-campaign-consent-audience-approval-implementation.md)
- [ADR-0028: Phase 9D ready-made furniture e-commerce](ADR/ADR-0028-phase-9d-ready-made-furniture-ecommerce.md)
- [Phase 9D roadmap lock](audits/phase-9d-ready-made-furniture-ecommerce-roadmap-lock.md)
- [ADR-0030: Phase 9D architecture freeze](ADR/ADR-0030-phase-9d-ready-made-furniture-ecommerce-architecture.md)
- [ADR-0032: Commerce admin control and 9D-C storefront preparation](ADR/ADR-0032-commerce-admin-control-and-phase-9d-c-storefront-preparation.md)
- [Unified homepage design](design/phase-9d-c-unified-homepage.md)
- [Phase 9D-A entry audit](audits/phase-9d-a-ecommerce-entry-audit-architecture-freeze.md)
- [Phase 9D-B catalogue/inventory foundation](audits/phase-9d-b-commerce-catalogue-inventory-foundation.md)
- [Phase 9B M32 managed apply closeout](audits/phase-9b-m32-managed-apply-closeout.md)

<!-- PHASE_9B_ARCHITECTURE_FREEZE_START -->
## Phase 9B Architecture Freeze Status

**Status:** `ARCHITECTURE_FROZEN — REPOSITORY IMPLEMENTATION COMPLETE (DEC-0082)`

Authority: **ADR-0029 / DEC-0081 / OD9B-1–OD9B-12**.

M32 is present in the repository. Managed apply is recorded separately as **DEC-0084**. Phase 9C architecture is frozen (DEC-0085) without implementation. Phase 9D-B remains excluded until 9C implementation complete. Production activation remains Phase 10.
<!-- PHASE_9B_ARCHITECTURE_FREEZE_END -->

<!-- PHASE_9B_M32_MANAGED_APPLY_START -->
## Phase 9B M32 Managed Apply Status

**Status:** `MANAGED_APPLIED (DEC-0084)` — production Landing Lab **OFF**

Physical checkpoint **1412215555** (`2026-08-18T19:54:24.861Z`). CLI `npx supabase@2.109.1 db push --linked --yes` `2026-08-19T02:50:44Z`–`02:50:49Z`. Managed **M1–M32**, pending NONE. Closeout: [M32 managed apply](audits/phase-9b-m32-managed-apply-closeout.md).
<!-- PHASE_9B_M32_MANAGED_APPLY_END -->

<!-- PHASE_9D_A_ARCHITECTURE_FREEZE_START -->
## Phase 9D-A Architecture Freeze Status

**Status:** `ARCHITECTURE_FROZEN (DEC-0083)` + `9D-B REPOSITORY IMPLEMENTED (DEC-0089)` — public `/shop` **NOT STARTED**

Authority: **ADR-0028 / ADR-0030 / DEC-0079 / DEC-0083 / DEC-0089 / OD9D-1–OD9D-12**.

M35 is merged in the repository (PR #73). Managed remains **M1–M34**. 9D-C code is blocked until recovery-qualified managed apply of M35 **and** 9D-B docs closeout merge. Admin/storefront preparation: [ADR-0032](ADR/ADR-0032-commerce-admin-control-and-phase-9d-c-storefront-preparation.md) / DEC-0090.
<!-- PHASE_9D_A_ARCHITECTURE_FREEZE_END -->

<!-- PHASE_9D_C_PREPARATION_FREEZE_START -->
## Phase 9D-C Admin / Storefront Preparation Status

**Status:** `PREPARATION_FROZEN (DEC-0090)` + `HOMEPAGE_DESIGN_LOCKED (DEC-0091)` — 9D-C **code NOT STARTED**

Authority: **ADR-0032 / DEC-0090 / DEC-0091**. No M36. No `/shop`. No homepage runtime. No service-area table. Production **OFF**.
<!-- PHASE_9D_C_PREPARATION_FREEZE_END -->

<!-- PHASE_9C_ARCHITECTURE_FREEZE_START -->
## Phase 9C Architecture Freeze Status

**Status:** `ARCHITECTURE_FROZEN (DEC-0085)` + `9C-B MERGED (DEC-0086)` + `9C-C MERGED (DEC-0087)` + `M33/M34 MANAGED APPLY CERTIFIED (DEC-0088)` — production execution **OFF**

Authority: **ADR-0031 / DEC-0085 / DEC-0086 / OD9C-1–OD9C-18 / OD9C-A–C**.

Managed **M1–M34** (DEC-0088). No Meta/Google live spend. Production execution remains Phase 10 gated. 9D-B repository implementation is DEC-0089 (M35 not managed-applied).
<!-- PHASE_9C_ARCHITECTURE_FREEZE_END -->
