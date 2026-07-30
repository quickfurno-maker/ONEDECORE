# ONEDECORE

> **One Vision. Complete Interiors.**

ONEDECORE is a premium interior-business operating system for Pune, India — combining a production public website and portfolio with a planned sales, quotation, project execution, design, WhatsApp, and marketing CRM backbone.

**Current phase:** Phase 5A — CRM & Operations Architecture Freeze (documentation only).
**Next implementation:** Phase 5B — CRM Identity, Authorization & Core Data Foundation.

---

## 1. Locked Project Identity

- **Brand:** ONEDECORE
- **Tagline:** One Vision. Complete Interiors.
- **Domain:** `onedecore.in`
- **Initial Launch Market:** Pune, India
- **Core Services:** Complete Home Interiors · Modular Kitchens · Custom Wardrobes
- **Deployment Target:** Hostinger VPS (not yet deployed)
- **Repository:** Independent from QuickFurno and Jarvis

---

## 2. What Is Live vs Planned

### Live on `main` (merged)

| Capability | Notes |
| :--- | :--- |
| Premium public homepage (R4/R5) | Production homepage with planner and estimator |
| Public portfolio | `/portfolio`, `/portfolio/[slug]`, SEO, sitemap |
| Portfolio admin CMS | `/admin/portfolio` with secure media pipeline |
| Staff authentication | Invitation-only email/password; Proxy session guard |
| Database RBAC | `public.authorize`, active-profile enforcement |
| Lead intake **schema** | Migrations 9–10 applied (managed 10/10) |
| Public lead form | **Merged; default `copy-only`; server `disabled`** |

### Planned — not live

CRM workspace, manual/bulk leads, source-based assignment, sales targets, WhatsApp inbox, Groq copilot, quotations, project execution, designer workflows, marketing campaigns, public lead activation, production deployment.

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
- **Database:** Supabase (`lpurlfmpvriyvpkujvyl`, Mumbai) · 10 migrations applied
- **Quality gates:** `npm run check` · `npm run check:db`
- **Contributions:** [CONTRIBUTING.md](CONTRIBUTING.md) · [SECURITY.md](SECURITY.md)

---

## 7. License & Ownership

Confidential and Proprietary. All rights reserved by ONEDECORE (`onedecore.in`).
