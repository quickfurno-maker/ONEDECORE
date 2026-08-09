# 00 — PROJECT TRUTH AND GOVERNANCE BASELINE

**Document Status:** Locked Governance Baseline (truth-synced post Phase 6C closeout, August 9, 2026)
**Project Name:** ONEDECORE
**Tagline:** One Vision. Complete Interiors.
**Domain:** `onedecore.in`
**Initial Market:** Pune, India
**Deployment Target:** Hostinger VPS
**Current Phase:** Phase 6D — Staff Administration, Attendance & Leave (**READY TO START formal implementation**)
**Previous Phase:** Phase 6C — Groq Human-Controlled Copilot (**COMPLETE**)

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
| Managed migration alignment | **1–22** on OneDecore (`lpurlfmpvriyvpkujvyl`); **no M23+** |

CRM workspace mutation slices (5C2A–5C2C), Phase 5D bulk import, Phase 5E targets/reporting, Phase 5F identity hardening, Phase 6A WhatsApp foundation, and Phase 6B shared inbox/send-intent/dispatch foundations are **merged on protected main** with managed database foundation through M21; **production deployment pending** (Phase 10); **public intake remains inactive**; **WhatsApp not production-activated** (no Meta callback/token; no real outbound).

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
- Phase 6C formally **COMPLETE** (closeout merged). **Phase 6D** is next.

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

WhatsApp shared inbox/outbound runtime (Phase 6B), quotations, project execution, designer workflows, marketing campaigns, Landing Page Lab (Phase 9B — roadmap-locked, not implemented), **public lead activation**, production deployment, **Meta production webhook/callback activation**.

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
- **[DEFERRED / NOT IN V1 ERP]:** Accounting, procurement, inventory, labour dispatch, autonomous AI agents.
- **[OPEN RISK]:** Verified project photography; Meta template approval timelines; legal gates for public intake activation.

---

## 7. Related Governance Documents

- [Product Requirements](01-product-requirements.md)
- [Architecture & Repository Structure](02-architecture.md)
- [Phase Roadmap](09-phase-roadmap.md)
- [Decision Register](10-decision-register.md)
- [Phase 5A Audit](audits/phase-5a-crm-architecture-freeze.md)
- [ADR-0019: Five-Role CRM Authorization](ADR/ADR-0019-five-role-crm-authorization-model.md)
