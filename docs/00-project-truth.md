# 00 — PROJECT TRUTH AND GOVERNANCE BASELINE

**Document Status:** Locked Governance Baseline (truth-synced 2026-09-02 to the accelerated closeout lock)
**Project Name:** ONEDECORE
**Tagline:** One Vision. Complete Interiors.
**Domain:** `onedecore.in`
**Initial Market:** Pune, India
**Deployment Target:** Hostinger VPS (`91.108.105.192`; app `/var/www/onedecore`; PM2 `onedecore`; Nginx → `127.0.0.1:3000`)

> **CURRENT EXECUTION AUTHORITY:** [docs/11 — Accelerated Closeout Roadmap](11-accelerated-closeout-roadmap.md) (owner-locked 2026-09-02, **DEC-0097**).
> Sequencing instructions in [09 — Phase Implementation Roadmap](09-phase-roadmap.md) and [CRM 2.0 Product Roadmap](product/crm-2.0-roadmap.md) are **historical evidence only** and no longer schedule work.

**Protected `main` baseline:** `27bcee1f36468175e1509e5ec10a0b3533f9c7d7` (PR **#121** merged; exact certified head `0a42534213c817b05b48c96fb6fa6e6c7761cd85`).
**Current Phase:** **P1** — governance truth sync & release freeze (**documentation/governance only; no runtime change**).
**Next Phase:** **P2** — production exact-SHA alignment & smoke verification.
**Final lock:** **P8** is E-commerce production activation (**second-last**); **P9** is Meta WhatsApp + n8n production activation (**final**).
**Previous Phase:** CRM 2E management analytics + WhatsApp lead-link repair + WhatsApp launch certification + CRM SLA admin settings (PRs #117–#121, all **MERGED**).

### Live vs off (current, 2026-09-02)

| Capability | State |
| :--- | :--- |
| Public website, homepage, portfolio | **LIVE** |
| Public website lead intake | **LIVE** |
| CRM through **2E** (2A–2E) | **MERGED / PRODUCTION LIVE** |
| CRM first-contact SLA | **ACTIVE in managed Supabase** — 60 business minutes, Asia/Kolkata, Mon–Sat, 09:00–19:00, non-retroactive |
| Repository migrations / managed migrations | **49 / 49** — aligned; **no pending managed batch** |
| Shop public gate (`ONEDECORE_SHOP_PUBLIC_ENABLED`) | **OFF / fail-closed** — activation is **P8** |
| Online payments / M38 | **DEFERRED** — not on `main`, not managed |
| Meta WhatsApp live callback / tokens / outbound | **OFF** — activation is **P9** |
| n8n production automation | **DEFERRED** — activation is **P9** |
| Campaign live spend | **OFF** — activation is **P6** |
| Landing Lab public gate | **OFF** — activation is **P6** |
| Kriti provider production activation | **DEFERRED** — activation is **P7** |

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

ONEDECORE is an integrated operating system spanning multiple product domains. **Built** (implemented and merged) is distinguished from **activated** (running in production). Activation is always a separate, explicit owner gate — see [docs/11](11-accelerated-closeout-roadmap.md).

| # | Product domain | Built | Production activation |
| :--- | :--- | :--- | :--- |
| 1 | Premium Public Website & Legal Presentation | Yes | **LIVE** |
| 2 | Dedicated Portfolio System (`/portfolio`) | Yes | **LIVE** |
| 3 | Secure Public Lead Intake (dual-gated) | Yes | **LIVE** |
| 4 | Sales & Operations CRM (`/admin/crm`) — built through **CRM 2E** | Yes | **LIVE** (first-contact SLA active) |
| 5 | Commercial Quotation System | Yes | Certification in **P4** |
| 6 | Project Execution & Design Collaboration | Yes | Certification in **P4** |
| 7 | Official Meta WhatsApp Cloud API | Foundation built | **OFF** — activation **P9** |
| 8 | Human-Controlled Kriti / Groq Copilot | Foundation built | **DEFERRED** — provider activation **P7** |
| 9 | Marketing Campaigns with Consent Controls + Landing Lab | Foundation built | **OFF** — activation **P6** |
| 10 | Controlled n8n Workflows (async notification bus) | Boundary defined | **DEFERRED** — activation **P9** |
| 11 | Ready-Made Furniture Shop (`/shop`, COD commerce) | Foundation built | **OFF / fail-closed** — activation **P8** |
| 12 | Staff Administration, Attendance & Leave | Yes | Operational activation **P5** |
| — | Online payments / M38 | Not on `main` | **DEFERRED** (ADR-0033 / DEC-0094) |

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
| Lead intake data plane (migrations 9–10) | Schema merged; **production activated** (`ONEDECORE_LEAD_INTAKE_MODE=enabled`) |
| Public lead form UI | **Merged; production LIVE** on canonical public website |
| CRM 2A (activities, My Day, assignment automation) | Merged on `main`; production live |
| CRM 2B-1 (premium mobile CRM UX, My Day nav, manual lead phone rule) | Merged PR #107; **production live** @ `0a27b2f` |
| Phase 10C premium interior-first homepage launch UX | Merged PR #110 |
| Phase 10D premium commerce storefront UI | Merged PR #111 (Shop remains **OFF / fail-closed**) |
| Phase 10E interior launch closeout | Merged PR #113 |
| CRM 2B (calendar + premium pipeline) | Merged PR #114 |
| CRM 2C (sales playbook + cadences) | Merged PR #115 |
| CRM 2D (communication + intelligence) | Merged PR #116 |
| CRM 2E (management analytics) | Merged PR #117 |
| CRM WhatsApp lead-link repair | Merged PR #118 |
| CRM WhatsApp launch certification | Merged PR #119 |
| Managed migration ledger reconciliation | Merged PR #120 |
| CRM SLA admin settings | Merged PR #121; exact head `0a42534213c817b05b48c96fb6fa6e6c7761cd85` certified |

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
| Landing Page Lab foundation (migration 32) | Managed-applied 2026-08-19 (Phase 9B M32); production Landing Lab **OFF**; DEC-0084 |
| Campaign execution foundation (migration 33) | Managed-applied 2026-08-20 after M32 (Phase 9C-B M33); production execution **OFF**; DEC-0088 |
| Campaign metrics & conversion feedback foundation (migration 34) | Managed-applied 2026-08-20 immediately after M33 (Phase 9C-C M34); DEC-0088 |
| Commerce catalogue & inventory foundation (migration 35) | Managed-applied and certified 2026-08-23 (9D-B closeout); 11 commerce tables; all RLS + FORCE RLS |
| Commerce public storefront read foundation (`20260823140000`) | M36 managed-applied and certified 2026-08-23; git blob `81a096f4c31c6003fdcf6e4595c84dfe0e806911`; PR #82 merged `34741dac155aad67c1ae9f93bd41a2d7316c9b5a` |
| Commerce order COD checkout foundation (`20260824140000`) | Conceptual M37; **COMPLETE / CLOSED** with PR #84 + managed M37 certification (D1/D2 closeout evidence) |
| Migration alignment *(historical entry — state as at Phase 9D-D2 closeout)* | Repository: **M1–M37**; Managed OneDecore (`lpurlfmpvriyvpkujvyl`): **M1–M37** (D1/D2 closeout evidence); **M38 absent** from `main` |

**Current migration alignment (2026-09-02):** Repository **49** migrations; managed OneDecore (`lpurlfmpvriyvpkujvyl`) **49** applied; **aligned**; **no pending managed batch**. Tail: `20260830140000_crm_cadence_playbook_foundation`, `20260831140000_crm_lead_commercial_read_models`, `20260831174021_crm_lead_notes_insert_privilege_redrift_repair`, `20260901140000_crm_management_analytics_read_model`, `20260902140000_crm_whatsapp_lead_link_repair`. **M38 (online payments) remains absent** from `main` and from managed.

> **HISTORICAL — the paragraph below records phase-completion evidence as it stood at Phase 9D-C.** Its trailing claims "Production deployment pending (Phase 10)" and "public intake remains inactive" were true when written and are **no longer current**: production is deployed and public lead intake is **LIVE**. Current state is the table in the header and the current migration alignment note above.

CRM through Phase 7B (quotation acceptance → Closed-Won) is applied on managed database (`lpurlfmpvriyvpkujvyl`) through **M27**. Phase 7B is **COMPLETE** (PR #55 merged). Phase 8A is **COMPLETE** (PR #57 merged `db879b5ca27fe9d26543c23d8f130811c7feadab`; managed **M1–M28**). Phase 8B is **COMPLETE** (OD8B-1–OD8B-8 / ADR-0025 / DEC-0073–DEC-0074; PR #59 merged `6b31052973cf9e50e25803b232ce446308c1fa3a`; managed **M1–M29**). Phase 8C is **COMPLETE** (OD8C-1–OD8C-12 / ADR-0026 / DEC-0075–DEC-0076; architecture PR #60 merged `5b4a7f300e63b438884a2b440a69a569d91b9e5d`; implementation PR #61 true merge `8f4f3ecf082450e82ab15f02703c951e50f0817e`; managed **M1–M30**). Phase 9A architecture is frozen (OD9A-1–OD9A-6 / ADR-0027 / DEC-0077; architecture PR #62 true merge `caff9d0864e1546dff38646df4355dafa851a473`). Phase 9A repository implementation is **REPOSITORY_COMPLETE** (DEC-0078). Phase 9A managed apply is **CERTIFIED** (DEC-0080; M31 applied 2026-08-18; managed **M1–M31**; pending **NONE**; M31 immutable). PR #63 **MERGED** `26e6346ef6722b7c6ff5908c12f208854b513ad6`. Phase 9D-A is **ARCHITECTURE_FROZEN**. Phase 9D-B is **COMPLETE / CLOSED**. Phase 9D-C1 is **MERGED** and M36 is **MANAGED APPLIED / CERTIFIED**. Phase 9D-C2 is **REPOSITORY IMPLEMENTED** on this branch. Phase 9D-C is **IMPLEMENTATION SUBSTANTIALLY COMPLETE / FINAL QA-CLOSEOUT PENDING**. **Production deployment pending** (Phase 10); **public intake remains inactive**.

### Historical phase-truth sections — scope note

> The per-phase truth sections that follow (**Phase 5F through Phase 6D**, plus the recovery-truth and planned-module notes) are **preserved historical evidence**, accurate as at their stated dates. Their recurring statements — "**public intake inactive**", "**no production deployment**", "**production activation remains Phase 10**" — were **true pre-Phase-10 facts** and are **superseded** by the current-state table in this document's header. Production is deployed; public lead intake is **LIVE**. Do not read these sections as current state, and do not delete them: they are the audit trail.

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

### Not live (current, 2026-09-02)

Built but **not activated in production**, each behind its own fail-closed gate:

- Meta WhatsApp production webhook/callback, token activation, and outbound — **P9**
- n8n production automation — **P9**
- Public `/shop` COD storefront runtime and checkout — **P8** (`ONEDECORE_SHOP_PUBLIC_ENABLED` **OFF**)
- Landing Lab public gate and campaign live spend — **P6**
- Kriti provider production activation — **P7**
- Staff attendance/leave operational activation — **P5**
- Online payments / **M38** — **DEFERRED** outside the P1–P9 sequence

**Do not claim a non-activated module is live.** Public website, portfolio, public lead intake, and CRM through 2E **are** live — see the header table.

> *Superseded historical wording (pre-Phase-10):* this section previously also listed "public lead activation" and "production deployment" as not live. Both were true at that time and are no longer current.

---

## 5. Master Governance Rules & Mandatory Corrections

1. **Next.js Version Target:** Next.js 16.x. Baseline scaffold **16.2.11** (Phase 2A / DEC-0015); Phase 10A bounded security bump to **16.3.3** (DEC-0096) **merged**.
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
14. **Public Lead Intake:** **ACTIVATED in production** (`ONEDECORE_LEAD_INTAKE_MODE=enabled`) under the Phase 10 owner gate. The code default remains **fail-closed** (`copy-only` / `disabled`) in every unconfigured environment; M17 identity, DNC and loopback hardening remain in force. *(Historical: prior to Phase 10 this rule read "production activation requires Phase 10" — that gate has since been satisfied and exercised.)*
15. **Fail-Closed Activation:** Deploy is never activation. Every unactivated capability (Shop, online payments, Meta WhatsApp live, n8n, campaign live spend, Landing Lab public, Kriti provider) must fail closed when its flag is absent or false, and may only be activated by the explicit owner act assigned to its phase in [docs/11](11-accelerated-closeout-roadmap.md).
16. **Current Execution Authority:** Work sequencing is governed solely by [docs/11 — Accelerated Closeout Roadmap](11-accelerated-closeout-roadmap.md) (DEC-0097). Documents 09 and `product/crm-2.0-roadmap.md` are historical evidence and do not schedule work.

---

## 6. Decision Classification Summary

- **[LOCKED]:** Brand identity, Supabase source of truth, `/admin` prefix, five-role CRM model, No-ERP boundary, RLS on exposed tables, official WhatsApp only, human-controlled AI only, disabled public intake defaults.
- **[RECOMMENDED — OWNER APPROVAL REQUIRED]:** Typography pairing, Pune geo-landing expansion, visual tokens.
- **[DEFERRED / NOT IN V1 ERP]:** Accounting, procurement, warehouse WMS, labour dispatch, autonomous AI agents. Phase 9D later adds **bounded ready-made SKU stock** for `/shop` only (ADR-0028) — not ERP inventory.
- **[OPEN RISK]:** Verified project photography; Meta template approval timelines; legal gates for public intake activation.

---

## 7. Related Governance Documents

- **[11 — Accelerated Closeout Roadmap](11-accelerated-closeout-roadmap.md) — CURRENT EXECUTION AUTHORITY (DEC-0097)**
- [Product Requirements](01-product-requirements.md)
- [Architecture & Repository Structure](02-architecture.md)
- [09 — Phase Roadmap](09-phase-roadmap.md) — *historical implementation roadmap + evidence ledger*
- [CRM 2.0 Product Roadmap](product/crm-2.0-roadmap.md) — *historical approved CRM product plan (implemented through 2E)*
- [Decision Register](10-decision-register.md)
- [Phase 5A Audit](audits/phase-5a-crm-architecture-freeze.md)
- [ADR-0019: Five-Role CRM Authorization](ADR/ADR-0019-five-role-crm-authorization-model.md)
- [ADR-0026: Phase 8C Project Execution Workspace](ADR/ADR-0026-phase-8c-project-execution-workspace.md)
- [ADR-0027: Phase 9A Campaign Consent, Audience & Approval](ADR/ADR-0027-phase-9a-campaign-consent-audience-approval.md)
- [Phase 8C Architecture Freeze](audits/phase-8c-project-execution-workspace-architecture-freeze.md)
- [Phase 9A Architecture Freeze](audits/phase-9a-campaign-consent-audience-approval-architecture-freeze.md)
- [Phase 9A M31 Implementation](audits/phase-9a-m31-campaign-consent-audience-approval-implementation.md)
- [ADR-0028: Phase 9D Ready-Made Furniture E-commerce](ADR/ADR-0028-phase-9d-ready-made-furniture-ecommerce.md)
- [ADR-0029: Phase 9B Landing Page Lab](ADR/ADR-0029-phase-9b-landing-page-lab.md)
- [Phase 9B architecture freeze](audits/phase-9b-landing-page-lab-architecture-freeze.md)
- [Phase 9B M32 implementation](audits/phase-9b-m32-landing-page-lab-implementation.md)
- [Phase 9B M32 managed apply closeout](audits/phase-9b-m32-managed-apply-closeout.md)
- [ADR-0030: Phase 9D e-commerce architecture freeze](ADR/ADR-0030-phase-9d-ready-made-furniture-ecommerce-architecture.md)
- [Phase 9D-A entry audit](audits/phase-9d-a-ecommerce-entry-audit-architecture-freeze.md)
- [ADR-0031: Phase 9C campaign execution architecture freeze](ADR/ADR-0031-phase-9c-campaign-execution-attribution-conversion-feedback.md)
- [ADR-0032: Commerce admin control and 9D-C storefront preparation](ADR/ADR-0032-commerce-admin-control-and-phase-9d-c-storefront-preparation.md)
- [ADR-0033: Phase 9D COD-first launch and online payment deferral](ADR/ADR-0033-phase-9d-cod-first-launch-and-online-payment-deferral.md)
- [COD-first governance amendment](audits/phase-9d-cod-first-launch-governance-amendment.md)
- [ADR-0032 unified homepage design](design/phase-9d-c-unified-homepage.md)
- [ADR-0032 three-layer public site](design/phase-9d-c-three-layer-public-site.md)
- [Phase 9D-C preparation](audits/phase-9d-c-commerce-admin-storefront-preparation.md)
- [Phase 9C architecture freeze](audits/phase-9c-campaign-execution-attribution-feedback-architecture-freeze.md)

<!-- PHASE_9B_ARCHITECTURE_FREEZE_START -->
## Phase 9B Architecture Freeze — Landing Page Lab

Phase 9B architecture remains **FROZEN** under **ADR-0029 / DEC-0081 / OD9B-1–OD9B-12**. Repository implementation is recorded in **DEC-0082**. Managed apply is recorded in **DEC-0084**. Managed is **M1–M32**; production Landing Lab is **OFF**.

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

Production activation remains Phase 10.
<!-- PHASE_9B_ARCHITECTURE_FREEZE_END -->

<!-- PHASE_9C_ARCHITECTURE_FREEZE_START -->
## Phase 9C Architecture Freeze — Campaign Execution, Attribution & Conversion Feedback

Phase 9C architecture is **FROZEN** under **ADR-0031 / DEC-0085 / OD9C-1–OD9C-18**. Phase 9C-B repository implementation is **MERGED** (**DEC-0086** / PR #70). Phase 9C-C repository implementation is **MERGED** (**DEC-0087** / PR #71). Managed apply of M33 then M34 is **CERTIFIED** (**DEC-0088**). Production execution remains **OFF**. No live Ads writes.

Locked boundaries:

- execute only immutable approved Phase 9A versions;
- one run = one Ads provider target (Meta **or** Google); dual paid channels fail closed;
- canonical run lifecycle `scheduled → running ↔ paused → completed` (`failed` / `cancelled`);
- server-trusted `run_reference` / `run_target_reference`; no UTM/time guessing;
- MARKETING consent is not Ads PII-sharing authority; Phase 10 provider-data-sharing gate fail-closed;
- provider-independent port; Meta Ads + Google Ads MVP only;
- email and WhatsApp MARKETING deferred; M19 `WHATSAPP_SERVICE` unchanged;
- n8n never campaign/consent/attribution/retry truth;
- current MARKETING / DNC / suppression recheck before any export;
- CRM touchpoints remain attribution truth; provider metrics are evidence;
- `CommercialConversion` once from accepted quotation + Closed-Won (`taxable_base_paise`);
- production provider execution remains Phase 10 gated.

9D-B remains blocked until Phase 9C implementation and certification complete.

**Current status (2026-08-23):** Phase 9C is certified. Phase 9D-B is **COMPLETE / CLOSED**. See [M35 closeout](audits/phase-9d-b-m35-managed-apply-closeout.md).
<!-- PHASE_9C_ARCHITECTURE_FREEZE_END -->

<!-- PHASE_9D_B_IMPLEMENTATION_START -->
## Phase 9D-B — Catalogue & Inventory Foundation

Phase 9D-B is **COMPLETE / CLOSED**. Repository implementation is **DEC-0089** / [foundation audit](audits/phase-9d-b-commerce-catalogue-inventory-foundation.md). Closeout: [M35 managed apply](audits/phase-9d-b-m35-managed-apply-closeout.md). Architecture remains **ADR-0030**. PR #73 merged `06b6d2ea5f1cf4d886be497a8eed7ce8d1d52e58`. PR #80 merged `565fa12d10bc98163b30d1832a4aa06367913242` (exact head `0bd24c62c2711319a8daa2cc82352513f9bbe7fb`). Repository **M1–M35**. Managed **M1–M35**. Checkout/payments are **not** implemented. Production remains **OFF**. Public `/shop` arrived later in 9D-C1 (repository only). See [C1 audit](audits/phase-9d-c1-public-storefront-implementation.md).
<!-- PHASE_9D_B_IMPLEMENTATION_END -->

<!-- PHASE_9D_C_PREPARATION_FREEZE_START -->
## Phase 9D-C — Admin Control & Storefront Preparation

Owner lock is **ADR-0032 / DEC-0090** / [audit](audits/phase-9d-c-commerce-admin-storefront-preparation.md). Three-layer routes remain **ADR-0032 §9.2 / DEC-0092**. Root `/` composition is **§9.3 / DEC-0093** (perceived ~50/50). [design](design/phase-9d-c-three-layer-public-site.md). Catalogue operations remain admin-controlled. Pincode remains serviceability authority; cities are grouping/display. Public site is one ONEDECORE brand: mixed `/` (brand discovery), dedicated `/interiors`, dedicated `/shop`, admin-driven furniture categories and featured products. **No M36 allocated by 9D-B closeout.** **Current (2026-08-23):** Phase 9D-C is **COMPLETE / CLOSED**. Evidence: PR #82 merged; M36 managed-certified; PR #83 merged (`31e506a` exact head; protected main `bf6d5cca8daa77870229a15a8ff119b27f7362f9`); Quality Gate PASS; desktop 1440 QA PASS; mobile 320/390/430 overflow QA PASS; drawer focus/Escape/inert QA PASS; runtime/hydration NONE. Zero published managed products remains current business truth. Checkout UI remains 9D-D2. Production remains **OFF**. See [C1 audit](audits/phase-9d-c1-public-storefront-implementation.md) and [C2 audit](audits/phase-9d-c2-unified-home-interiors-implementation.md).
<!-- PHASE_9D_C_PREPARATION_FREEZE_END -->

<!-- PHASE_9D_A_ARCHITECTURE_FREEZE_START -->
## Phase 9D-A Architecture Freeze — Ready-Made Furniture E-commerce

Phase 9D product locks remain **OD9D-1–OD9D-12** (ADR-0028 / DEC-0079). Architecture is **FROZEN** under **ADR-0030 / DEC-0083**. Docs only: no schema, no `/shop` runtime, no payment adapter, no managed write.

9D-B is blocked until Phase 9C is complete and this freeze is merged. Commerce migration number is **unreserved**.

**Current status (2026-08-24):** 9D-B is **COMPLETE / CLOSED**. 9D-C is **COMPLETE / CLOSED**. 9D-D1 is **COMPLETE / CLOSED**. 9D-D2 is **COMPLETE / MERGED** (PR #85 / `f40089b9eb82c9e023365a9dca2cafecde0d54a2`). Repository and managed **M1–M37**. **M38 absent**. Online payment deferred (ADR-0033). See [C2 audit](audits/phase-9d-c2-unified-home-interiors-implementation.md), [D1 audit](audits/phase-9d-d1-cod-order-engine-implementation.md), [D2 audit](audits/phase-9d-d2-cart-checkout-tracking-implementation.md).
<!-- PHASE_9D_A_ARCHITECTURE_FREEZE_END -->

<!-- PHASE_9D_D1_IMPLEMENTATION_START -->
## Phase 9D-D1 — COD Order Engine & Secure Guest Commerce Data Plane

**COMPLETE / CLOSED** — PR #84 merged; managed **M1–M37** certified (D1/D2 closeout evidence). Conceptual M37 `20260824140000_commerce_order_cod_checkout_foundation`. Guest quote/COD/track RPCs are **service_role-only**. No payment tables or providers on `main`. Production remains **OFF**. See [D1 audit](audits/phase-9d-d1-cod-order-engine-implementation.md).
<!-- PHASE_9D_D1_IMPLEMENTATION_END -->

<!-- PHASE_9D_D2_AND_COD_FIRST_START -->
## Phase 9D-D2 — Cart, COD Checkout, Tracking (Merged)

**COMPLETE / MERGED** — PR #85 merge commit `f40089b9eb82c9e023365a9dca2cafecde0d54a2`. Guest COD cart/checkout/tracking and admin orders UI are on `main`. Final manual QA cleared; local merge gate PASS. Production **OFF**. No M38. See [D2 audit](audits/phase-9d-d2-cart-checkout-tracking-implementation.md).

## Phase 9D COD-First Launch (Governance)

Owner amendment **ADR-0033 / DEC-0094**: furniture-shop MVP launch is **COD-only**. Phase 9D-E online payment is **DEFERRED** (preserved locally on `phase-9d-e-online-payments` @ `b2ea05c…`; not on `main`; M38 not managed). **9D-F COMPLETE / MERGED** (PR #87). Public shop requires `ONEDECORE_SHOP_PUBLIC_ENABLED=true` (**DEC-0095**) — remains **OFF**. Online payment requires later separate 9D-E certification + explicit activation. **Production website + CRM + lead intake LIVE** at `0a27b2f`; shop storefront **OFF**.

## Phase 10A — Production Hardening (Closed)

Phase **10A** was security, dependency, and operational-readiness hardening only — **not** Shop activation, payments, CRM SLA, WhatsApp, campaigns, or Landing Lab. [Closeout audit](audits/phase-10a-production-hardening-closeout.md). Bounded remediation: `next` + `eslint-config-next` **16.2.11 → 16.3.3** (DEC-0096) — **merged and current on `main`**; ExcelJS/uuid and dev-toolchain advisories documented deferred. Manual CRM New Lead phone rule (2B-1): staff enter exactly **10 Indian digits**; server canonicalizes to `+91XXXXXXXXXX`. *(The "no commit/push/deploy" restriction was scoped to the 10A gate itself and has been discharged.)*
<!-- PHASE_9D_D2_AND_COD_FIRST_END -->

<!-- ACCELERATED_CLOSEOUT_LOCK_START -->
## Accelerated Closeout Lock (2026-09-02) — CURRENT

Owner-locked under **DEC-0097**. Current execution authority is [docs/11 — Accelerated Closeout Roadmap](11-accelerated-closeout-roadmap.md).

- Protected `main` baseline: `27bcee1f36468175e1509e5ec10a0b3533f9c7d7` (PR **#121**; exact certified head `0a42534213c817b05b48c96fb6fa6e6c7761cd85`).
- Certification recorded at lock: focused SLA **51/51**, app **1543/1543**, DB **2401 PASS**, lint/typecheck/build **PASS**, desktop + mobile owner QA **PASS**.
- Repository **49** migrations / managed **49** applied — aligned; **no pending managed batch**.
- CRM first-contact SLA **ACTIVE** in managed Supabase: 60 business minutes, Asia/Kolkata, Mon–Sat, 09:00–19:00, non-retroactive activation.
- Sequence: **P1 → P2 → P3 → P4 → P5 → P6 → P7 → P8 → P9**. **P1 current**, **P2 next**. **P8** = E-commerce production activation (**second-last**). **P9** = Meta WhatsApp + n8n production activation (**final**).
- Acceleration may retire stale planning and duplicated work; it may **not** bypass protected `main`, exact-head CI, forward-only migration/recovery gates, RLS/RBAC, consent/DNC boundaries, fail-closed feature gates, or production smoke/E2E certification.
- **P1 is documentation/governance only** — no migration, schema, RLS, RPC, `.env*`, dependency, feature-gate, SLA-configuration, deployment, or CI change.
<!-- ACCELERATED_CLOSEOUT_LOCK_END -->
