# PHASE 2E1 — PORTFOLIO DATA & MEDIA STORAGE FOUNDATION AUDIT LOG

**Deployment Date:** July 25, 2026
**Target Project Name:** OneDecore
**Target Project Reference:** `lpurlfmpvriyvpkujvyl`
**Target Region:** Mumbai, India (`ap-south-1`)
**Feature Branch:** `phase-2e1-portfolio-media-foundation`
**Phase 2D2 Redaction Commit:** `89a613a077465fc2666edc7f8a70ebfbca3d88bd`
**Phase 2D2 Merge Commit:** `56bd79f874581f1484ffbde1ee9bca2cbfdd0429`
**Applied Migration Version:** `20260725031137`
**Applied Migration Filename:** `supabase/migrations/20260725031137_portfolio_media_foundation.sql`
**Migration SHA-256:** `5196de49a49c985c21df01c0042f14ebb1fbafe43a54f108e8468ef46b70e229`

---

## 1. Executive Summary

Phase 2E1 establishes ONEDECORE's core architectural portfolio database schema, system RBAC permissions, and two-bucket media storage foundation. It enforces complete separation between private source media (`portfolio-originals`) and public delivery derivatives (`portfolio-public`), with database-level RLS policies and audit anti-spoofing constraints.

---

## 2. Preflight and Merges

- **Phase 2D2 Redaction Correction:** Corrected owner email redaction domain pattern in [phase-2d2-first-super-admin-bootstrap.md](file:///c:/Users/KESHAV%20SHARMA/Desktop/OneDecore/docs/audits/phase-2d2-first-super-admin-bootstrap.md) (`o***@gmail.com` verified). Commit: `89a613a`.
- **Phase 2D2 Main Merge:** Merged branch `phase-2d2-first-super-admin-bootstrap` into `main` using `--no-ff`. Commit: `56bd79f`.
- **Feature Branch:** Created `phase-2e1-portfolio-media-foundation` from `main`.

---

## 3. Database Schema & Infrastructure

### System Permissions Added
- `portfolio.read`: Read Portfolio Content (Mapped to `super_admin`)
- `portfolio.manage`: Manage Portfolio Content (Mapped to `super_admin`)

### Four Core Application Tables Created
1. `public.portfolio_projects`: Catalog of luxury interior design projects with slug, title, summary, status (`draft`, `published`, `archived`), and audit metadata.
2. `public.portfolio_project_services`: Junction table mapping projects to normalized service codes (`complete_home_interiors`, `modular_kitchens`, `custom_wardrobes`).
3. `public.portfolio_media`: Public web-ready derivative media metadata with width/height, byte size, MIME types, and partial unique index guaranteeing a single active cover image per project.
4. `public.portfolio_media_sources`: Private original photograph metadata linked 1:1 with media rows, containing original object paths, byte size, and optional SHA-256 checksums.

### Storage Buckets Configured
1. `portfolio-originals`: Private bucket, 20 MiB file limit, allowed MIME types `image/jpeg`, `image/png`, `image/webp`.
2. `portfolio-public`: Public CDN bucket, 8 MiB file limit, allowed MIME types `image/jpeg`, `image/png`, `image/webp`.

---

## 4. Security & Access Control

- **RLS Status:** 100% enabled across all four portfolio tables and `storage.objects`.
- **Table Privileges:** Revoked default privileges from `public`, `anon`, and `authenticated`. Explicit `SELECT` granted to public on non-sensitive metadata tables; `INSERT`, `UPDATE`, `DELETE` restricted to authenticated staff.
- **Audit Anti-Spoofing:** RLS `WITH CHECK` clauses enforce `created_by = auth.uid()`, `updated_by = auth.uid()`, and `uploaded_by = auth.uid()`.
- **Anonymous Privacy:** Draft projects and non-ready media remain completely hidden from anonymous visitors. `portfolio_media_sources` is inaccessible to non-staff.

---

## 5. Verification & Test Results

- **pgTAP Tests:** 70 subtests executed across `01_identity_rbac_test.sql` and `02_portfolio_media_test.sql`. 100% passed.
- **Linked DB Lint:** `npx supabase db lint --linked` reported 0 schema errors.
- **Remote Migration Synchronization:** 5 local and remote migrations 1:1 synchronized.
- **TypeScript & Build:** `npm run check` (`eslint`, `tsc`, `next build`) passed cleanly.
- **Data Scope:** 0 seeded project rows, 0 uploaded media objects.

---

## 6. Next Stage Transition

- **Next Phase:** Phase 2E2 Portfolio CMS & Media Upload Workflow (Admin UI, drag-and-drop, client-side derivative processing).
