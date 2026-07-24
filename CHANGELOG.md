# ONEDECORE — CHANGELOG

All notable changes to the ONEDECORE project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

---

## [Unreleased]

### Added - Phase 2C2 (July 24, 2026)
- Applied reviewed migration `20260724174648_identity_rbac_foundation.sql` (SHA-256: `a19dc6d497401b6cdd1df7bee6f8c5bc1e5f1aa354135debebfab4a659e1a9dd`) to remote Supabase project `lpurlfmpvriyvpkujvyl` in Mumbai (`ap-south-1`).
- Verified 1:1 local and remote migration history match via `npx supabase migration list`.
- Executed linked database linting (`npx supabase db lint --linked --level warning`) with 0 schema errors.
- Verified remote TypeScript type generation matching local database type contract.
- Verified remote object inventory (1 private schema, 5 public tables, 6 system roles, 6 system permissions, 100% RLS coverage, 0 Auth users, 0 Storage buckets, 0 business tables).

### Added - Phase 2C1 (July 24, 2026)
- Hardened foundation migration `20260724174648_identity_rbac_foundation.sql`:
  - Removed `IF NOT EXISTS` from schema, table, and index DDL to fail loudly on unexpected schema drift.
  - Added explicit `REVOKE ALL ON TABLE ... FROM public, anon, authenticated` before least-privilege grants.
  - Configured strict column-level write privileges for `profiles`, `roles`, `permissions`, and `user_roles`.
  - Enforced system RBAC record immutability (`is_system = true`) via RLS policies.
  - Restricted `user_roles` assignment attribution (`assigned_by = auth.uid()`).
  - Added display name metadata normalization (max 120 chars) in `private.handle_new_auth_user()`.
  - Removed `SECURITY DEFINER` from `private.set_updated_at()`.
- Expanded pgTAP database test suite (`01_identity_rbac_test.sql`) to 19 subtests.
- Established Shared-Docker Desktop policy with strict project isolation and zero global prune commands.
- Regenerated TypeScript types (`src/types/database.generated.ts`).

### Added - Phase 2C (July 24, 2026)
- Installed `supabase@2.109.1` devDependency and initialized local CLI configuration (`supabase/config.toml`).
- Created identity & RBAC migration `20260724174648_identity_rbac_foundation.sql` (`private` schema, `profiles`, `roles`, `permissions`, `role_permissions`, `user_roles`).
- Implemented `private.has_role()` and `private.has_permission()` security-definer helper functions.
- Seeded 6 foundation roles and 6 permissions with role-permission mappings.
- Configured 100% RLS policies and revoked table privileges from `anon`.
- Created pgTAP database tests (`supabase/tests/database/01_identity_rbac_test.sql`).
- Added package scripts (`db:start`, `db:stop`, `db:reset`, `db:lint`, `db:test`, `check:db`).
- Generated typed database interfaces (`src/types/database.generated.ts`) and updated Supabase client wrappers.
- Created ADRs `ADR-0007` and `ADR-0008` and audit log `docs/audits/phase-2c-identity-rbac-foundation.md`.

### Added - Phase 2B (July 24, 2026)
- Connected Next.js App Router to Mumbai Supabase project (`lpurlfmpvriyvpkujvyl.supabase.co`).
- Installed `@supabase/supabase-js@2.110.8` and `@supabase/ssr@0.12.3`.
- Created browser-safe environment validator `src/config/env.ts` requiring HTTPS and `sb_publishable_` prefix.
- Built ONEDECORE client wrappers (`src/lib/supabase/client.ts`, `src/lib/supabase/server.ts`, `src/lib/supabase/proxy.ts`).
- Configured Next.js 16 Proxy in `src/proxy.ts` matched to `/admin/:path*` and `/auth/:path*`.
- Created audit log `docs/audits/phase-2b-supabase-ssr-foundation.md`.

### Added - Phase 2A (July 24, 2026)
- Scaffolded Next.js 16.2.11 with TypeScript, ESLint, and Tailwind CSS v4 in `src/` directory.
- Established Node.js 24 LTS and npm 11.16.0 engine contracts (`.nvmrc`, `.node-version`, `.npmrc`).
- Added package quality scripts (`dev`, `build`, `start`, `lint`, `typecheck`, `check`).
- Added `.env.example` with Supabase key placeholders and security guidance.
- Created minimal application shell (`layout.tsx`, `page.tsx`, `globals.css`, `error.tsx`, `not-found.tsx`).
- Created audit log `docs/audits/phase-2a-engineering-scaffold.md`.

### Added - Phase 1C (July 24, 2026)
- Established formal repository governance documentation baseline in `docs/`.
- Created Architecture Decision Records (`ADR-0001` through `ADR-0006`).
- Created baseline audits (`phase-1a-baseline-audit.md` and `phase-1b-owner-review.md`).
- Added workspace governance files (`.editorconfig`, `.gitignore`, `README.md`, `CHANGELOG.md`, `CONTRIBUTING.md`, `SECURITY.md`).
- Formally recorded mandatory corrections (Next.js 16.x release targeting, Supabase-before-n8n lead persistence, Meta webhook verified endpoint, `/admin` route prefix, private portfolio master storage vs public optimized derivatives).
- Initialized local Git repository on branch `main` with baseline commit.

---

## [0.1.0-phase1b] - 2026-07-24

### Added
- Completed Phase 1B Architecture Freeze and decision matrix.
- Defined locked product scope, sitemap, homepage information architecture, portfolio lifecycle, Supabase data domains, CRM pipeline, and n8n boundaries.

---

## [0.0.1-phase1a] - 2026-07-24

### Added
- Completed Phase 1A read-only baseline audit confirming empty directory state and zero external project contamination.
