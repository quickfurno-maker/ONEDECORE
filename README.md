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
- [Architecture Decision Records (ADRs)](docs/ADR/)
- [Baseline Audits](docs/audits/)

---

## 5. Repository Setup & Governance

- **Framework Baseline:** Next.js 16.2.11 (React 19, Tailwind CSS v4, TypeScript 5).
- **Engine Contract:** Node.js 24.x LTS (`>=24 <25`) and npm 11.16.0 (`.nvmrc`, `.node-version`, `.npmrc`).
- **Database & SSR Integration:** Supabase Mumbai Project (`lpurlfmpvriyvpkujvyl`), `@supabase/supabase-js@2.110.8`, `@supabase/ssr@0.12.3`, `supabase@2.109.1`.
- **Database Schema & Hardening:** Identity & RBAC foundation (`profiles`, `roles`, `permissions`, `role_permissions`, `user_roles`) with strict column-level grants, 100% RLS coverage, system RBAC immutability, `public.authorize(text)` RPC, and pgTAP test suite (37 subtests).
- **Staff Authentication & Route Security:** Staff-only email/password login (`/auth/login`), POST-only sign-out (`/auth/signout`), Next.js 16 Proxy session guard, and server-side `admin.access` permission enforcement in `/admin/layout.tsx`.
- **Docker Isolation Policy:** Shared Docker Desktop engine with strict project isolation (`project_id = "OneDecore"`). Zero global prune commands.
- **Repository Structure:** Single modular monolith (`src/app`, `src/config`, `src/lib/supabase`, `src/types`, `supabase/migrations`, `supabase/tests`).
- **Admin Prefix:** `/admin` for all internal application routes.
- **Quality Verification:** Execute `npm run check` (App quality gate) and `npm run check:db` (Database lint & pgTAP tests).
- **Contributions:** Refer to [`CONTRIBUTING.md`](CONTRIBUTING.md) for workflow rules and [`SECURITY.md`](SECURITY.md) for security policy.

---

## 6. License & Ownership

Confidential and Proprietary. All rights reserved by ONEDECORE (`onedecore.in`).
