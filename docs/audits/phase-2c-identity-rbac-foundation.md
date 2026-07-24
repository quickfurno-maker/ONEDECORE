# PHASE 2C1 — HARDENED IDENTITY & RBAC FOUNDATION AUDIT LOG

**Execution Date:** July 24, 2026  
**Phase 2B Merge Commit:** `eb69f015ed915814d3f718c3014eb9d281082086`  
**Phase 2C Base Commit:** `98bd22c4b62f0ed3cb1d6d0749613414f07ed457`
**Current Feature Branch:** `phase-2c-identity-rbac-foundation`
**CLI Version:** `2.109.1`
**Docker Engine:** Shared Docker Desktop 4.82.0 (Engine 29.6.1) with strict ONEDECORE project isolation
**Migration Path:** `supabase/migrations/20260724174648_identity_rbac_foundation.sql`
**Migration SHA-256:** `a19dc6d497401b6cdd1df7bee6f8c5bc1e5f1aa354135debebfab4a659e1a9dd`
**Generated Types Path:** `src/types/database.generated.ts`

---

## 1. Migration Hardening Summary

- **Schema Drift Protection:** Removed `IF NOT EXISTS` from schema, table, and index DDL to ensure immediate failure on unexpected schema drift.
- **Explicit Privilege Reset:** Executed `REVOKE ALL ON TABLE ... FROM public, anon, authenticated` before granting least-privilege permissions.
- **Column-Level Write Privileges:**
  - `profiles`: Table-level `SELECT`, column-level `UPDATE` on (`display_name`, `phone_e164`, `status`).
  - `roles` & `permissions`: Table-level `SELECT`, column-level `INSERT` on (`code`, `name`, `description`, `is_active`), column-level `UPDATE` on (`name`, `description`, `is_active`).
  - `role_permissions`: Table-level `SELECT`, `INSERT`, `DELETE`.
  - `user_roles`: Table-level `SELECT`, `DELETE`, column-level `INSERT` on (`user_id`, `role_id`).
- **System RBAC Record Protection:**
  - `roles.is_system` & `permissions.is_system` default `false`. Seeded foundation records set `is_system = true`.
  - RLS policies restrict `INSERT`/`UPDATE` on `roles` and `permissions` to `is_system = false`.
  - `role_permissions` RLS policies restrict custom mapping changes to `is_system = false` roles.
- **Attribution & Metadata Safety:**
  - `user_roles.assigned_by` defaults to `auth.uid()`. Callers cannot forge attribution due to column-limited inserts.
  - `private.handle_new_auth_user()` normalizes display names to at most 120 characters without failing user signup.
- **Function Privilege Minimization:**
  - `private.set_updated_at()` removed `SECURITY DEFINER`.
  - `REVOKE ALL ON SCHEMA private FROM public;` applied. Direct execution of triggers revoked from `public`, `anon`, `authenticated`.

---

## 2. Shared Docker Isolation

- Executed strictly within `C:\Users\KESHAV SHARMA\Desktop\OneDecore` working directory.
- `project_id = "OneDecore"` isolated from Jarvis (`qf-jarvis-postgres-dev`) and QuickFurno containers.
- Zero global prune commands executed.

---

## 3. Database & Application Quality Gate Results

- `npx supabase db reset`: Clean replay from empty local database.
- `npm run db:lint`: 0 schema errors found (`supabase db lint --local --level warning`).
- `npm run db:test`: 19 pgTAP subtests passed (`supabase test db`).
- `npm run check:db`: Combined database gate passed cleanly.
- `npm run check`: Next.js lint, TypeScript check (`tsc --noEmit`), and Turbopack build passed cleanly.
- `git diff --check`: Passed with 0 whitespace errors.
