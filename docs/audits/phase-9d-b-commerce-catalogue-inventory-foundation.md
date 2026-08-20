# Phase 9D-B — Commerce Catalogue & Inventory Foundation

**Status:** `REPOSITORY_IMPLEMENTED` (PR open, not merged; **not** managed-applied)
**Authority:** ADR-0028 / ADR-0030 / OD9D-1–OD9D-12 / DEC-0089
**Date:** 2026-08-20
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
- Git blob: `d8f2ff7c407f4011a63136cdabf5fde3b39efe7b`
- Raw SHA-256 (LF): `9EF6887847842894E488D94944EA08268AB644A49D0DB93A7FE09E0033E626D9`
- M1–M34 **unchanged**
- Forward-only. **Not** managed-applied.
- No following migration reserved.

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
| `commerce_tax_settings` | Singleton; GST-inclusive display policy; tax-required-for-publish |
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

- pgTAP: `27_commerce_catalogue_inventory_foundation_test.sql` (67 assertions); identity counts 82 permissions / 97 public tables
- App: `npm run test:phase-9d-b` (18)
- Image pipeline: 17 pass
- Full `npm run test:app` after 6B ledger update to M35 / fail-closed M36+

## Managed (read-only this gate)

Project `lpurlfmpvriyvpkujvyl`: remote **M1–M34**; M35 absent; dry-run must propose **only** M35; **DO NOT APPLY**.
