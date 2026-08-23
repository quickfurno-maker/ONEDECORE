# Phase 9D-C2 — Unified Homepage, `/interiors`, and Public Journey

**Status:** `REPOSITORY_IMPLEMENTED`  
**Date:** 2026-08-23  
**Starting protected main:** `34741dac155aad67c1ae9f93bd41a2d7316c9b5a` (PR #82 merge)  
**Branch:** `phase-9d-c2-unified-home`

Phase 9D-C is **IMPLEMENTATION SUBSTANTIALLY COMPLETE / FINAL QA-CLOSEOUT PENDING**. This gate does **not** close 9D-C. Production remains **OFF**.

## 1. Scope

Root `/` as DEC-0093 16-section ~50/50 discovery. Dedicated `/interiors` conversion reuse of R4/R5 planner + `HomeLeadCapture`. Unified public navigation across `/`, `/interiors`, `/shop`. Homepage furniture previews and pincode checker reuse M36 public RPCs via the existing C1 query layer. No new migration. No managed write. No cart, checkout, orders, or payments.

## 2. Managed C1 truth used by C2

- M36 `20260823140000` / `commerce_public_storefront_read_foundation`
- Git blob `81a096f4c31c6003fdcf6e4595c84dfe0e806911`
- Managed **M1–M36**, applied/certified 2026-08-23
- Five public RPCs only; no anon table SELECT
- Current managed published products: **0** (legitimate; featured empty state is required)
- Current managed public categories: **1**

## 3. Implementation notes

- Discovery composition: `src/features/public-site/discovery/DiscoveryHomePage.tsx`
- Interiors composition: `src/features/public-site/interiors/InteriorsConversionPage.tsx` reuses `PlanProvider`, estimator, factory, FAQ, reviews, and `HomePlan` / `HomeLeadCapture`
- Consultation anchor: `/interiors#consultation`
- Kitchen anchor: `/interiors#modular-kitchen`
- About: `/#about` (no standalone `/about` route)
- Read failures render an error, not a fake empty catalogue
- Furniture browse does not call lead intake

## 4. Explicit deferrals

Cart, checkout, orders, payments, customer accounts, wishlist DB, `commerce_service_areas`, new cities, fabricated reviews, production activation, 9D-C formal closeout.
