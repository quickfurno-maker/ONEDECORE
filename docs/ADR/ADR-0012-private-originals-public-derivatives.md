# ADR-0012: Two-Bucket Media Architecture (Private Originals & Public Derivatives)

**Status:** Approved  
**Date:** July 25, 2026  
**Context:** Phase 2E1 Portfolio Data & Media Storage Foundation  

## Context & Problem Statement

High-resolution original photographs uploaded by interior design staff contain raw camera metadata, large byte payloads (up to 20 MiB), and potentially sensitive client spatial details. Public delivery requires web-optimized image formats (WebP/JPEG, capped at 8 MiB) without exposing original source object paths or risking unexpected cloud image transformation costs.

## Decision Drivers

1. Zero exposure of raw uploaded photographs or original filenames to public visitors.
2. Predictable storage architecture avoiding paid on-demand image transformation dependencies.
3. Strict least-privilege storage security policies enforced at the storage engine layer.
4. Clean separation between master archive media and public web assets.

## Considered Options

1. **Option A: Single public bucket** (Store both raw uploads and web images in one public storage bucket).
2. **Option B (Chosen): Two-bucket architecture with discrete metadata tables**.

## Decision Outcome

Chosen Option: **Option B**.

### Bucket & Table Breakdown
1. **`portfolio-originals` (Private Bucket):**
   - Stores raw uploaded master images (up to 20 MiB).
   - Restricted strictly to staff with `portfolio.manage` permission.
   - Metadata recorded in `public.portfolio_media_sources`.
2. **`portfolio-public` (Public Bucket):**
   - Stores web-optimized derivative images (cover-1600.webp, gallery-1200.webp, thumb-480.webp, capped at 8 MiB).
   - Direct CDN read allowed for public derivatives. Writes restricted to staff with `portfolio.manage`.
   - Metadata recorded in `public.portfolio_media`.

## Object Naming Convention
- Original: `<project_id>/<media_id>/original.<ext>`
- Public Derivatives: `<project_id>/<media_id>/<role>-<width>.webp`

## Consequences

- **Positive:** Master files remain 100% private. Derivative filenames use generated UUIDs, eliminating sensitive filename leakage.
- **Negative:** Upload workflows require producing web derivatives prior to public display; handled seamlessly by client-side or server pipeline in Phase 2E2.
