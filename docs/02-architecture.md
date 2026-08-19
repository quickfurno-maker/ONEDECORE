# 02 — TECHNICAL ARCHITECTURE AND REPOSITORY SPECIFICATION

**Document Status:** Locked Architecture Baseline (truth-synced through Phase 9C-B repository implementation, August 19, 2026)
**Pattern:** Modular Monolith
**Framework:** Next.js 16.2.11
**Database:** Supabase PostgreSQL
**Route Prefix:** Internal CRM uses `/admin`
**Current Phase:** Phase 9A **COMPLETE**. Phase 9B **M32 MANAGED APPLIED** (DEC-0084; production OFF). Phase 9C-A **ARCHITECTURE_FROZEN** (ADR-0031 / DEC-0085). Phase 9C-B **REPOSITORY IMPLEMENTED** (DEC-0086; managed still M1–M32). Phase 9C-C **NOT STARTED**. Phase 9D-A **ARCHITECTURE_FROZEN** (ADR-0030). Architecture PR #62 merged `caff9d0864e1546dff38646df4355dafa851a473`.

---

## 1. System Architecture Overview

ONEDECORE is architected as a clean, single modular monolith. The system enforces strict separation between public presentation components, server-side domain logic, database persistence, and external integration adapters.

```
┌────────────────────────────────────────────────────────────────────────┐
│                        NEXT.JS 16.X APPLICATION                        │
│                                                                        │
│  ┌───────────────────────┐                  ┌──────────────────────┐   │
│  │ Public Routes         │                  │ Admin CRM Routes     │   │
│  │ (src/app/...)         │                  │ (src/app/admin/...)  │   │
│  └───────────┬───────────┘                  └───────────┬──────────┘   │
│              │                                          │              │
│              ▼                                          ▼              │
│  ┌──────────────────────────────────────────────────────────────────┐  │
│  │ Feature & Domain Logic Layer (src/features/...)                   │  │
│  └───────────────────────────────┬──────────────────────────────────┘  │
│                                  │                                     │
│                                  ▼                                     │
│  ┌──────────────────────────────────────────────────────────────────┐  │
│  │ Server Repositories, Authorization & Services (src/server/...)    │  │
│  └───────────┬──────────────────────┬──────────────────────┬────────┘  │
└──────────────┼──────────────────────┼──────────────────────┼───────────┘
               │                      │                      │
               ▼                      ▼                      ▼
    ┌────────────────────┐  ┌───────────────────┐  ┌───────────────────┐
    │  Supabase Database │  │ Meta WhatsApp API │  │ n8n Webhook Bus   │
    │  (Source of Truth) │  │ (Official Cloud)  │  │ (Async Alerts)    │
    └────────────────────┘  └───────────────────┘  └───────────────────┘
```

---

## 2. Repository Directory Blueprint

Following the governing blueprint and [ADR-0001](ADR/ADR-0001-modular-monolith.md), the target repository layout uses the `src/` directory pattern:

```text
OneDecore/
├── .editorconfig
├── .gitignore
├── README.md
├── CHANGELOG.md
├── CONTRIBUTING.md
├── SECURITY.md
├── docs/                      # Architecture & governance documentation
│   ├── ADR/                   # Architecture Decision Records
│   └── audits/                # Historical phase audit logs
├── supabase/                  # Supabase database & infrastructure
│   ├── migrations/            # Versioned SQL schema migrations
│   └── seeds/                 # Seed data definitions
├── automation/                # External workflow definitions
│   └── n8n/                   # Version-controlled n8n JSON exports
├── public/                    # Static site assets & favicons
└── src/
    ├── app/                   # Next.js App Router
    │   ├── (public)/          # Public site route group (/portfolio, /services)
    │   ├── (auth)/            # Auth routes (/login)
    │   ├── (admin)/           # Admin CRM route group (/admin/leads, etc.)
    │   └── api/               # API endpoints & verified webhook handlers
    ├── components/            # UI components
    │   ├── ui/                # Reusable design system primitives
    │   ├── public/            # Public web components
    │   └── crm/               # CRM administrative components
    ├── features/              # Feature-owned business modules
    │   ├── portfolio/         # Portfolio (live)
    │   ├── lead-intake/       # Public intake + data plane (schema live; route disabled)
    │   ├── public-site/       # Premium homepage (live)
    │   ├── crm/               # CRM workspace (partial — 5C1 read + 5C2A assignment on main)
    │   ├── quotations/        # Commercial quotes (planned Phase 7)
    │   ├── projects/          # Execution (planned Phase 8)
    │   ├── whatsapp/          # Messaging (planned Phase 6)
    │   └── ai-copilot/        # Human-controlled AI (planned Phase 6C)
    ├── server/                # Server-only modules
    │   ├── db/                # Supabase server & admin client factories
    │   ├── repositories/      # Server-side data access objects
    │   ├── services/          # Business logic & domain workflows
    │   └── auth/              # Server-side authorization checks & RBAC
    ├── config/                # Environment validation (env.ts)
    ├── lib/                   # System wrappers & integration adapters
    │   └── supabase/          # Supabase client factories (client.ts, server.ts, proxy.ts)
    ├── proxy.ts               # Next.js 16 Proxy entry point
```

