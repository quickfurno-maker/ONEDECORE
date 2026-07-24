# ONEDECORE — CONTRIBUTING GUIDELINES

Thank you for contributing to ONEDECORE. This document defines the engineering standards, architecture rules, and workflow guidelines governing all repository contributions.

---

## 1. Core Principles

1. **Strict Independence:** ONEDECORE is a completely standalone project. Never copy, reference, or import code from QuickFurno or Jarvis.
2. **Supabase Source of Truth:** All persistent state resides in Supabase PostgreSQL. Never use n8n or local memory as a primary store.
3. **No Unverified Claims:** Never add unverified business facts, fake testimonials, fake client metrics, or fake factory claims to the public codebase.
4. **Version 1 Scope Discipline:** Respect the V1 no-ERP boundary. Defer accounting, procurement, inventory, labor scheduling, and autonomous AI bots.
5. **Security & Privacy by Design:** Enforce RLS on all exposed Supabase API tables. Never expose `SUPABASE_SERVICE_ROLE_KEY` to client components.

---

## 2. Repository Structure & Conventions

Follow the single modular monolith layout defined in [ADR-0001](docs/ADR/ADR-0001-modular-monolith.md):

- `src/app/(public)` — Public website pages and dynamic portfolio presentation.
- `src/app/(auth)` — Staff authentication (`/login`).
- `src/app/(admin)` — Internal administrative CRM (`/admin/...`).
- `src/features` — Domain logic grouped by feature area (`leads`, `quotations`, `portfolio`, `whatsapp`).
- `src/server` — Server-only repositories, services, authorization, and Supabase client factories.
- `src/components/ui` — Reusable, accessible UI primitives.
- `supabase/migrations` — Versioned, reproducible SQL schema migrations.
- `automation/n8n` — Version-controlled n8n workflow definitions and payload contracts.

---

## 3. Commit Message Standards

Use conventional commit messages with descriptive scopes:

- `feat(portfolio): add room tag filtering logic`
- `fix(crm): resolve lead status transition guardrail`
- `docs(adr): update ADR-0004 for webhook persistence`
- `chore(governance): establish phase 1 baseline`

---

## 4. Quality & Verification Gates

Before submitting code:
- Ensure TypeScript compiles cleanly with zero errors (`tsc --noEmit`).
- Verify ESLint and Prettier formatting rules pass.
- Run local Supabase RLS test suites.
- Confirm zero secrets or API keys are present in code or commit history.

---

## 5. Decision Process

Architectural modifications require an Architecture Decision Record (ADR) update in `docs/ADR/` and explicit approval from the lead architect and business owner.
