# PHASE 2E1 & PHASE 2E1A — PORTFOLIO DATA, MEDIA STORAGE & HARDENING AUDIT LOG

**Deployment Date:** July 25, 2026
**Target Project Name:** OneDecore
**Target Project Reference:** `lpurlfmpvriyvpkujvyl`
**Target Region:** Mumbai, India (`ap-south-1`)
**Feature Branch:** `phase-2e1-portfolio-media-foundation`
**Phase 2D2 Redaction Commit:** `89a613a077465fc2666edc7f8a70ebfbca3d88bd`
**Phase 2D2 Merge Commit:** `56bd79f874581f1484ffbde1ee9bca2cbfdd0429`
**Phase 2E1 Migration Version:** `20260725031137`
**Phase 2E1 Migration Filename:** `supabase/migrations/20260725031137_portfolio_media_foundation.sql`
**Phase 2E1 Migration SHA-256:** `5196de49a49c985c21df01c0042f14ebb1fbafe43a54f108e8468ef46b70e229`
**Phase 2E1A Migration Version:** `20260725033329`
**Phase 2E1A Migration Filename:** `supabase/migrations/20260725033329_harden_portfolio_rls_and_audit_privileges.sql`
**Phase 2E1A Migration SHA-256:** `6f0a9fd28f88c4ac58012956cb1bc74f6cf9e30b0efdf88841e0f029e199d59b`

---

## 1. Executive Summary

Phase 2E1 & 2E1A establishes ONEDECORE's core architectural portfolio database schema, system RBAC permissions, two-bucket media storage foundation, and database security hardening. It enforces complete separation between private source media (`portfolio-originals`) and public delivery derivatives (`portfolio-public`), column-level privilege limits rendering audit fields immutable, and optimized RLS policies eliminating all subquery init-plan and multiple permissive policy warnings.

---

## 2. Preflight and Merges

- **Phase 2D2 Redaction Correction:** Corrected owner email redaction domain pattern in [phase-2d2-first-super-admin-bootstrap.md](file:///c:/Users/KESHAV%20SHARMA/Desktop/OneDecore/docs/audits/phase-2d2-first-super-admin-bootstrap.md) (`o***@gmail.com` verified). Commit: `89a613a`.
- **Phase 2D2 Main Merge:** Merged branch `phase-2d2-first-super-admin-bootstrap` into `main` using `--no-ff`. Commit: `56bd79f`.
- **Feature Branch:** Created `phase-2e1-portfolio-media-foundation` from `main`.

---

## 3. Auth Password Security Hardening

- **Leaked Password Protection:** Manually enabled in Supabase Cloud Dashboard under Authentication → Providers → Email → Password security.
- **Verification:** Security Advisor confirmed `auth_leaked_password_protection` warning eliminated. Owner Super Admin account verified active and able to sign in normally.

---

## 4. Column Privilege Hardening & RLS Consolidation (Phase 2E1A)

### Column-Level Privilege Limits
- Revoked broad table-level write access from `public`, `anon`, `authenticated`.
- Granted explicit column-level `INSERT` and `UPDATE` privileges to `authenticated` staff on `portfolio_projects`, `portfolio_project_services`, `portfolio_media`, and `portfolio_media_sources`.
- **Immutability Enforcement:** `id`, `created_by`, `created_at`, `updated_at`, and `uploaded_by` excluded from column-level update grants, guaranteeing audit field immutability at the database engine layer. `portfolio_project_services` updates disallowed (uses `DELETE` + `INSERT`).

### Policy Consolidation & Subquery Optimization
- Replaced overlapping `SELECT` policies with a single consolidated policy per public portfolio table (`anon` publication policy + `authenticated` combined policy).
- Wrapped `(select auth.uid())` and `(select public.authorize(...))` in scalar subqueries across all table and `storage.objects` policies, eliminating all `auth_rls_initplan` performance warnings.

---

## 5. Database Schema & Storage Infrastructure

### System Permissions
- `portfolio.read`: Read Portfolio Content (Mapped to `super_admin`)
- `portfolio.manage`: Manage Portfolio Content (Mapped to `super_admin`)

### Core Application Tables
1. `public.portfolio_projects`: Catalog of luxury interior design projects with slug, title, summary, status (`draft`, `published`, `archived`), and audit metadata.
2. `public.portfolio_project_services`: Junction mapping projects to service codes (`complete_home_interiors`, `modular_kitchens`, `custom_wardrobes`).
3. `public.portfolio_media`: Public web derivative media metadata with width/height, byte size, MIME types, and partial unique index guaranteeing a single active cover image per project.
4. `public.portfolio_media_sources`: Private original photograph metadata table.

### Storage Buckets
1. `portfolio-originals`: Private bucket, 20 MiB file limit, allowed MIME types `image/jpeg`, `image/png`, `image/webp`.
2. `portfolio-public`: Public CDN bucket, 8 MiB file limit, allowed MIME types `image/jpeg`, `image/png`, `image/webp`.

---

## 6. Verification & Test Results

- **pgTAP Tests:** 80 subtests executed across `01_identity_rbac_test.sql` and `02_portfolio_media_test.sql`. 100% passed.
- **Linked DB Lint:** `npx supabase db lint --linked` reported 0 schema errors.
- **Remote Migration Synchronization:** 6 local and remote migrations 1:1 synchronized.
- **Security Advisor:** 100% Clean (0 warnings).
- **Performance Advisor:** 0 `auth_rls_initplan` warnings, 0 `multiple_permissive_policies` warnings.
- **Data Scope:** 0 seeded project rows, 0 uploaded media objects, 1 Auth user.

---

## 7. Next Stage Transition

- **Next Phase:** Phase 2E2 Portfolio CMS & Media Upload Workflow (Admin UI, drag-and-drop, client-side derivative processing).
