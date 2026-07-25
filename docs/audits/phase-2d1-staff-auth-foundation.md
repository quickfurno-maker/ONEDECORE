# PHASE 2D1 — STAFF AUTHENTICATION & AUTHORIZATION FOUNDATION AUDIT LOG

**Deployment Date:** July 25, 2026  
**Target Project Name:** OneDecore  
**Target Project Reference:** `lpurlfmpvriyvpkujvyl`  
**Target Region:** Mumbai, India (`ap-south-1`)  
**Feature Branch:** `phase-2d-staff-auth-foundation`  
**Base Phase 2C Commit:** `4ee156251c38e71978572e11584cb7ee22c247b3`  
**Applied Migration Version:** `20260725013043`  
**Applied Migration Filename:** `supabase/migrations/20260725013043_staff_authorization_rpc.sql`  
**Migration SHA-256:** `ead1c5413b097c615188558db76d8ca850982e5eab8ae6a29e8823ffa2237296`  

---

## 1. Executive Deployment Summary

Phase 2D1 establishes ONEDECORE's staff-only authentication and authorization foundation. It merges Phase 2C cleanly into `main`, provisions a public `SECURITY INVOKER` authorization RPC wrapper (`public.authorize(text)`), and implements a staff login flow (`/auth/login`), POST-only sign-out (`/auth/signout`), Next.js 16 Proxy session authentication guard, and server-side permission enforcement in `/admin/layout.tsx`.

- **Phase 2C Merge:** Merged `phase-2c-identity-rbac-foundation` into `main` with non-fast-forward commit `merge: complete ONEDECORE phase 2C`. Created branch `phase-2d-staff-auth-foundation`.
- **Public Authorization RPC:** Deployed `public.authorize(text)` (`SECURITY INVOKER`, `STABLE`, `SET search_path = ''`), delegating permission evaluation to `private.has_permission(text)`. Revoked execution from `public` and `anon`; granted execution to `authenticated`.
- **Local Replay & pgTAP Suite:** Executed `npx supabase db reset` cleanly from scratch. Extended pgTAP test suite (`supabase/tests/database/01_identity_rbac_test.sql`) to 37 subtests verifying RPC signature, `SECURITY INVOKER` property, empty search path, execution grants, unauthenticated/authenticated evaluation, and role status checks.
- **Remote Dry Run:** `npx supabase db push --dry-run` confirmed exactly 1 pending migration with zero modifications to prior migrations (`20260724174648` & `20260724192233`).
- **Owner Confirmation:** Explicit approval requested and granted prior to remote deployment.
- **Remote Push & Verification:** `npx supabase db push` applied migration `20260725013043` cleanly. `npx supabase migration list` confirmed 1:1 local and remote history match across all 3 migrations. Linked database lint (`npx supabase db lint --linked`) reported 0 schema errors.
- **Live Remote Login Deferral:** Live remote login remains deferred because Auth users in remote project `lpurlfmpvriyvpkujvyl` remain at zero.

---

## 2. Component Implementation Details

1. **Database Authorization RPC (`public.authorize(text)`):**
   - Signature: `public.authorize(requested_permission text) RETURNS boolean`
   - Properties: `SECURITY INVOKER`, `STABLE`, `SET search_path = ''`
   - Grants: `REVOKE EXECUTE FROM public, anon; GRANT EXECUTE TO authenticated;`
2. **Staff Login Route (`/auth/login`):**
   - Email/password authentication via `signInWithPassword`
   - No public sign-up path, password recovery, OAuth, or MFA buttons
   - Generic error messages to prevent account enumeration
   - Safe `next` parameter validation (strictly restricted to `/admin` paths)
3. **Sign-out Route (`/auth/signout`):**
   - Route handler accepting `POST` requests only (returns 405 Method Not Allowed for GET)
   - Invokes `supabase.auth.signOut()` and redirects to `/auth/login` with 303 See Other
4. **Next.js 16 Proxy Session Guard (`src/lib/supabase/proxy.ts` & `src/proxy.ts`):**
   - Matched against `/admin/:path*` and `/auth/:path*`
   - Calls `supabase.auth.getClaims()` immediately after client creation
   - Refreshes session cookies and preserves cookies on redirect responses
   - Redirects unauthenticated `/admin` requests to `/auth/login?next=...`
5. **Admin Server Layout (`src/app/admin/layout.tsx`):**
   - Enforces `export const dynamic = "force-dynamic";`
   - Calls `requireStaffPermission("admin.access")` before rendering children
   - Displays staff identity email and POST sign-out form
6. **Admin Shell Page (`src/app/admin/page.tsx`):**
   - Displays minimal internal dashboard shell with warm-luxury ONEDECORE branding
   - Placeholders for Phase 5 Portfolio CMS, Phase 7 Lead CRM, and Phase 8 Quotation Engine

---

## 3. Remote Security, RLS & Scope Guarantees

- **RLS Coverage:** 100% RLS coverage maintained on all 5 identity tables (`profiles`, `roles`, `permissions`, `role_permissions`, `user_roles`).
- **Security Advisor Status:** 0 warnings. `public.authorize` is `SECURITY INVOKER` and revoked from `anon`.
- **Zero Business Domain Mutation:** 0 Auth users created, 0 user-role assignments created, 0 storage buckets created, 0 business tables added.
- **Credentials & Isolation:** 0 secrets, access tokens, or database passwords committed or stored in tracked files.

---

## 4. Phase Deferrals

- **Phase 2D2 / 2D3:** First Super Admin user bootstrap script (`bootstrap:super-admin`) and authenticated staff workflow validation.
- **Phase 2E:** Portfolio database schema, room tags, case-study models, and Supabase Storage bucket policies.
