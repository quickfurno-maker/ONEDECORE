# Phase 9D-C2 — Unified Homepage, `/interiors`, and Public Journey

**Status:** `MERGED` / Phase 9D-C **COMPLETE / CLOSED**
**Date:** 2026-08-23
**Starting protected main:** `34741dac155aad67c1ae9f93bd41a2d7316c9b5a` (PR #82 merge)
**Branch:** `phase-9d-c2-unified-home`
**Exact head:** `31e506a640b6edec901e23b5e4570cfcef810d44`
**Merged to protected main:** `bf6d5cca8daa77870229a15a8ff119b27f7362f9` (PR #83)

Phase 9D-C is **COMPLETE / CLOSED**. Evidence: PR #82 merged; M36 managed-certified; PR #83 Quality Gate PASS; desktop 1440 QA PASS; mobile 320/390/430 overflow QA PASS; drawer focus/Escape/inert QA PASS; runtime/hydration NONE. Production remains **OFF**.

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

Cart/checkout/tracking UI (9D-D2), payments (9D-E), customer accounts, wishlist DB, `commerce_service_areas`, new cities, fabricated reviews, production activation. Phase 9D-C closeout is complete.