---

## 3. Mandatory Layer Isolation Rules

1. **Public Presentation Isolation:** Components inside `src/app/(public)` or `src/components/public` must never directly invoke Supabase Service Role keys, WhatsApp API endpoints, or n8n webhooks.
2. **Server-Side Data Access:** All mutations and private CRM data queries execute through server-only services in `src/server/`.
3. **Database-Before-Automation:** Web form handler endpoints inside `src/app/api/` validate incoming payloads (via Zod), commit persistent records to Supabase, and only then dispatch async events to n8n.
4. **Admin Route Separation:** Internal administrative CRM endpoints use the `/admin` URL prefix. Auth routes use `/login` under `src/app/(auth)/login`.

---

## 4. Key Architectural Decisions

- [ADR-0001: Modular Monolith Repository Pattern](ADR/ADR-0001-modular-monolith.md)
- [ADR-0002: Supabase as Primary Source of Truth](ADR/ADR-0002-supabase-source-of-truth.md)
- [ADR-0004: Server-Side Lead Persistence Before n8n](ADR/ADR-0004-crm-before-n8n-persistence.md)
- [ADR-0006: Public and Admin Route Separation](ADR/ADR-0006-public-and-admin-route-separation.md)
- [ADR-0009: Public Security Invoker Authorization RPC Wrapper](ADR/ADR-0009-public-invoker-authorization-rpc.md)
- [ADR-0010: Staff-Only Password Authentication and Admin Route Protection](ADR/ADR-0010-staff-only-password-authentication.md)
- [ADR-0018: Secure Lead Intake Data Plane](ADR/ADR-0018-secure-lead-intake-data-plane.md)
- [ADR-0019: Five-Role CRM Authorization Model](ADR/ADR-0019-five-role-crm-authorization-model.md)
- [ADR-0020: Closed-Won Project Handover Invariants](ADR/ADR-0020-closed-won-project-handover-invariants.md)
- [ADR-0021: Groq Copilot and Official WhatsApp Boundary](ADR/ADR-0021-groq-copilot-and-whatsapp-boundary.md)
- [ADR-0022: V1 Direct Quotation Finalization and Send Authority](ADR/ADR-0022-v1-direct-quotation-finalization-and-send.md)
- [ADR-0024: Phase 8A Project Materialization and PM Handover](ADR/ADR-0024-phase-8a-project-materialization-pm-handover.md)
- [ADR-0025: Phase 8B Designer Assignment and Design Collaboration](ADR/ADR-0025-phase-8b-designer-assignment-design-collaboration.md)
- [ADR-0026: Phase 8C Project Execution Workspace](ADR/ADR-0026-phase-8c-project-execution-workspace.md)
- [ADR-0027: Phase 9A Campaign Consent, Audience & Approval](ADR/ADR-0027-phase-9a-campaign-consent-audience-approval.md)
- [ADR-0031: Phase 9C Campaign Execution Architecture Freeze](ADR/ADR-0031-phase-9c-campaign-execution-attribution-conversion-feedback.md)
- [ADR-0028: Phase 9D Ready-Made Furniture E-commerce](ADR/ADR-0028-phase-9d-ready-made-furniture-ecommerce.md)
- [ADR-0030: Phase 9D architecture freeze](ADR/ADR-0030-phase-9d-ready-made-furniture-ecommerce-architecture.md)

---

## 5. CRM Operating-System Architecture (Phase 5A Freeze)

