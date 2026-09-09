# ONEDECORE

> **One Vision. Complete Interiors.**

A premium interior-business operating system for Pune, India: public website and
portfolio, lead intake, CRM, quotations, projects, workforce, plus WhatsApp,
marketing and COD-commerce foundations that are built and deliberately switched
off.

Independent of QuickFurno and Jarvis. No shared code, database, credential or
infrastructure.

**Truth-synced 2026-09-09** against `main` `63ce0777`. For anything below that
matters operationally, [docs/00-project-truth.md](docs/00-project-truth.md) is
authoritative and is kept in the same four-plane form.

---

## Four states, not one

A change can be merged without being deployed, deployed without being activated,
and a database migration can be live while the application change that motivated
it is not. Reading this table as one column is how a deferred capability gets
described as live.

| Plane | State at truth-sync |
| :--- | :--- |
| **Repository** (`main`) | `63ce0777` · 67 migrations · tail `20260909120000_revoke_authenticated_truncate_trigger.sql` |
| **Managed database** (`lpurlfmpvriyvpkujvyl`) | 67 applied, aligned with the repository |
| **Deployed application** (VPS) | last owner-certified release `9fe58385` — later hardening PRs are on `main` but not yet certified onto the VPS |
| **Activation** | see the matrix below |

## What is on, and what is not

| Capability | State |
| :--- | :--- |
| Public website, homepage, portfolio | **ACTIVATED** |
| Public lead intake (`public-consult-v4`) | **ACTIVATED** |
| CRM — chronological Leads inbox, pipeline, quotations, projects | **ACTIVATED** |
| Shop / COD storefront | **OFF, fail-closed** |
| Online payments | **DEFERRED** — no migration on `main` |
| Landing Lab public route | **OFF, fail-closed** |
| Campaign live spend | **OFF, fail-closed** — and not a single env toggle; the live provider transport is deliberately unimplemented |
| Meta WhatsApp webhook / outbound | **OFF, fail-closed** |
| Kriti assistant provider | **OFF, fail-closed** |
| n8n production automation | **DEFERRED** |

Absence of configuration is the OFF state. A gate that is unset is not
misconfigured.

## The public lead contract

One public form — `public-consult-v4` — posting same-origin to
`POST /api/public/lead-intake`. Whether it can submit is decided by the running
server at request time and surfaced through
`GET /api/public/lead-intake/readiness`; the browser never decides. The form
records exactly two consent purposes, `SERVICE_ENQUIRY` and
`SERVICE_COMMUNICATION` (phone), and never infers WhatsApp or marketing consent.

## Architecture in one paragraph

A Next.js modular monolith. App routes and server actions call feature-owned
modules (`contracts` / `domain` / `server` / `components`), which reach Postgres
through canonical Supabase clients whose target is validated once in
`src/lib/supabase/runtime-target.ts`. Authorization is enforced in the database
by RLS and `public.authorize`, so the browser path and the mobile bearer path
share one permission model rather than two. Provider integrations sit behind
adapters that fail closed. See [docs/02-architecture.md](docs/02-architecture.md).

## Local development

```bash
npm ci
cp .env.example .env.local     # then fill in local values
npm run db:start
npm run db:reset
npm run dev
```

Node **24** (`engines` / `.nvmrc`). Local Supabase runs on loopback; the runtime
refuses a non-loopback target outside production and refuses anything but the
managed project inside it.

`.env.example` lists every supported key with its activation semantics, and CI
fails if it drifts from what the code reads.

## Quality gates

| Command | What it checks |
| :--- | :--- |
| `npm run check` | test classification, env contract, lint, typecheck, build |
| `npm run verify:tests` | every test file is classified, so none sits outside CI |
| `npm run verify:env` | source, `src/config/env-contract.ts` and `.env.example` agree |
| `npm run test:app` | the application suite |
| `npm run test:image` | the image pipeline suite |
| `npm run check:db` | database lint + pgTAP against a local reset |

CI runs **Application Quality** (`check`, `test:app`, `test:image`) and
**Database Quality** (`db:reset`, `check:db`). Both are required on `main`.

## Documentation

| Document | Purpose |
| :--- | :--- |
| [docs/00-project-truth.md](docs/00-project-truth.md) | Current truth: repository, managed DB, deployment, activation |
| [docs/02-architecture.md](docs/02-architecture.md) | Architecture as built |
| [docs/05-supabase-data-domains.md](docs/05-supabase-data-domains.md) | Data domains and migration state |
| [docs/06-security-privacy-and-rls.md](docs/06-security-privacy-and-rls.md) | Security model and RLS invariants |
| [docs/11-accelerated-closeout-roadmap.md](docs/11-accelerated-closeout-roadmap.md) | Current hardening lanes |
| [SECURITY.md](SECURITY.md) | Security controls and consent posture |
| [docs/10-decision-register.md](docs/10-decision-register.md) | Decision register |

Older phase documents under `docs/` are preserved audit trail. Where one could
be mistaken for current instruction it carries a HISTORICAL banner; its numbers
are not edited to look current.
