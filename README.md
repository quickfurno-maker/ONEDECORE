# ONEDECORE

> **One Vision. Complete Interiors.**

ONEDECORE is a premium interior-business web application designed for high-end residential interior project storytelling, portfolio presentation, lead capture, commercial quotation management, and Meta WhatsApp integration in Pune, India.

---

## 1. Locked Project Identity

- **Brand:** ONEDECORE
- **Tagline:** One Vision. Complete Interiors.
- **Domain:** `onedecore.in`
- **Initial Launch Market:** Pune, India
- **Core Services:**
  1. Complete Home Interiors
  2. Modular Kitchens
  3. Custom Wardrobes
- **Deployment Target:** Hostinger VPS
- **Project Separation:** Fully independent repository; strictly separate from QuickFurno and Jarvis.

---

## 2. Product Architecture Layers

ONEDECORE consists of five integrated product layers:

1. **Premium Public Website:** Architectural brand experience (`/`, `/about`, `/services/*`, `/process`, `/craftsmanship`, `/contact`).
2. **Dedicated Portfolio System:** Separate public project showcase (`/portfolio`, `/portfolio/[slug]`) with faceted filtering, room tags, and case studies.
3. **Sales & Client CRM:** Internal administrative management portal (`/admin/dashboard`, `/admin/leads`, `/admin/quotations`, `/admin/portfolio`) with role-based access control.
4. **Official Meta WhatsApp Cloud API:** Verified webhook endpoint and template notifications with opt-in consent logging.
5. **Controlled n8n Workflows:** Async event-driven automation bus triggered strictly after database persistence.

---

## 3. Core Architectural Boundaries

- **Source of Truth:** Supabase PostgreSQL is the sole permanent database for structured application data, leads, portfolio records, and audit logs.
- **n8n Boundary:** n8n is an event dispatcher and notification relay. It does not own lead state and is never used as a permanent customer or portfolio database.
- **Storage Boundary:** Private master portfolio originals are kept separate from public optimized derivatives. Private client documents use strict RLS and signed URLs.
- **Version 1 No-ERP Boundary:** Excludes accounting ledgers, vendor procurement, warehouse inventory, labor scheduling, and autonomous AI sales bots.
- **Quality Benchmark:** "₹100-crore" is an internal execution and aesthetic standard only; it is never used in public financial or scale claims.

---

## 4. Documentation Baseline

Detailed project documentation is available in the [`docs/`](docs/) directory:

- [Project Truth](docs/00-project-truth.md)
- [Product Requirements](docs/01-product-requirements.md)
- [Architecture & Repository Structure](docs/02-architecture.md)
- [Public Site & Sitemap](docs/03-public-site-and-sitemap.md)
- [Portfolio Architecture](docs/04-portfolio-architecture.md)
- [Supabase Data Domains](docs/05-supabase-data-domains.md)
- [Security, Privacy & RLS](docs/06-security-privacy-and-rls.md)
- [CRM & Quotation Boundary](docs/07-crm-and-quotation-boundary.md)
- [WhatsApp & n8n Boundary](docs/08-whatsapp-and-n8n-boundary.md)
- [Phase Implementation Roadmap](docs/09-phase-roadmap.md)
- [Decision Register](docs/10-decision-register.md)
- [Phase 2F Public Site Design (Direction A)](docs/design/phase-2f-direction-a-production-spec.md)
- [Architecture Decision Records (ADRs)](docs/ADR/)
- [Baseline Audits](docs/audits/)

---

## 5. Repository Setup & Governance

