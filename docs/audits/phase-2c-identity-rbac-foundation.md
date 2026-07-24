# PHASE 2C2 — CONTROLLED REMOTE IDENTITY & RBAC MIGRATION DEPLOYMENT AUDIT LOG

**Deployment Date:** July 24, 2026
**Target Project Name:** OneDecore
**Target Project Reference:** `lpurlfmpvriyvpkujvyl`
**Target Region:** Mumbai, India (`ap-south-1`)
**Feature Branch:** `phase-2c-identity-rbac-foundation`
**Base Phase 2C1 Commit:** `9a6c66942145eb56d094b8e817d8b47310e1cfe2`
**Applied Migration Version:** `20260724174648`
**Applied Migration Filename:** `supabase/migrations/20260724174648_identity_rbac_foundation.sql`
**Migration SHA-256:** `a19dc6d497401b6cdd1df7bee6f8c5bc1e5f1aa354135debebfab4a659e1a9dd`

---

## 1. Executive Deployment Summary

Phase 2C2 represents the first authorized remote database mutation for ONEDECORE. The reviewed identity and RBAC foundation migration (`20260724174648_identity_rbac_foundation.sql`) was deployed to the empty remote Supabase project in Mumbai via the official interactive CLI pipeline following explicit owner confirmation.

- **Migration Dry Run:** `npx supabase db push --dry-run` passed cleanly with 0 dry-run mismatches.
- **Owner Confirmation:** Explicit local session confirmation recorded prior to remote execution (`lpurlfmpvriyvpkujvyl` in Mumbai).
- **Remote Push:** `npx supabase db push` executed successfully.
- **Migration History Verification:** `npx supabase migration list` confirmed 1:1 local and remote history match at `20260724174648`.
- **Linked Database Lint:** `npx supabase db lint --linked --level warning` reported 0 schema errors or security warnings.
- **Remote Type Comparison:** Generated remote TypeScript interfaces matched local generated types with zero structural schema drift.

---

## 2. Remote Database Object Inventory

1. **Schemas:**
   - `private` — Internal security schema for security functions and triggers; non-exposed.
2. **Public Application Tables (5):**
   - `public.profiles` (Staff profiles linked 1:1 to `auth.users`).
   - `public.roles` (System & custom RBAC roles).
   - `public.permissions` (Granular feature permissions).
   - `public.role_permissions` (Role-permission mappings).
   - `public.user_roles` (Staff user role assignments).
3. **Private Functions & Triggers (4 Functions / 4 Triggers):**
   - `private.set_updated_at()` — Trigger function auto-updating `updated_at` timestamps (non-security definer).
   - `private.handle_new_auth_user()` — Trigger function normalizing `raw_user_meta_data` (max 120 chars) and inserting `public.profiles(id)` for new auth users (`SECURITY DEFINER`, `set search_path = ''`).
   - `private.has_role(text)` — `SECURITY DEFINER` function checking user role membership (`set search_path = ''`).
   - `private.has_permission(text)` — `SECURITY DEFINER` function checking user permission grants (`set search_path = ''`).
4. **Indexes (2):**
   - `idx_user_roles_role_id` on `public.user_roles(role_id)`.
   - `idx_role_permissions_permission_id` on `public.role_permissions(permission_id)`.
5. **Seeded System Data:**
   - **6 System Roles (`is_system = true`):** `super_admin`, `management`, `sales`, `designer`, `project_operations`, `content_manager`.
   - **6 System Permissions (`is_system = true`):** `admin.access`, `users.read`, `users.manage`, `roles.read`, `roles.manage`, `audit.read`.
   - **Foundation Mappings:** System role permission mappings seeded without custom role grants.

---

## 3. Remote Security, RLS & Scope Guarantees

- **RLS Coverage:** Enabled on 100% of public identity tables (`profiles`, `roles`, `permissions`, `role_permissions`, `user_roles`).
- **Anonymous Access:** Revoked from all tables (`REVOKE ALL ON TABLE ... FROM anon`); 0 policies created for `anon`.
- **System RBAC Immutability:** Seeded records protected against Data API insertion, modification, or deletion.
- **Attribution Protection:** `user_roles.assigned_by` defaults to `auth.uid()` and cannot be forged.
- **Zero Business Domain Objects:** 0 Portfolio tables, 0 CRM tables, 0 Quotation tables, 0 WhatsApp tables, 0 Storage buckets, 0 Edge Functions deployed.
- **Zero User State:** 0 Auth users created; 0 user role assignments created (`user_roles` count = 0).
- **Credentials & Isolation:** 0 secrets, access tokens, or database passwords committed or stored in tracked files.

---

## 4. Phase Deferrals

- **Phase 2D:** Auth login UI (`/login`), admin route protection middleware (`/admin/*`), and first Super Admin user bootstrap.
- **Phase 2E:** Portfolio database schema, room tags, case-study models, and Supabase Storage bucket policies.

---

## 5. Phase 2C3 — Remote RBAC Post-Deployment Hardening

**Hardening Date:** July 24, 2026
**Applied Migration Version:** `20260724192233`
**Applied Migration Filename:** `supabase/migrations/20260724192233_secure_rls_event_trigger_and_index_assignment_actor.sql`
**Migration SHA-256:** `3ef8512a50a26610d8ee2960661dcf21f8bf8a0142064fea0bd02e75ba0c4c1b`

### 5.1 Advisor Findings & Root Cause Analysis
- **Security Advisor Finding:** `public.rls_auto_enable()` is a `SECURITY DEFINER` event-trigger function executable by `public`, `anon`, and `authenticated`. Root cause: Supabase platform auto-RLS helper inherited default public function execution privileges upon project provisioning.
- **Performance Advisor Finding:** Foreign key `public.user_roles.assigned_by` lacked a covering index, risking sequential scans during actor-based role lookup and audit queries.

### 5.2 Remediation & Validation Pipeline
1. **Forward-Only Migration:** Created `20260724192233_secure_rls_event_trigger_and_index_assignment_actor.sql` revoking `EXECUTE ON FUNCTION public.rls_auto_enable()` from `public, anon, authenticated` and creating index `idx_user_roles_assigned_by`.
2. **Local Replay & pgTAP Suite:** Executed `npx supabase db reset` cleanly from scratch. Expanded pgTAP suite (`supabase/tests/database/01_identity_rbac_test.sql`) to 27 subtests verifying `rls_auto_enable()` existence, `SECURITY DEFINER` flag, `search_path = pg_catalog`, `ensure_rls` event trigger active status, revoked privileges, and `idx_user_roles_assigned_by` index presence.
3. **Remote Dry Run:** `npx supabase db push --dry-run` confirmed exactly 1 pending migration with zero modifications to applied migration `20260724174648`.
4. **Owner Confirmation:** Explicit approval requested and granted prior to remote execution.
5. **Remote Push & Linked Verification:** Executed `npx supabase db push` successfully. Verified `npx supabase migration list` shows 1:1 match across both migrations (`20260724174648` and `20260724192233`). Linked database lint (`npx supabase db lint --linked`) reported 0 schema errors.

### 5.3 Post-Hardening Status & Non-Blocking Notices
- **Security Advisor Status:** 100% accepted. 0 warnings for direct API execution of `rls_auto_enable()`.
- **Performance Advisor Status:** Foreign key warning cleared. `idx_user_roles_assigned_by` confirmed online.
- **Allowed Non-Blocking INFO Notices:** Unused indexes reported on zero-row empty database; Auth DB connection allocation strategy notice.
- **Zero Business Domain Mutation:** 0 Auth users created, 0 user-role assignments created, 0 storage buckets created, 0 business tables added.
