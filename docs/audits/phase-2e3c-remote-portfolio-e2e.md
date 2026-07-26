# ONEDECORE Phase 2E3C — Remote Portfolio E2E Audit

**Status:** Verified & Clean (`PHASE_2E3C_REMOTE_E2E_CLEAN`)  
**Branch:** `phase-2e3-public-portfolio-experience`  
**Architecture Commit:** `4dee9a02eaab02e635ecd0be39d9b254e57831a5`  
**Official Supabase Project:** `lpurlfmpvriyvpkujvyl` (Mumbai, ap-south-1)  
**Official Domain:** `https://onedecore.in`  
**Migrations:** 8 (no mutation)

---

## 1. Executive Summary

Phase 2E3C executed a controlled remote end-to-end workflow against the official Supabase project and live CMS. The test proved real Admin CMS creation, authenticated image upload, exact WebP derivative generation, publish-without-rebuild cache invalidation, metadata/JSON-LD propagation, edit and media deletion invalidation, and unpublish true HTTP 404 behaviour. All temporary rows and storage objects were deleted; remote zero-state was restored.

---

## 2. E2E Workflow Results

| Step | Result |
| :--- | :---: |
| Draft isolation (true HTTP 404; absent from homepage/listing/sitemap) | Pass |
| Real CMS image upload via `/api/admin/portfolio/media` | Pass |
| Exact WebP derivatives (`cover-1600.webp`, `gallery-1200.webp`, `thumb-480.webp`) | Pass |
| Publish without rebuild (cache invalidation) | Pass |
| Homepage/list/detail cache invalidation | Pass |
| Metadata and JSON-LD on live detail page | Pass |
| Edit invalidation (summary update without rebuild) | Pass |
| Media deletion invalidation | Pass |
| Unpublish true HTTP 404 | Pass |
| Full project delete via CMS | Pass |
| Cleanup of all temporary rows and objects | Pass |
| Remote zero-state restored | Pass |

**Note:** `is_featured` is edit-form only; homepage featured verification required an explicit metadata save after initial publish.

---

## 3. Remote Baseline (Read-Only, Post-Cleanup)

| Metric | Value |
| :--- | :---: |
| Migrations | 8 |
| Security Advisor warnings | 0 |
| Portfolio projects | 0 |
| Portfolio project services | 0 |
| Portfolio media | 0 |
| Portfolio media sources | 0 |
| Portfolio storage objects | 0 |
| Portfolio buckets | 2 (`portfolio-originals`, `portfolio-public`) |
| Portfolio storage policies | 8 |

No remote data mutation was performed during Phase 2E3D closeout verification.

---

## 4. Environment Cleanup

- `.env.production.local` removed (private E2E residue)
- Temporary E2E scripts and assets removed from ignored handoff folder
- Servers on ports 3100 and 3199 stopped
- No Git remote created; no push performed

---

## 5. Related Documents

- [Phase 2E3B Local Implementation Audit](phase-2e3b-public-portfolio-local-implementation.md)
- [ADR-0016: Public Portfolio Data Delivery](../ADR/ADR-0016-public-portfolio-data-delivery.md)
- [ADR-0017: Public Portfolio Cache & Revalidation](../ADR/ADR-0017-public-portfolio-cache-and-revalidation.md)
