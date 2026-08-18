# 00 — PROJECT TRUTH AND GOVERNANCE BASELINE

**Document Status:** Locked Governance Baseline (truth-synced through Phase 9B architecture freeze, August 18, 2026)
**Project Name:** ONEDECORE
**Tagline:** One Vision. Complete Interiors.
**Domain:** `onedecore.in`
**Initial Market:** Pune, India
**Deployment Target:** Hostinger VPS
**Current Phase:** Phase 9B — Landing Page Lab (**ARCHITECTURE_FROZEN** — implementation **NOT STARTED**; M32 **ABSENT**). Phase 9A **COMPLETE**. Phase 9D **ROADMAP_LOCKED** (implementation **NOT_STARTED**).
**Next Phase:** `PHASE_9B_M32_IMPLEMENTATION_PREFLIGHT`
**Previous Phase:** Phase 9A — Campaign Consent, Audience & Approval Foundation (**COMPLETE** — PR #63 true merge `26e6346ef6722b7c6ff5908c12f208854b513ad6`; managed **M1–M31**; M31 immutable; production **not** activated)

---

## 1. Executive Summary & Purpose

This document defines the immutable business identity, project boundaries, and governance rules for ONEDECORE. All technical implementations must adhere strictly to the rules established here and in linked ADRs.

---

## 2. Locked Brand Identity

- **Brand Name:** ONEDECORE
- **Tagline:** One Vision. Complete Interiors.
- **Primary Domain:** `onedecore.in`
- **Initial Launch Market:** Pune, India
- **Core Services (V1 Focus):**
  1. Complete Home Interiors
  2. Modular Kitchens
  3. Custom Wardrobes
- **Repository Independence:** Fully independent code, database, and infrastructure. Completely separate from QuickFurno and Jarvis.

---

## 3. Product Architecture Domains

ONEDECORE is an integrated operating system spanning multiple product domains. **Merged and live capabilities** are distinguished from **planned modules** in Section 4.

```
┌─────────────────────────────────────────────────────────┐
│ 1. Premium Public Website & Legal Presentation          │
├─────────────────────────────────────────────────────────┤
│ 2. Dedicated Portfolio System (/portfolio)            │
├─────────────────────────────────────────────────────────┤
│ 3. Secure Public Lead Intake (dual-gated; disabled)     │
├─────────────────────────────────────────────────────────┤
│ 4. Sales & Operations CRM (/admin/crm — partial on main) │
├─────────────────────────────────────────────────────────┤
│ 5. Commercial Quotation System (planned)              │
├─────────────────────────────────────────────────────────┤
│ 6. Project Execution & Design Collaboration (planned)   │
├─────────────────────────────────────────────────────────┤
│ 7. Official Meta WhatsApp Cloud API (foundation managed; not activated) │
├─────────────────────────────────────────────────────────┤
│ 8. Human-Controlled Groq Copilot (planned)            │
├─────────────────────────────────────────────────────────┤
│ 9. Marketing Campaigns with Consent Controls (planned)│
├─────────────────────────────────────────────────────────┤
│ 10. Controlled n8n Workflows (async notification bus)  │
├─────────────────────────────────────────────────────────┤
│ 11. Ready-Made Furniture Shop (/shop) (Phase 9D locked; not started) │
└─────────────────────────────────────────────────────────┘
```

---

## 4. Current Merged Capabilities vs Planned Modules

### Merged to protected main

| Capability | Status |
| :--- | :--- |
| Premium public homepage (R4/R5 production) | Merged on `main` |
| Public portfolio listing & detail (`/portfolio`) | Merged on `main` |
| Portfolio admin CMS (`/admin/portfolio`) | Merged on `main` |
| Staff auth (invitation-only email/password) | Merged on `main` |
| Database-backed RBAC (`public.authorize`) | Merged on `main`; five-role CRM extension (Phase 5B) merged |
| CRM read-only workspace (`/admin/crm`) | Merged on `main` (Phase 5C1) |
| Lead assignment mutations (Phase 5C2A) | Merged on `main` |
| Manual lead creation (Phase 5C2B) | Merged on `main` |
| Lifecycle collaboration (Phase 5C2C) | Merged on `main` (PR #11) |
| Lead intake data plane (migrations 9–10) | Schema merged; **public route disabled by default** |
| Public lead form UI | **Merged; default `copy-only`; server `disabled`** |

### Managed database applied (not production deployment)

| Capability | Status |
| :--- | :--- |
| CRM identity & core data (migration 11) | Applied managed August 1, 2026 |
| CRM workspace access (migration 12) | Applied managed August 1, 2026 |
| Assignment mutation hardening (migration 13) | Applied managed August 1, 2026 |
| Manual lead duplicate-safe flow (migration 14) | Applied managed August 2, 2026 (Phase DB-3B) |
| Bulk import & source assignment (migration 15) | Applied managed August 3, 2026 (Phase DB-4B) |
| Sales targets & CRM reporting (migration 16) | Applied managed August 3, 2026 (Phase DB-5B) |
| Controlled public lead activation hardening (migration 17) | Applied managed August 4, 2026 (Phase DB-6B) |
| Meta WhatsApp data & webhook foundation (migration 18) | Applied managed August 7, 2026 (Phase DB-7B) |
| Premium shared inbox send-intent foundation (migration 19) | Applied managed August 8, 2026 (Phase DB-8B-M19) |
| Shared inbox read model foundation (migration 20) | Applied managed August 8, 2026 (Phase DB-8B-M20) |
| WhatsApp provider dispatch foundation (migration 21) | Applied managed August 8, 2026 (Phase DB-8B-M21) |
| Kriti audit persistence foundation (migration 22) | Applied managed August 9, 2026 (Phase 6C M22) |
| Staff attendance, leave & holidays foundation (migration 23) | Applied managed August 10, 2026 (Phase 6D M23 baseline; immutable historical migration) |
| Staff attendance idempotency order repair (migration 24) | Applied managed August 11, 2026 (Phase 6D M24 owner-authorized repair apply) |
| Commercial quotation draft foundation (migration 25) | Applied managed (Phase 7A M25) |
| Quotation finalization, delivery & acceptance (migration 26) | Applied managed August 14, 2026 (Phase 7B M26; PR #55 merged) |
| Quotation trigger EXECUTE privilege hardening (migration 27) | Applied managed August 14, 2026 (Phase 7B M27) |
| Closed-Won project conversion & PM handover (migration 28) | Applied managed August 15, 2026 (Phase 8A M28); PR #57 **MERGED** `db879b5ca27fe9d26543c23d8f130811c7feadab` |
| Designer assignment & design collaboration (migration 29) | Managed-applied 2026-08-16 (Phase 8B M29); PR #59 **MERGED** `6b31052973cf9e50e25803b232ce446308c1fa3a` |
| Project execution workspace (migration 30) | Managed-applied 2026-08-17 (Phase 8C M30); PR #61 **MERGED** `8f4f3ecf082450e82ab15f02703c951e50f0817e` |
| Campaign consent, audience & approval foundation (migration 31) | Managed-applied 2026-08-18 (Phase 9A M31); PR #63 **MERGED** `26e6346ef6722b7c6ff5908c12f208854b513ad6`; architecture PR #62 **MERGED** `caff9d0864e1546dff38646df4355dafa851a473` |
| Migration alignment | Repository: **M1–M31**; Managed OneDecore (`lpurlfmpvriyvpkujvyl`): **M1–M31**; pending **NONE**; M31 **immutable** |

CRM through Phase 7B (quotation acceptance → Closed-Won) is applied on managed database (`lpurlfmpvriyvpkujvyl`) through **M27**. Phase 7B is **COMPLETE** (PR #55 merged). Phase 8A is **COMPLETE** (PR #57 merged `db879b5ca27fe9d26543c23d8f130811c7feadab`; managed **M1–M28**). Phase 8B is **COMPLETE** (OD8B-1–OD8B-8 / ADR-0025 / DEC-0073–DEC-0074; PR #59 merged `6b31052973cf9e50e25803b232ce446308c1fa3a`; managed **M1–M29**). Phase 8C is **COMPLETE** (OD8C-1–OD8C-12 / ADR-0026 / DEC-0075–DEC-0076; architecture PR #60 merged `5b4a7f300e63b438884a2b440a69a569d91b9e5d`; implementation PR #61 true merge `8f4f3ecf082450e82ab15f02703c951e50f0817e`; managed **M1–M30**). Phase 9A architecture is frozen (OD9A-1–OD9A-6 / ADR-0027 / DEC-0077; architecture PR #62 true merge `caff9d0864e1546dff38646df4355dafa851a473`). Phase 9A repository implementation is **REPOSITORY_COMPLETE** (DEC-0078). Phase 9A managed apply is **CERTIFIED** (DEC-0080; M31 applied 2026-08-18; managed **M1–M31**; pending **NONE**; M31 immutable). PR #63 **MERGED** `26e6346ef6722b7c6ff5908c12f208854b513ad6`. Phase 9D is **ROADMAP_LOCKED** (DEC-0079 / ADR-0028; implementation **NOT STARTED**). **Production deployment pending** (Phase 10); **public intake remains inactive**.

### Phase 5F truth

- Implementation merged (PR #17, merge SHA `2e3f3322b35865c7661a0abeeaa7f0823ed8a593`); managed M17 applied and verified (DB-6B).
- M17 SHA `B8F5B75AC6EE64DE1E9ABD571A215FF3AABE6F54D98EFE1F8BBEF679871A0FC6`.
- Normalized-phone identity reuses active/suppressed contact; DNC and suppressed phone preserved; ambiguous identity fails safely; `::1` loopback hardening complete.
- **Public intake inactive** (`copy-only` / `disabled`); production activation remains Phase 10 only.
- Phase 5F formally **COMPLETE** (closeout merged).

### Phase 6A truth

- Repository implementation merged; managed M18 applied and verified (DB-7B, August 7, 2026).
- M18 SHA `43AF93C6CF8CF7067A1CFFED6C1232614E2CA6A4C63C37184B0D6A8B7351F098`.
- Managed foundation: seven WhatsApp tables (RLS-enabled, zero rows at apply); service-role-only ingest RPCs; private hardened helpers; append-only webhook/status event protection.
- **CRM consent remains authoritative** (`contacts`, `contact_channels`, `consent_events` with purpose distinctions `SERVICE_ENQUIRY`, `SERVICE_COMMUNICATION`, `WHATSAPP_SERVICE`, `MARKETING`). M18 does **not** create a parallel WhatsApp consent store, grant marketing consent, clear DNC, or auto-create/link CRM contacts or leads from inbound messages.
- **No production deployment**; **no Meta callback/token activation**; **no outbound WhatsApp**; **no n8n activation**; **no Kriti runtime**; **public intake inactive**.
### Phase 6B truth

- Repository B1–B4 implementation merged; managed M19–M21 applied and verified (August 8, 2026).
- Recovery: backup **1313589467** (`2026-08-07T19:53:32.362Z`, physical/WALG, COMPLETED).
- Managed foundation: send-intent tables/events, scoped inbox read policies, provider dispatch attempts + service-role-only dispatch RPCs; all zero fake rows at apply.
- **WHATSAPP_SERVICE** purpose only on service send path; **MARKETING** blocked; CRM consent/DNC authoritative; current-assignment access resolver; idempotency + dispatch reconciliation foundations.
- **No production deployment**; **no Meta callback/token activation**; **no real customer outbound**; **no n8n/Kriti runtime**; **public intake inactive**.
- Phase 6B formally **COMPLETE** (closeout merged). Formal **Phase 6C** is next.

### Phase 6C truth

- Repository formal runtime merged (PR #45); Kriti K0–K3 prebuild + staff-authorized inbox assist.
- Managed M22 applied and verified (August 9, 2026); owner authorization `PROCEED PHASE 6C M22 MANAGED APPLY`.
- Recovery: backup **1322197903** (`2026-08-08T19:54:50.080Z`, physical/WALG, COMPLETED; post-M21).
- M22 Git blob `58d62e9f3f480fbfbbe71918179c20f5a6dde537`; SHA-256 `74f79fb7985bac4d556701371555f7717a026ec5ec5f77da314a42f643775630`.
- Managed foundation: `kriti_runs`, `kriti_events` (append-only events; RLS own-run scope); `start_kriti_run`, `append_kriti_audit_event` RPCs.
- **Human-controlled copilot only**; provider default **disabled**; no auto-send; no CRM/business mutations.
- **No production Groq activation**; **no production deployment**; **public intake inactive**.
- Phase 6C formally **COMPLETE** (closeout merged). Phase 6D staff administration, attendance & leave baseline (M23) merged and applied managed; **M24 forward-only attendance idempotency repair committed in repository but pending managed apply**.

### Phase 6D truth

- Repository implementation merged M1–M24 (PR #49 merged M23 baseline; PR #50 forward-only M24 attendance idempotency repair merged).
- Managed M23 applied and verified (August 10, 2026); immutable historical baseline.
- Managed M24 applied and verified (August 11, 2026); owner authorization `PROCEED PHASE 6D M24 MANAGED APPLY`.
- Recovery: backup **1338218011** (`2026-08-10T19:53:40.662Z UTC`, physical/WALG, COMPLETED; post-M23 cutoff `2026-08-10T02:46:52Z UTC`).
- M23 Git blob `785325143dae0e81b918f8371325785ce061d57a`; canonical UTF-8/LF SHA-256 `64f4f15a9501fcf6bda954e021812b0b826022304654dbc49699f0cab7051634`.
- M24 Git blob `790db51dc7761c4d1ced3c38db07d974849e6fdb`; normalized UTF-8/LF SHA-256 `029a88db95bafe5cfd8791baf77fb94695da7febed41b5251898cfede5a860b2`.
- Managed foundation (M23–M24): staff employment profiles, attendance policies/events/days/corrections, leave types/requests, holidays; invite saga RPCs; repaired check-in/check-out idempotency-first function ordering verified on managed DB.
- **OD-1–OD-10 unresolved** — no policy catalogue seeds; `attendance.correct.team` not granted; attendance production activation blocked until owner values.
- **No production deployment**; **public intake inactive**; **Phase 7A ACTIVE** (Entry Audit & Architecture Freeze).
- Phase 6D repository implementation M1–M24 complete; **managed repair closeout COMPLETE / CLOSED** (PR #51 merged). **Phase 7A CURRENT FORMAL PHASE**.

### Phase 5E truth

- Implementation merged (PR #15); managed M16 applied.
- Target configuration + immutable history live in managed schema; SA-only mutation; role-scoped reads.
- Non-commercial CRM reporting only; **achievement inactive** until accepted quotation (Phase 7B); no stored achieved/attainment/forecast/variance fields.
- **No deployment**; public intake inactive.

### Recovery truth

- **DB-6A** physical recovery Route A for M17: backup ID `1281893546` (`2026-08-03T19:53:32.414Z`, COMPLETED, WALG) — valid **pre-M17** recovery point used to authorize DB-6B managed apply.
- **DB-7A-R2 / DB-7B** physical recovery Route A for M18: backup ID `1306358570` (`2026-08-06T19:54:47.134Z`, COMPLETED, WALG) — pre-M18 recovery point used to authorize DB-7B managed apply; PITR remained disabled at apply time.
- **DB-5A-L** fresh verified logical checkpoint accepted for M16 (capture window 2026-08-03T13:31:24Z–13:33:32Z); package outside Git (`DB5A-L-20260803T133124Z`).
- Backups `1281893546` and `1306358570` do **not** permanently satisfy Phase 10 — each predates subsequent managed state.
- **Before Phase 10 production activation**, a **current** fresh physical backup or qualified active PITR recovery point appropriate to then-current managed state is mandatory (DEC-0053 per migration).

### Planned — not live

WhatsApp production outbound, public lead activation, production deployment, **Meta production webhook/callback activation**, Landing Page Lab (Phase 9B — not implemented), Phase 9C campaign execution, Phase 9D ready-made furniture e-commerce (roadmap locked — **not started**).

**Do not claim planned modules are live or production-deployed.**

---

## 5. Master Governance Rules & Mandatory Corrections

1. **Next.js Version Target:** Next.js 16.x (pinned `16.2.11` in Phase 2A).
2. **Supabase Source of Truth:** Supabase PostgreSQL is the sole permanent database for structured application data.
3. **Database-Before-Automation:** Valid submissions and inbound messages persist to Supabase *before* n8n or outbound notifications.
4. **Meta WhatsApp:** Official Cloud API only; webhooks terminate at verified ONEDECORE endpoint; unofficial WhatsApp Web automation prohibited.
5. **Groq AI:** Human-controlled copilot only; no autonomous sends, status changes, or direct DB access.
6. **Benchmark Integrity:** "₹100-crore" is an internal quality benchmark only — never a public financial claim.
7. **No Unverified Business Claims:** No invented factories, warranties, metrics, or testimonials.
8. **Storage Separation:** Private masters vs public derivatives; CRM documents via RLS and signed URLs.
9. **Configurable CRM Thresholds:** Qualification, SLAs, and discount approval remain owner-configurable policies.
10. **Auditable Quote Acknowledgement:** Client acceptance is logged evidence, not automatic legal e-signature.
11. **Admin Route Prefix:** Internal routes use `/admin`.
12. **Five-Role CRM Model:** `super_admin`, `sales_manager`, `sales_executive`, `project_manager`, `designer` — see ADR-0019.
13. **Closed-Won Invariant:** Requires Accepted quotation before project creation — see ADR-0020.
14. **Public Lead Intake:** Defaults remain disabled (`copy-only` / `disabled`); M17 identity hardening applied managed; **production activation requires Phase 10** with current backup/PITR and separate owner authority.

---

## 6. Decision Classification Summary

- **[LOCKED]:** Brand identity, Supabase source of truth, `/admin` prefix, five-role CRM model, No-ERP boundary, RLS on exposed tables, official WhatsApp only, human-controlled AI only, disabled public intake defaults.
- **[RECOMMENDED — OWNER APPROVAL REQUIRED]:** Typography pairing, Pune geo-landing expansion, visual tokens.
- **[DEFERRED / NOT IN V1 ERP]:** Accounting, procurement, warehouse WMS, labour dispatch, autonomous AI agents. Phase 9D later adds **bounded ready-made SKU stock** for `/shop` only (ADR-0028) — not ERP inventory.
- **[OPEN RISK]:** Verified project photography; Meta template approval timelines; legal gates for public intake activation.

---

## 7. Related Governance Documents

- [Product Requirements](01-product-requirements.md)
- [Architecture & Repository Structure](02-architecture.md)
- [Phase Roadmap](09-phase-roadmap.md)
- [Decision Register](10-decision-register.md)
- [Phase 5A Audit](audits/phase-5a-crm-architecture-freeze.md)
- [ADR-0019: Five-Role CRM Authorization](ADR/ADR-0019-five-role-crm-authorization-model.md)
- [ADR-0026: Phase 8C Project Execution Workspace](ADR/ADR-0026-phase-8c-project-execution-workspace.md)
- [ADR-0027: Phase 9A Campaign Consent, Audience & Approval](ADR/ADR-0027-phase-9a-campaign-consent-audience-approval.md)
- [Phase 8C Architecture Freeze](audits/phase-8c-project-execution-workspace-architecture-freeze.md)
- [Phase 9A Architecture Freeze](audits/phase-9a-campaign-consent-audience-approval-architecture-freeze.md)
- [Phase 9A M31 Implementation](audits/phase-9a-m31-campaign-consent-audience-approval-implementation.md)
- [ADR-0028: Phase 9D Ready-Made Furniture E-commerce](ADR/ADR-0028-phase-9d-ready-made-furniture-ecommerce.md)
- [Phase 9D Roadmap Lock](audits/phase-9d-ready-made-furniture-ecommerce-roadmap-lock.md)

<!-- PHASE_9B_ARCHITECTURE_FREEZE_START -->
## Phase 9B Architecture Freeze — Landing Page Lab

Phase 9B architecture is **FROZEN** under **ADR-0029 / DEC-0081 / OD9B-1–OD9B-12**. Implementation is not started and **M32 is absent**.

Locked boundaries:

- structured/versioned blocks only; no arbitrary HTML or unrestricted page builder;
- publication lifecycle `draft → live ↔ paused → archived`;
- deterministic A/B/C only, human winner;
- `/admin/landing-pages` internal workspace and future `/lp/[slug]` public surface;
- reuse `/api/public/lead-intake`, `leads.landing_path`, `leads.attribution`, and `lead_source_touchpoints`;
- no parallel lead, consent, or attribution truth;
- landing identity trusted only through signed server publication context;
- Super Admin + Sales Manager Landing Lab management authority;
- privacy-safe exposure denominator with no PII;
- Phase 9A M31 unchanged; campaign destination coupling stays opaque;
- Phase 9C provider execution excluded;
- Phase 10 remains the production activation gate.

Next formal gate: `PHASE_9B_M32_IMPLEMENTATION_PREFLIGHT`.
<!-- PHASE_9B_ARCHITECTURE_FREEZE_END -->
