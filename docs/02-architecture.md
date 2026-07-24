# 02 — TECHNICAL ARCHITECTURE AND REPOSITORY SPECIFICATION

**Document Status:** Locked Architecture Baseline  
**Pattern:** Modular Monolith  
**Framework Target:** Next.js 16.x stable (pinned during Phase 2)  
**Database Target:** Supabase PostgreSQL  
**Route Prefix:** Internal CRM uses `/admin`  

---

## 1. System Architecture Overview

ONEDECORE is architected as a clean, single modular monolith. The system enforces strict separation between public presentation components, server-side domain logic, database persistence, and external integration adapters.

```
┌────────────────────────────────────────────────────────────────────────┐
│                        NEXT.JS 16.X APPLICATION                        │
│                                                                        │
│  ┌───────────────────────┐                  ┌──────────────────────┐   │
│  │ Public Routes         │                  │ Admin CRM Routes     │   │
│  │ (src/app/(public)/...)│                  │ (src/app/(admin)/...)│   │
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
    │   ├── portfolio/         # Portfolio presentation & state logic
    │   ├── leads/             # Lead management & pipeline rules
    │   ├── quotations/        # Commercial quote builder & calculations
    │   └── whatsapp/          # Messaging components & conversation views
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
