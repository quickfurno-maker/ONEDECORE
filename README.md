# ONEDECORE

> **One Vision. Complete Interiors.**

ONEDECORE is a premium interior-business operating system for Pune, India — combining a production public website and portfolio with a planned sales, quotation, project execution, design, WhatsApp, and marketing CRM backbone.

**Current phase:** Phase 5C — Lead Workspace & Premium Role-Aware CRM (**implementation complete**; closeout doc PR pending merge).
**Next implementation:** Phase 5D (bulk import / sales targets) — **not started**; requires separate owner authorization after Phase 5C closeout PR merges.

---

## 1. Locked Project Identity

- **Brand:** ONEDECORE
- **Tagline:** One Vision. Complete Interiors.
- **Domain:** `onedecore.in`
- **Initial Launch Market:** Pune, India
- **Core Services:** Complete Home Interiors · Modular Kitchens · Custom Wardrobes
- **Deployment Target:** Hostinger VPS — **application not yet production-deployed** (Phase 10)
- **Repository:** Independent from QuickFurno and Jarvis

---

## 2. What Is Live vs Planned

### Merged on protected main / database-ready

| Capability | Notes |
| :--- | :--- |
| Premium public homepage (R4/R5) | Merged on `main`; not production-deployed |
| Public portfolio | `/portfolio`, `/portfolio/[slug]`, SEO, sitemap |
| Portfolio admin CMS | `/admin/portfolio` with secure media pipeline |
| Staff authentication | Invitation-only email/password; Proxy session guard |
| Database RBAC | `public.authorize`, active-profile enforcement |
| CRM identity & data foundation (Phase 5B) | Migration 11 — merged; managed applied |
| CRM read-only workspace (Phase 5C1) | `/admin/crm` — merged; managed migration 12 applied |
| Lead assignment mutations (Phase 5C2A) | Assign/reassign/safe-unassign — merged; managed migration 13 applied |
| Manual lead creation (Phase 5C2B) | Duplicate-safe flow — merged; managed migration 14 applied |
| Lifecycle collaboration (Phase 5C2C) | Status/note/follow-up mutations — merged (PR #11) |
| Lead intake **schema** | Migrations 9–10; managed aligned through 14 |
| Public lead form | **Merged; default `copy-only`; server `disabled`** |

Managed Supabase (**OneDecore**, `lpurlfmpvriyvpkujvyl`): migrations **1–14** aligned (M14 applied August 2, 2026).

### Not yet complete

Phase 5D+ (bulk import, targets, WhatsApp, quotations, projects, campaigns), public lead activation, and **production deployment** (Phase 10).

See [Phase Roadmap](docs/09-phase-roadmap.md) and [Phase 5A Audit](docs/audits/phase-5a-crm-architecture-freeze.md).

---

## 3. Product Architecture Domains

ONEDECORE spans ten integrated domains (public site, portfolio, secure intake, CRM, quotations, project execution, design, WhatsApp, AI copilot, campaigns). Domains 4–9 are architecture-frozen in Phase 5A and implemented in Phases 5B–9.

Five locked V1 staff roles: `super_admin`, `sales_manager`, `sales_executive`, `project_manager`, `designer` — see [ADR-0019](docs/ADR/ADR-0019-five-role-crm-authorization-model.md).

---

## 4. Core Architectural Boundaries

- **Source of Truth:** Supabase PostgreSQL for all structured data.
- **Authorization:** Server-side + RLS; UI hiding is not security.
- **Database-Before-Automation:** Persist before n8n or outbound notifications.
- **WhatsApp:** Official Meta Cloud API only (planned); no Web scraping.
- **AI:** Human-controlled Groq copilot behind provider adapter (planned); no autonomous action.
- **No-ERP:** No accounting, procurement, inventory, or labour dispatch.
- **Public Intake:** Disabled by default; activation requires separate owner authority (Phase 5F).

---

## 5. Documentation

| Document | Purpose |
| :--- | :--- |
| [Project Truth](docs/00-project-truth.md) | Governance baseline |
| [Product Requirements](docs/01-product-requirements.md) | Live vs planned scope |
| [Architecture](docs/02-architecture.md) | Technical structure |
| [Data Domains](docs/05-supabase-data-domains.md) | Schema domains |
| [Security & RLS](docs/06-security-privacy-and-rls.md) | Security contracts |
| [CRM Boundary](docs/07-crm-and-quotation-boundary.md) | Pipeline & quotations |
| [WhatsApp & AI Boundary](docs/08-whatsapp-and-n8n-boundary.md) | Integration rules |
| [Phase Roadmap](docs/09-phase-roadmap.md) | Phases 1–10 |
| [Decision Register](docs/10-decision-register.md) | Locked decisions |
| [ADRs](docs/ADR/) | Architecture decisions |
| [Audits](docs/audits/) | Phase audit reports |

---

## 6. Engineering Baseline

- **Framework:** Next.js 16.2.11 · React 19 · TypeScript 5 · Tailwind CSS v4
- **Node:** 24.x LTS (`>=24 <25`) · npm 11.16.0
- **Database:** Supabase (`lpurlfmpvriyvpkujvyl`, Mumbai) · **13 migrations applied** (managed aligned)
- **Quality gates:** `npm run check` · `npm run check:db`
- **Contributions:** [CONTRIBUTING.md](CONTRIBUTING.md) · [SECURITY.md](SECURITY.md)

---

## 7. License & Ownership

Confidential and Proprietary. All rights reserved by ONEDECORE (`onedecore.in`).
