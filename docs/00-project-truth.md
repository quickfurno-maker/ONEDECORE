# 00 — PROJECT TRUTH AND GOVERNANCE BASELINE

**Document Status:** Locked Governance Baseline (truth-synced post Phase 5D closeout, August 3, 2026)
**Project Name:** ONEDECORE
**Tagline:** One Vision. Complete Interiors.
**Domain:** `onedecore.in`
**Initial Market:** Pune, India
**Deployment Target:** Hostinger VPS
**Current Phase:** Phase 5D — Bulk Import & Source-Based Assignment (**COMPLETE** — closeout PR pending merge)
**Next Implementation Phase:** Phase 5E — Sales Targets & CRM Reporting (**5E-B not started**)

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
│ 7. Official Meta WhatsApp Cloud API (planned)         │
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
| Managed migration alignment | **1–15** on OneDecore (`lpurlfmpvriyvpkujvyl`) |

CRM workspace mutation slices (5C2A–5C2C) and Phase 5D bulk import are **merged on protected main** with managed database foundation through M15; **production deployment pending** (Phase 10).

### Planned — not live

Phase 5E-B+ (targets reporting implementation), WhatsApp inbox, Groq copilot, quotations, project execution, designer workflows, marketing campaigns, Landing Page Lab (Phase 9B — roadmap-locked, not implemented), public lead activation (Phase 5F), production deployment.

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
14. **Public Lead Intake:** Defaults remain disabled; activation requires separate owner authority (Phase 5F).

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
