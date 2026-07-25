# ONEDECORE — CHANGELOG

All notable changes to the ONEDECORE project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

---

## [Unreleased]

### Added - Phase 2E1 (July 25, 2026)
- Corrected owner email redaction domain pattern in `docs/audits/phase-2d2-first-super-admin-bootstrap.md` (`o***@gmail.com` verified).
- Merged Phase 2D2 active staff authorization & initial Super Admin bootstrap into `main` with non-fast-forward merge (`56bd79f874581f1484ffbde1ee9bca2cbfdd0429`).
- Applied forward-only migration `20260725031137_portfolio_media_foundation.sql` (SHA-256: `5196de49a49c985c21df01c0042f14ebb1fbafe43a54f108e8468ef46b70e229`) to remote project `lpurlfmpvriyvpkujvyl` in Mumbai.
- Created four core portfolio tables: `portfolio_projects`, `portfolio_project_services`, `portfolio_media`, and `portfolio_media_sources`.
- Added system permissions `portfolio.read` and `portfolio.manage`, mapped to active system `super_admin` role.
- Created two Storage buckets: private `portfolio-originals` (20 MiB file limit) and public `portfolio-public` (8 MiB file limit), restricted to JPEG/PNG/WebP.
- Provisioned least-privilege RLS policies on all four portfolio tables and `storage.objects` table.
- Added updated-at triggers, foreign key indexes, check constraints, and partial unique index enforcing single active cover image per project.
- Expanded pgTAP database test suite (`02_portfolio_media_test.sql`) to 70 total subtests verifying publication state filters, audit anti-spoofing, and bucket policies.
- Generated TypeScript types (`src/types/database.generated.ts`) and created typed server repository (`getPublishedProjects`, `getPublishedProjectBySlug`, `getStaffProjects`).

### Added - Phase 2D2 (July 25, 2026)
- Merged Phase 2D1 staff authentication foundation into `main` with non-fast-forward merge (`cf734c692c087646fde618fd19674e79089dc4e9`).
- Applied forward-only active staff authorization hardening migration `20260725020833_enforce_active_staff_authorization.sql` (SHA-256: `193d7780ab27480d27c4b8a350de5804c177e9ff6b0710fcbddf36cf58e1b832`) to remote project `lpurlfmpvriyvpkujvyl` in Mumbai.
- Hardened `private.has_role(text)` and `private.has_permission(text)` database functions to require `public.profiles.status = 'active'`.
- Expanded pgTAP database test suite (`supabase/tests/database/01_identity_rbac_test.sql`) to 44 subtests verifying pending/active/suspended/disabled profile statuses.
- Completed manual owner Auth user creation and guarded one-time operational Super Admin bootstrap in Supabase Dashboard.
- Verified manual end-to-end authentication flow on `http://localhost:3000` (Login, Admin Shell, Sign-Out, Proxy Protection, Generic Invalid Password Error).
- Updated audit log (`docs/audits/phase-2d2-first-super-admin-bootstrap.md`) and governance documentation.

### Added - Phase 2D1 (July 25, 2026)
- Merged Phase 2C identity and RBAC foundation into `main` with non-fast-forward merge.
- Applied forward-only migration `20260725013043_staff_authorization_rpc.sql` (SHA-256: `ead1c5413b097c615188558db76d8ca850982e5eab8ae6a29e8823ffa2237296`) to remote project `lpurlfmpvriyvpkujvyl` in Mumbai.
- Provisioned public `SECURITY INVOKER` authorization RPC wrapper `public.authorize(requested_permission text)` delegating to `private.has_permission()`.
- Implemented staff-only email/password login route (`/auth/login`), Server Action (`loginAction`), and client form with accessible warm-luxury styling.
- Implemented POST-only sign-out handler (`/auth/signout`) returning 405 Method Not Allowed for GET.
- Implemented access forbidden page (`/auth/forbidden`) for authenticated users lacking `admin.access` permission.
- Implemented server-side authorization helpers (`getStaffClaims`, `checkPermission`, `requireStaffPermission`) in `src/server/auth/`.
- Updated Next.js 16 Proxy in `src/lib/supabase/proxy.ts` and `src/proxy.ts` to protect `/admin/:path*` routes using `getClaims()`.
- Implemented minimal internal admin layout (`src/app/admin/layout.tsx`) and dashboard shell (`src/app/admin/page.tsx`) with `force-dynamic` rendering.
- Expanded pgTAP database test suite (`supabase/tests/database/01_identity_rbac_test.sql`) to 37 subtests.
- Updated ADRs (`ADR-0009`, `ADR-0010`) and audit log (`docs/audits/phase-2d1-staff-auth-foundation.md`).

### Added - Phase 2C3 (July 24, 2026)
- Applied forward-only hardening migration `20260724192233_secure_rls_event_trigger_and_index_assignment_actor.sql` (SHA-256: `3ef8512a50a26610d8ee2960661dcf21f8bf8a0142064fea0bd02e75ba0c4c1b`) to remote project `lpurlfmpvriyvpkujvyl` in Mumbai.
- Revoked direct `EXECUTE` privileges on platform helper `public.rls_auto_enable()` from `public`, `anon`, and `authenticated` while retaining active `ensure_rls` event trigger owned by `postgres`.
- Added covering index `idx_user_roles_assigned_by` on `public.user_roles(assigned_by)`.
- Expanded pgTAP database test suite (`supabase/tests/database/01_identity_rbac_test.sql`) to 27 subtests.
- Verified Security Advisor and Performance Advisor findings resolved with zero schema drift and 0 business data/user mutations.

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