Phase 5A locks the following cross-cutting patterns for future implementation:

| Concern | Pattern |
| :--- | :--- |
| Authorization | `public.authorize` + RLS row scoping; UI is not security |
| Lead visibility | Executive: assigned only; Manager/Admin: all + unassigned queue |
| Assignment | Manual (Manager/Admin) + source rules (Super Admin); no round-robin |
| Import | Private batches; manager approval; Super Admin direct import |
| Commercial truth | Accepted quotation required for Closed-Won |
| Quotation workflow (planned Phase 7) | Draft → Finalized/Frozen → Sent → client outcomes; **no internal approval**; SE finalize/send for assigned lead; Phase 6B `WHATSAPP_SERVICE` send boundary — ADR-0022 |
| Handover | PM assignment → PM acceptance before execution |
| Design staffing | One Lead Designer + Supporting Designers; manual only |
| AI | Provider adapter; human approval; structured outputs; audit |
| WhatsApp | Official API; M18–M21 managed foundation (ingest, inbox read, send-intent, service-role dispatch); CRM consent authoritative; **not production-activated**; M19 purpose remains `WHATSAPP_SERVICE` |
| Campaigns (Phase 9A managed M31) | Draft → pending_approval → approved/rejected; MARKETING via existing `consent_events`; DNC + channel suppression reused; freeze audience **rules** not recipient PII; no 9B FK; M31 managed-applied immutable |
| Campaign execution (Phase 9C) | Architecture frozen (ADR-0031); 9C-B mock foundation in repository (DEC-0086); managed M1–M32; real adapters 9C-C; production spend Phase 10 |
| Ready-made shop (Phase 9D) | Category `/shop` after 9C; guest checkout; simple variants; COD + online; webhook-authoritative payment; SKU stock not WMS; **9D-A FROZEN** (ADR-0030); **implementation not started** |

Phase 6A delivers managed WhatsApp **data/webhook foundation** (migration 18). Phase 6B delivers managed **inbox/send-intent/dispatch foundations** (migrations 19–21) plus repository admin UI — **not production-activated**. Phase 8C project execution is **COMPLETE** (M30 managed). Phase 9A is **COMPLETE** (ADR-0027 / PR #62 / PR #63 true merge `26e6346ef6722b7c6ff5908c12f208854b513ad6`). Phase 9A M31 is **managed-applied and immutable** (DEC-0080); `/admin/campaigns` is staff governance UI only. Phase 9D `/shop` is **not implemented**. Architecture freeze: [ADR-0030](ADR/ADR-0030-phase-9d-ready-made-furniture-ecommerce-architecture.md).

<!-- PHASE_9B_ARCHITECTURE_FREEZE_START -->
## Phase 9B Architecture — Landing Page Lab

Landing Page Lab remains inside the existing modular monolith.

```text
/admin/landing-pages
        │ staff RBAC (SA/SM)
        ▼
Landing Lab domain
  ├─ landing_pages
  ├─ immutable landing_page_versions
  ├─ landing_publications (draft/live/paused/archived)
  ├─ landing_experiments + 2–3 variants
  └─ privacy-safe landing_exposures
        │
        ▼
/lp/[slug] server resolver
  ├─ deterministic variant routing
  ├─ signed publication context
  └─ structured safe rendering
        │
        ▼
/api/public/lead-intake
        │ existing atomic RPC
        ▼
contacts / leads / consent_events
        │
        └─ existing lead_source_touchpoints enriched with landing/campaign metadata
```

No new public lead API, no browser service-role use, no parallel attribution store, no M31 rewrite, no n8n correctness dependency, and no provider execution in 9B.

See ADR-0029.
<!-- PHASE_9B_ARCHITECTURE_FREEZE_END -->

<!-- PHASE_9C_ARCHITECTURE_FREEZE_START -->
## Phase 9C Architecture — Campaign Execution

Campaign execution remains inside the modular monolith. Supabase owns run/operation truth. **One run binds one Ads provider target.** Server adapters call Meta Ads **or** Google Ads for that run. n8n is not the correctness path. Approved `campaign_versions` stay immutable. Production live spend and provider CRM-identifier sharing remain Phase 10 gated.

See ADR-0031.
<!-- PHASE_9C_ARCHITECTURE_FREEZE_END -->