- **Framework Baseline:** Next.js 16.2.11 (React 19, Tailwind CSS v4, TypeScript 5).
- **Engine Contract:** Node.js 24.x LTS (`>=24 <25`) and npm 11.16.0 (`.nvmrc`, `.node-version`, `.npmrc`).
- **Database & SSR Integration:** Supabase Mumbai Project (`lpurlfmpvriyvpkujvyl`), `@supabase/supabase-js@2.110.8`, `@supabase/ssr@0.12.3`, `supabase@2.109.1`.
- **Database Schema & Hardening:** Identity & RBAC foundation, Portfolio schema foundation (`portfolio_projects`, `portfolio_project_services`, `portfolio_media`, `portfolio_media_sources`), 100% RLS coverage, active staff profile status requirement (`status = 'active'`), `public.authorize(text)` RPC, database-controlled publication workflow (`set_portfolio_project_status` public `SECURITY INVOKER` RPC wrapper, `private.set_portfolio_project_status_impl` private `SECURITY DEFINER` helper, `replace_portfolio_project_services` `SECURITY INVOKER` RPC, published-cover and published-service trigger guards), and pgTAP test suite (88 subtests).
- **Portfolio Admin CMS & Secure Media Pipeline:** Admin CMS (`/admin/portfolio`, `/admin/portfolio/new`, `/admin/portfolio/[projectId]`), server action status controls, multi-role media management UI, server-side Sharp 0.35.3 image sanitization pipeline (metadata/EXIF stripping, 20 MiB master limit, 1600px cover, 1200px gallery, 480px thumbnail WebP derivatives), multi-phase upload compensation cleanup, status RPC exposure hardening (`private.set_portfolio_project_status_impl`), and automated test suite (107 database tests, 15 app/REST integration tests, 17 image/WebP tests).
- **Public Portfolio Experience (Phase 2E3):** Public homepage featured section, paginated listing (`/portfolio`), dynamic detail routes (`/portfolio/[slug]`), `onedecore.in` canonical site identity (`src/config/site.ts`), server-only anonymous Supabase client with public DTOs, exact WebP derivative validation, database-side displayable pagination filtering, `unstable_cache` with CMS mutation invalidation, metadata/Open Graph/JSON-LD/sitemap/robots, true HTTP 404 behaviour, deterministic local fixtures, production HTTP verification tooling, and automated test suite (107 database tests, 90 application/public tests, 17 image/WebP tests). Architecture commit `4dee9a02eaab02e635ecd0be39d9b254e57831a5`; functional commit `205cb8deb081f68802589ab420bbb67b3f62e885`. Zero schema migrations (`ADR-0016`, `ADR-0017`, `phase-2e3b-public-portfolio-local-implementation.md`, `phase-2e3c-remote-portfolio-e2e.md`).
- **Public Website Design Freeze (Phase 2F-B):** Owner-approved Direction A (Quiet Architectural Editorial) frozen into production design tokens, component architecture, content/asset contracts, motion architecture, and implementation slices (`docs/design/`, `ADR-0018`–`ADR-0020`, `phase-2f-b-design-and-architecture-freeze.md`). Implementation begins in Phase 2F-C; no production UI changes in 2F-B.
- **Staff Authentication & Super Admin Bootstrap:** Staff-only email/password login (`/auth/login`), POST-only sign-out (`/auth/signout`), Next.js 16 Proxy session guard, server-side `admin.access` permission enforcement in `/admin/layout.tsx`, and bootstrapped initial owner Super Admin user.
- **Docker Isolation Policy:** Shared Docker Desktop engine with strict project isolation (`project_id = "OneDecore"`). Zero global prune commands.
- **Repository Structure:** Single modular monolith (`src/app`, `src/config`, `src/lib/supabase`, `src/types`, `supabase/migrations`, `supabase/tests`).
- **Admin Prefix:** `/admin` for all internal application routes.
- **Quality Verification:** Execute `npm run check` (App quality gate) and `npm run check:db` (Database lint & pgTAP tests).
- **Contributions:** Refer to [`CONTRIBUTING.md`](CONTRIBUTING.md) for workflow rules and [`SECURITY.md`](SECURITY.md) for security policy.

---

## 6. License & Ownership

Confidential and Proprietary. All rights reserved by ONEDECORE (`onedecore.in`).
