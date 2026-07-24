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
