# Phase 9D-C1 — Public Storefront Data Plane & Core `/shop`

**Status:** `MERGED` / `MANAGED_APPLIED_CERTIFIED` (current-state addendum 2026-08-23)
**Date:** 2026-08-23
**Starting protected main:** `56cbf6a091f0c0e7f67adcc2c54a06d9395cafd8` (PR #81 merge)
**Branch:** `phase-9d-c1-public-storefront`
**Merged to protected main:** `34741dac155aad67c1ae9f93bd41a2d7316c9b5a` (PR #82)

Phase 9D-C is **COMPLETE / CLOSED**. This file remains the C1 provenance record. C2 merged as PR #83. Protected main after C2: `bf6d5cca8daa77870229a15a8ff119b27f7362f9`.

## 1. Scope

Secure anonymous public commerce read surface plus core shop routes. No homepage 50/50 rewrite. No `/interiors`. No cart, checkout, orders, or payments. Production **OFF**. Managed apply **not authorized** in this gate.

## 2. Migration

| Item | Value |
| :--- | :--- |
| File | `supabase/migrations/20260823140000_commerce_public_storefront_read_foundation.sql` |
| Position | Next repository migration after M35 `20260822140000` |
| Git blob | `81a096f4c31c6003fdcf6e4595c84dfe0e806911` |
| SHA-256 LF | `2CEAD7E36022D8A6B6855B27E5E54370633385B2E56FCFCC1D526760D7D20C53` |
| M35 | Unchanged |
| Managed apply | **APPLIED / CERTIFIED** on 2026-08-23 (post-merge; was pending at C1 repository entry) |

Pre-merge audit (unmerged C1 only; migration corrected in place, not re-issued) found and fixed three public-read truth defects:

1. Inactive-parent hierarchy leak — published products under an active child of an archived root were still searchable, openable by slug, related, and sitemap-listed.
2. Availability-filter summary mismatch — `p_availability_mode` filtered price but not `variant_count` / `is_available` / `availability_mode`.
3. Archived-variant media leak — active media attached to an archived variant could still appear as public gallery or card primary image.

Public eligibility now uses one category predicate (`own status active` and root-or-active-root-parent) and one media predicate (active path plus product-wide or active same-product variant). Filtered cards compute every variant-derived field from matching variants only. Production remains **OFF**.

Public RPCs (SECURITY DEFINER, `search_path = ''`, EXECUTE to `anon` + `authenticated` only):

- `list_public_commerce_categories()`
- `search_public_commerce_products(...)`
- `get_public_commerce_product(slug)`
- `check_public_commerce_pincode(pincode)`
- `list_public_commerce_sitemap()`

No `GRANT SELECT` on commerce tables to `anon`. Draft/archived products, inactive categories, inactive variants, and archived media are excluded in SQL. Internal stock/reservation fields are not returned.

## 3. Application

Dedicated layer: `src/features/commerce/public/**`. Uses the public anon client (publishable key). Never service-role for browsing. RPC parse failures and RPC errors throw; they are not converted to fake empty lists at the query boundary.

Routes:

- `/shop`
- `/shop/c/[slug]`
- `/shop/product/[slug]`
- `/shop/search`

SEO: shop/category/PDP indexable when data is active/published. Search is `noindex,follow`. Sitemap adds `/shop` plus active category and published product URLs; a commerce read failure omits those dynamic URLs and does not invent entries.

Wishlist and recently viewed are browser-local only (`localStorage`), capped, corrupt-tolerant. Rendered prices always come from the server.

## 4. Tests

- pgTAP: `supabase/tests/database/28_commerce_public_storefront_read_foundation_test.sql`
- App: `npm run test:phase-9d-c1`

## 5. Explicit omissions / C2

- Root 50/50 homepage rewrite
- `/interiors` and “Planning a complete home?” journey links
- Homepage furniture categories / featured / pincode
- Public journey/nav integration on the production homepage
- Cart, checkout, orders, payments, inventory holds
- `commerce_service_areas` / city schema
- Customer accounts / wishlist database
- Managed migration apply
- Production activation

Warranty/care/assembly product fields do not exist on M35 products. Only `commerce_shipping_settings.assembly_install_note` is shown on a successful pincode check.

## 6. Current-state addendum (after PR #82)

Protected main `34741dac155aad67c1ae9f93bd41a2d7316c9b5a`. Managed history is **M1–M36**. Five public storefront RPCs are certified for `anon` EXECUTE. Anon raw commerce table SELECT remains denied. Private helper EXECUTE remains denied. Current managed public category count is **1**. Current managed published product count is **0**. Unknown pincode is not serviceable. Production remains **OFF**. C2 homepage/`/interiors` work is repository-only until independently merged.
