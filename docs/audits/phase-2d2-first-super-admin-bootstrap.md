# PHASE 2D2 — ACTIVE STAFF ENFORCEMENT & FIRST SUPER ADMIN BOOTSTRAP AUDIT LOG

**Deployment Date:** July 25, 2026
**Target Project Name:** OneDecore
**Target Project Reference:** `lpurlfmpvriyvpkujvyl`
**Target Region:** Mumbai, India (`ap-south-1`)
**Feature Branch:** `phase-2d2-first-super-admin-bootstrap`
**Phase 2D1 Merge Commit:** `6682871f75545ba4fd629185a56a61a0280361b1`
**Applied Migration Version:** `20260725020833`
**Applied Migration Filename:** `supabase/migrations/20260725020833_enforce_active_staff_authorization.sql`
**Migration SHA-256:** `193d7780ab27480d27c4b8a350de5804c177e9ff6b0710fcbddf36cf58e1b832`

---

## 1. Executive Summary

Phase 2D2 enforces active staff profile status requirements (`status = 'active'`) in database authorization functions and completes the guarded bootstrap of ONEDECORE's initial owner Super Admin user.

- **Phase 2D1 Merge:** Merged `phase-2d-staff-auth-foundation` into `main` with commit `merge: complete ONEDECORE phase 2D1` (`6682871f75545ba4fd629185a56a61a0280361b1`). Created branch `phase-2d2-first-super-admin-bootstrap`.
- **Active Staff Authorization Hardening:** Deployed migration `20260725020833_enforce_active_staff_authorization.sql` updating `private.has_role(text)` and `private.has_permission(text)` to require `public.profiles.status = 'active'`. Preserved `STABLE`, `SECURITY DEFINER`, and `SET search_path = ''` properties.
- **Local Replay & pgTAP Suite:** Executed `npx supabase db reset` cleanly from scratch. Expanded pgTAP test suite (`supabase/tests/database/01_identity_rbac_test.sql`) to 44 subtests verifying pending/active/suspended/disabled profile statuses, inactive roles, inactive permissions, and `public.authorize` integration.
- **Remote Dry Run & Owner Approval:** `npx supabase db push --dry-run` confirmed exactly 1 pending migration. Explicit owner approval requested and granted.
- **Remote Push & Advisors:** `npx supabase db push` applied migration `20260725020833` cleanly. `npx supabase migration list` confirmed 1:1 local and remote history match across all 4 migrations. Linked database lint (`npx supabase db lint --linked`) reported 0 schema errors. Security Advisor reported 0 warnings.
- **Manual Owner User Creation:** Owner created exactly 1 confirmed Auth user directly in Supabase Dashboard (`Authentication -> Users`).
- **Guarded Super Admin Bootstrap:** Owner executed the guarded one-time bootstrap SQL block in Supabase Dashboard SQL Editor, activating the owner profile (`status = 'active'`) and assigning the system `super_admin` role (`assigned_by = user_id`).
- **Manual E2E Testing:** Owner manually tested login (`/auth/login`), admin shell rendering (`/admin`), POST sign-out (`/auth/signout`), proxy route guard, and generic invalid credential error handling on `http://localhost:3000`. All 8 manual test steps succeeded 100%.

---

## 2. Redacted Bootstrap Evidence

- **Auth Users Count:** 1 (Confirmed)
- **Profiles Count:** 1 (Status: `active`)
- **User Role Assignments:** 1 (Assigned Role: `super_admin`, `assigned_by` self-assigned)
- **Owner Email Identity:** Redacted for security (`o***@gmail.com` verified)
- **Password & Secret Storage:** 0 passwords, secret keys, or raw JWT tokens stored in Git or application code.

---

## 3. Database Function Security Contracts

| Function | Type | Security Contract | Status Requirement |
| :--- | :--- | :--- | :--- |
| `private.has_role(text)` | PL/pgSQL Function | `STABLE SECURITY DEFINER SET search_path = ''` | `profiles.status = 'active'` |
| `private.has_permission(text)` | PL/pgSQL Function | `STABLE SECURITY DEFINER SET search_path = ''` | `profiles.status = 'active'` |
| `public.authorize(text)` | SQL Wrapper | `STABLE SECURITY INVOKER SET search_path = ''` | Delegates to `private.has_permission` |

---

## 4. Next Stage Transition

- **Phase 2D2 Status:** Phase 2D2 Complete
- **Next Stage:** Phase 2E Portfolio and Media Foundation
