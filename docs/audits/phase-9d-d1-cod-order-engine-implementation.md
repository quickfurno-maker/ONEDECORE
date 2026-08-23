# Phase 9D-D1 — COD Order Engine & Secure Guest Commerce Data Plane

**Status:** `REPOSITORY_IMPLEMENTED` / `MANAGED_APPLY_PENDING`
**Date:** 2026-08-23
**Starting protected main:** `bf6d5cca8daa77870229a15a8ff119b27f7362f9` (PR #83 merge)
**Branch:** `phase-9d-d1-cod-order-engine`
**Migration git blob:** `fe13e28e4a61607706bae32b5df33630ede2f9bd`
**Migration SHA-256 (LF):** `cb27d7fb848f2983ce05056c0e47a2c0e06e4290cdca2b890674cf67542765fc`

Phase 9D-C is **COMPLETE / CLOSED**. This gate implements only the database/order-engine half of 9D-D. Phase 9D-D is **not** complete. D2 (cart/checkout/tracking UI) follows after D1 merge and managed M37 certification. Production remains **OFF**.

## 1. Scope

- Conceptual M37 `20260824140000_commerce_order_cod_checkout_foundation`
- Authoritative cart quote revalidation
- Atomic COD order creation
- Immutable order / item / delivery snapshots and append-only events
- Ready-stock oversell protection and made-to-order no-decrement
- Guest Order Number + Mobile tracking primitives
- Hashed public rate-limit foundation
- Staff fulfilment and cancellation RPCs
- Narrow server-only parsers/helpers for D2

## 2. Explicit omissions

- `/shop/cart`, `/shop/checkout`, `/shop/track`, `/shop/order/[orderReference]`
- Add to Cart / Buy Now / cart icon
- Payment provider SDK, webhooks, `commerce_payments`, automatic refunds
- Managed apply
- Deployment / production activation

## 3. Quote / shipping / tax

Input lines are SKU + quantity only. Quote never reserves inventory and never returns stock counts or private IDs.

Shipping charge precedence: product override → direct category override → global default. Free-shipping: any explicit false override blocks free-ship; otherwise explicit true or (all overrides null and merchandise subtotal meets `free_shipping_threshold_paise`). No parent-category inheritance.

GST-inclusive tax: `round(gross * rate_bp / (10000 + rate_bp))` using numeric half-up. Subtotal is GST-inclusive selling total. Total = subtotal + shipping.

## 4. COD commit

`create_public_commerce_cod_order` is SECURITY DEFINER, EXECUTE to `service_role` only. Flow: guest idempotency lock/replay → validate → authoritative quote → lock ready-stock inventory in variant-id order → decrement `stock_on_hand` only → insert confirmed COD order, immutable items/delivery, `order_confirmed_cod`. `contact_id` stays null. No CRM / MARKETING / project / quotation writes.

## 5. Tests

- pgTAP: `supabase/tests/database/29_commerce_order_cod_checkout_foundation_test.sql`
- App contracts: `npm run test:phase-9d-d1` (umbrella) / `test:app` keeps only `phase-9d-d1-cod-order-engine.test.ts`
- Dedicated concurrency: `npm run test:phase-9d-d1-concurrency` — fails if `supabase_db_OneDecore` is absent. Database Quality runs this after local reset. Application Quality does not.

## 6. Pre-merge security + concurrency corrections (PR #84)

Corrected in place on unmerged/unmanaged M37. No M38. Production remains **OFF**.

- Rate-limit admission is transaction-serialized: NETWORK advisory lock, then PHONE lock when present, then count/decide/insert. Prefix `commerce-rate-limit|`.
- Direct `service_role` INSERT/UPDATE/DELETE on the four order tables is revoked. Staff read remains authenticated SELECT + `commerce.read` RLS. Mutations go through postgres-owned SECURITY DEFINER RPCs.
- Every new M37 SECURITY DEFINER function is explicitly `OWNER TO postgres` with `search_path = ''`.
- Hand-maintained generated types now include exact M37 FK relationships and RPC optionality matching SQL.
- Database Quality now executes the two-client COD and rate-limit races with zero skips.

## 7. Managed apply

**NOT AUTHORIZED.** Managed history remains **M1–M36** until a later certification gate.
