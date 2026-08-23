# Phase 9D-B — Commerce Catalogue & Inventory Foundation

**Status (original repository gate):** `REPOSITORY_IMPLEMENTED` — M35 **not** managed-applied at this gate
**Current phase status (2026-08-23):** 9D-B **COMPLETE / CLOSED** — see [M35 managed apply closeout](phase-9d-b-m35-managed-apply-closeout.md)
**Authority:** ADR-0028 / ADR-0030 / OD9D-1–OD9D-12 / DEC-0089
**Date:** 2026-08-20 (repository gate); current-status addendum 2026-08-23
**Branch:** `phase-9d-b-commerce-catalogue-foundation`
**Worktree:** `C:\Users\KESHAV SHARMA\Desktop\OneDecore-phase9d-b`
**Starting main:** `935bb7054df81cb26608479e0b59f3c3911a2741` (PR #72 true merge)

## Scope

Repository-only Phase 9D-B: catalogue tables, exact commerce RBAC, admin CRUD in the existing `/admin` shell, dedicated product media buckets + service-role pipeline, single-pool inventory RPC, pgTAP + app tests.

## Explicitly out of scope / not done in this gate

- Managed Supabase apply of M35 (remote remains **M1–M34**)
- Public `/shop`, cart, checkout, guest orders, inventory holds, order snapshots
- Commerce order/payment tables, Razorpay/Stripe/Cashfree/PhonePe/PayU SDKs, webhooks
- CRM lead/project/campaign auto-creation or MARKETING consent from catalogue
- 9D-C / 9D-D / 9D-E / 9D-F / Phase 10
- Production activation

No ADR-0030 contradiction was found. No new ADR.

## Migration

- File: `supabase/migrations/20260822140000_commerce_catalogue_inventory_foundation.sql` (**M35**)
- Git blob: `172e96a8a55c4d3596ccd5f4fc5ec6208c568496`
- Raw SHA-256 (LF): `1D8DDD6377CDA301DDC52F26757AA9D09294B2E41EE6CD6B807B51DCAD2C8742`
- Pre-correction (superseded in place): blob `d8f2ff7c407f4011a63136cdabf5fde3b39efe7b` / SHA-256 `9EF6887847842894E488D94944EA08268AB644A49D0DB93A7FE09E0033E626D9`
- M1–M34 **unchanged**
- Forward-only. **Not** managed-applied.
- No M36. No following migration reserved.

## Same-PR correction (unmanaged M35 in place)

- Media finalize fails closed unless both exact `storage.objects` rows exist (`COMMERCE_MEDIA_OBJECT_MISSING`); prior primary is not demoted on failure.
- `gst_inclusive_display` CHECK `is true`; `update_commerce_tax_settings` mutates only `tax_required_for_publish`; admin UI is read-only locked copy.
- Category parent trigger: parent must be a root; the moved category must have zero children.

## Tables

| Object | Notes |
| :--- | :--- |
| `commerce_categories` | Root + one subcategory level; unique slug; archive not delete |
| `commerce_products` | `OD-P-{YYYY}-{SEQ6}`; draft/published/archived; publication RPC |
| `commerce_product_variants` | Simple options `color\|finish\|size\|upholstery`; unique SKU; paise |
| `commerce_product_media` | Dual bucket paths; one active primary |
| `commerce_product_specifications` | Key/value only |
| `commerce_inventory` | One row per variant; `available_qty` generated; reserved stays 0 |
| `commerce_related_products` | Manual pairs; no self |
| `commerce_pincodes` | 6-digit; ETA min ≤ max |
| `commerce_shipping_settings` | Singleton; paise charges |
| `commerce_tax_rates` | Integer basis points; **no statutory GST seed** |
| `commerce_tax_settings` | Singleton; GST-inclusive display **locked true** for MVP; tax-required-for-publish remains mutable |
| `private.commerce_idempotency_requests` | Staff mutation ledger |

No `commerce_orders`, `commerce_order_items`, `commerce_order_delivery`, `commerce_payments`, `commerce_payment_events`, `commerce_order_events`.

## Storage

- `commerce-product-originals` private 20 MiB JPEG/PNG/WebP
- `commerce-product-public` public 8 MiB derivatives
- Prefix `{product_id}/{media_id}/...`
- Authenticated storage writes denied; service-role after `commerce.catalog.manage` + authorize RPC

## RBAC

| Role | Grants |
| :--- | :--- |
| Super Admin | all six: `commerce.read`, `catalog.manage`, `inventory.manage`, `orders.manage`, `payments.read`, `settings.manage` |
| Sales Manager | `commerce.read`, `orders.manage`, `payments.read` only |
| All other roles | none |

`orders.manage` / `payments.read` are seeded for later subphases; 9D-B has no order/payment pages.

## Inventory RPC

`adjust_commerce_inventory(variant_id, signed delta, reason, idempotency_key)` — `commerce.inventory.manage`, row lock, underflow blocked if `stock_on_hand + delta < reserved_qty`. No `reserved_qty` argument.

## Admin

`/admin/commerce`, `/categories`, `/products`, `/products/[id]`, `/settings`. Nav with `commerce.read`. SA mutate; SM read-only. Storefront/production disabled banner. No `/shop`.

## Tests

- pgTAP: `27_commerce_catalogue_inventory_foundation_test.sql` (88/88); local `supabase test db` **1651/1651** PASS; identity counts 82 permissions / 97 public tables
- App: `npm run test:phase-9d-b` (22 pass)
- Image pipeline: 17 pass
- Full `npm run test:app` 930/930 after 6B ledger update to M35 / fail-closed M36+

## Managed (read-only this original gate)

Project `lpurlfmpvriyvpkujvyl`: at the original repository gate, remote was **M1–M34**; M35 was absent. This file records that repository-only evidence. It does **not** claim M35 was already managed-applied at PR #73.

---

## Closeout / current status (2026-08-23)

Later independently verified facts. Full certification: [phase-9d-b-m35-managed-apply-closeout.md](phase-9d-b-m35-managed-apply-closeout.md).

- Original 9D-B repository implementation merged in **PR #73** (`06b6d2ea5f1cf4d886be497a8eed7ce8d1d52e58`).
- M35 was subsequently managed-applied and verified. Managed history is now **M1–M35**. Latest version `20260822140000` / `commerce_catalogue_inventory_foundation`.
- Public `commerce_*` tables: **11**. All **11** have RLS enabled. All **11** have FORCE ROW LEVEL SECURITY.
- **PR #80** later delivered the Operations Suite catalogue admin UI. Exact head `0bd24c62c2711319a8daa2cc82352513f9bbe7fb`. Merge commit `565fa12d10bc98163b30d1832a4aa06367913242` at `2026-08-23T04:29:29Z`.
- Exact-head PR-attached Application Quality **PASS**. Database Quality **PASS**.
- Authenticated managed catalogue smoke **PASS** (category BED; product `bed king size`; active variant SKU `bed`; selling price ₹42,500; shipping override ₹300; product-detail render; Add Product drawer open/close with focus restore; no runtime error). QA evidence only — no record IDs recorded here.
- Phase 9D-B is **COMPLETE / CLOSED**. Production remains **OFF**.
- Public `/shop`, cart, checkout, commerce orders, and payments remain **outside 9D-B**.
