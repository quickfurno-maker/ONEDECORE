# Phase 9D-D2 â€” Cart, Guest COD Checkout, Secure Tracking, Admin Orders UI

**Status:** `COMPLETE / MERGED` â€” PR #85 merge commit `f40089b9eb82c9e023365a9dca2cafecde0d54a2`
**Date:** 2026-08-23 (implementation); merge + final manual QA closeout 2026-08-24
**Branch / worktree:** `phase-9d-d2-cart-checkout-tracking` / `OneDecore-phase9d-d2-cart-checkout-tracking`
**Starting main:** `1e7f936ed3340e0f316f9ef50c28ed9491ec58f7`
**Merge commit:** `f40089b9eb82c9e023365a9dca2cafecde0d54a2`
**Authority:** M37 `20260824140000_commerce_order_cod_checkout_foundation.sql` (unchanged by D2)
**Managed apply:** none during D2
**Production:** OFF Â· public /shop production activation OFF
**Online payments:** deferred by [ADR-0033](../ADR/ADR-0033-phase-9d-cod-first-launch-and-online-payment-deferral.md) / DEC-0094 (COD-first); **no M38 on `main`**

---

## Final merge gate (2026-08-24)

- Final interactive manual/browser QA cleared (including same-as-customer delivery address fix).
- Local merge gate: `PHASE_9D_D2_LOCAL_MERGE_GATE_PASS`.
- PR #85 merged to protected `main` at `f40089b9eb82c9e023365a9dca2cafecde0d54a2`.
- Production remains **OFF**. Repository latest migration remains **M37**. **No M38**.

---

## Local closeout defects fixed

1. **PDP 404 against seed:** `get_public_commerce_product` does **not** require media. The 404 was caused by `.env.local` pointing at managed Supabase while the QA seed wrote to local Docker. Fixed by rewriting gitignored `.env.local` to `127.0.0.1:54321` plus a â‰¥32-char `ONEDECORE_COMMERCE_PUBLIC_RUNTIME_SECRET`. Seed also adds active primary media to match M35 publish readiness for realistic QA.
2. **`useSyncExternalStore` infinite-loop warning:** `getCartSnapshot` now caches the parsed snapshot keyed by the raw localStorage string; server snapshot is a stable module constant.
3. **Seed mojibake:** final console log cleaned to ASCII separators.
4. **Same-as-customer delivery address:** default â€œsame as customerâ€ must disable only recipient name/mobile, not the address fieldset (fix before merge).

## Commit plan (narrow, no push)

1. `feat(storefront): add local cart and COD checkout`
2. `feat(commerce): add secure guest tracking and order operations`
3. `test(9d-d): certify D2 commerce journey`
4. `docs(9d): close D1 managed gate and record D2 repository truth`
5. `fix(commerce): preserve delivery address on same-contact checkout`

---

## Scope delivered

- Browser-local cart (`onedecore.commerce.cart.v1`) and buy-now session (`onedecore.commerce.buy-now.v1`)
- PDP purchase panel (exact variant SKU; listing cards remain browse-first)
- `/shop/cart`, `/shop/checkout`, `/shop/track`, `/shop/order/[orderReference]`
- Server-only `ONEDECORE_COMMERCE_PUBLIC_RUNTIME_SECRET` for HMAC fingerprints, reviewed-quote tokens, tracking proof cookies
- Guest COD checkout via M37 RPC wrappers only (no browser price authority)
- 5-minute reviewed-quote token closes price-drift UX without M38
- Anti-enumeration tracking + HttpOnly `od_commerce_track_v1` proof cookie (~30 min, Path=`/shop/order`)
- Admin `/admin/commerce/orders` list/detail with RLS reads and fulfilment/cancel RPC mutations only

## Phase 9D-D1 closeout (truth)

- **COMPLETE / CLOSED** â€” PR #84 merged; protected main `1e7f936ed3340e0f316f9ef50c28ed9491ec58f7`
- Managed Supabase aligned **M1â€“M37**
- D1 concurrency certification preserved (`test:phase-9d-d1-concurrency`)

## Explicit non-scope

- No M38 / no new migration on D2
- No payment provider / no online payment UI
- No CRM lead/consent/project side effects
- No managed Supabase writes during D2 QA
- No production activation

## Local QA

1. `npm run db:reset`
2. Set `ONEDECORE_COMMERCE_PUBLIC_RUNTIME_SECRET` (â‰¥32 chars) in `.env.local` (gitignored)
3. Optional fixture: `npm run qa:phase-9d-d2-local-seed`
4. `npm run dev` â€” browse `/shop/product/d2-qa-oak-bed`, checkout pincode `411001`

## Tests

- `npm run test:phase-9d-d2`
- Full gate per phase prompt Â§27 before merge authorization
