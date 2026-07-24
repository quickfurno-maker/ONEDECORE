# ADR-0006: PUBLIC AND ADMIN ROUTE SEPARATION

**Status:** Accepted (Corrected in Phase 1B Owner Review)  
**Date:** July 24, 2026  
**Deciders:** Senior Software Architect, Security Architect  
**Technical Scope:** Routing Architecture & Route Group Isolation  

---

## Context and Problem Statement

ONEDECORE includes public marketing routes (`/`, `/portfolio`, `/services/*`) and internal administrative routes (leads, quotations, portfolio CMS). We must establish a URL path convention and Next.js route group structure that prevents accidental exposure of CRM components.

---

## Decision Drivers

- Clear administrative boundary for URL routing and web application firewalls.
- Route group separation in Next.js App Router.
- Simplification of authentication middleware and session checks.

---

## Decision Outcome

**Chosen Route Pattern:** **Internal CRM routes are prefixed exclusively with `/admin`. Auth routes use `/login` under `src/app/(auth)/login`.**

### Route Group Structure

```text
src/app/
├── (public)/              # Public website route group
│   ├── layout.tsx         # Public website layout (Header, Nav, Footer)
│   ├── page.tsx           # Homepage
│   ├── portfolio/         # Dedicated Portfolio page & case studies
│   └── services/          # Service landing pages
├── (auth)/                # Authentication route group
│   └── login/             # Staff login page (/login)
└── (admin)/               # Internal CRM route group
    └── admin/             # Prefix for all CRM routes (/admin/dashboard, /admin/leads)
```

### Key Rules

- All CRM administrative pages reside under `/admin/*`. The `/crm` URL prefix is deprecated in favor of `/admin`.
- Middleware enforces authenticated staff session checks on 100% of routes matching `/admin/*`.
- Public website routes in `(public)` contain zero administrative or CRM component imports.
