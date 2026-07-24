# ADR-0001: MODULAR MONOLITH REPOSITORY PATTERN

**Status:** Accepted  
**Date:** July 24, 2026  
**Deciders:** Senior Product Architect, Software Architect  
**Technical Scope:** Repository Structure & Code Organization  

---

## Context and Problem Statement

ONEDECORE requires a maintainable, scalable codebase that supports a public marketing website, a dedicated portfolio showcase, an internal sales CRM, Meta WhatsApp integration, and n8n webhooks. We must choose between a monorepo (e.g., Turborepo/Nx), microservices, or a single modular monolith.

---

## Decision Drivers

- Single developer / small core team velocity in early phases.
- Minimal operational deployment overhead on Hostinger VPS.
- Strict isolation requirements between public web components and internal administrative logic.
- Avoidance of premature microservice fragmentation.

---

## Considered Options

1. **Option 1:** Monorepo with separate Next.js packages (`apps/web`, `apps/crm`, `packages/db`).
2. **Option 2:** Single Modular Monolith using Next.js App Router and `src/` directory layout.
3. **Option 3:** Decoupled Microservices.

---

## Decision Outcome

**Chosen Option:** **Option 2: Single Modular Monolith using Next.js App Router and `src/` layout.**

### Directory Structure Decision

```text
src/
├── app/                  # Route groups: (public), (auth), (admin), api
├── components/           # UI primitives and shared widgets
├── features/             # Business features: portfolio, leads, quotations, whatsapp
├── server/               # Server-only repositories, services, auth checks, Supabase client
├── types/                # TypeScript interfaces and DB schema types
└── lib/                  # Shared utility functions
```

### Consequences & Rules

- **Positive:** Single repository simplifies deployment, local development, and TypeScript type sharing.
- **Positive:** Feature encapsulation in `src/features` prevents monolithic spaghetti code.
- **Rule:** Public components in `src/app/(public)` must never directly query private database tables or expose service role keys.
- **Rule:** Internal admin CRM routes use the `/admin` URL prefix.
