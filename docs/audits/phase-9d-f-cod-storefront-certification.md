# Phase 9D-F — COD-only storefront certification

**Status:** `PHASE_9D_F_COD_CERTIFICATION_LOCAL_PASS`  
**Date:** 2026-08-24  
**Branch / worktree:** `phase-9d-f-cod-certification` / `OneDecore-phase9d-f-cod-certification`  
**Starting main:** `57eab7e550dbf90a21a41969ff65a85403c12fcc` (PR #86 merge — COD-first governance)  
**Authority:** [ADR-0033](../ADR/ADR-0033-phase-9d-cod-first-launch-and-online-payment-deferral.md) / DEC-0094  
**Latest migration:** M37 `20260824140000_commerce_order_cod_checkout_foundation.sql`  
**M38:** **absent** from `main` and this branch  
**Online payments:** **DEFERRED** (preserved locally on `phase-9d-e-online-payments` @ `b2ea05c243d03d3e88385189b8a7098a8ffe20c8`; untouched)  
**Production:** **OFF** · no managed write · no deployment · no push/PR

---

## Scope

Certification/hardening only for the merged COD storefront before Phase 10 COD-only activation.

- Prove secure, correct, accessible, responsive, MVP-performant, SEO-ready COD path.
- Fix real defects only. No feature expansion, no redesign, no M38, no payment providers.

ADR-0030 originally listed webhook certification under 9D-F. ADR-0033 amends: online-payment/webhook certification is deferred with 9D-E. This gate certifies **no live payment provider/webhook dependency** on main.

---

## Entry audit (PASS)

| Check | Evidence |
| :--- | :--- |
| `origin/main` | `57eab7e550dbf90a21a41969ff65a85403c12fcc` |
| PR #86 | Merged (COD-first docs) |
| Migrations | 37 files; latest M37; M38 file absent |
| Deferred 9D-E | Worktree HEAD still `b2ea05c…`; clean; not on main |
| Payment packages | None in `package.json` |
| Payment routes | No `/api/webhooks/commerce/*` |
| Checkout | COD-only UI + `paymentMethod: "cod"` |
| Production | StorefrontDisabledBanner OFF; no activation env ON |

---

## Defects fixed

| Severity | Defect | Fix |
| :--- | :--- | :--- |
| SEO | Shop/category/PDP (and home/interiors) lacked Open Graph while portfolio already had it | `shop-seo.ts` + OG on indexable routes |
| SEO | Category filter/query URLs stayed `index:true` | `shopListingHasQueryDuplicates` → `noindex` when listing params present; canonical stays clean |
| SEO/security | JSON-LD `JSON.stringify` without `<` escape | `serializeJsonLd` |
| Correctness | Pincode help said “Ordering is not enabled yet” after D2 COD | COD-accurate help copy |
| UX | Category parent crumb showed slug | Resolve parent **name** |
| A11y/mobile | Qty buttons 36px; pincode row could overflow at narrow widths | 44px targets; flex `min-width:0` |
| UX | Silent checkout quote `invalid` state | Alert for invalid pincode |
| Consistency | Cart `follow:true` while other transactional routes were `follow:false` | Cart `noindex,nofollow` |
| Admin UX/safety | Staff mutations returned raw error codes | Staff-safe messages (no SQLSTATE) |

No schema migration required.

---

## Automated gates

| Gate | Result |
| :--- | :--- |
| `npm run db:reset` | PASS (M1–M37) |
| `npm run db:test` | PASS — 29 files / 1782 tests |
| `npm run test:phase-9d-b` | PASS |
| `npm run test:phase-9d-c1` | PASS |
| `npm run test:phase-9d-c2` | PASS |
| `npm run test:phase-9d-d1` | PASS (includes concurrency) |
| `npm run test:phase-9d-d1-concurrency` | PASS (`ONEDECORE_REQUIRE_D1_CONCURRENCY=1`) |
| `npm run test:phase-9d-d2` | PASS |
| `npm run test:phase-9d-f` | PASS — 16 contracts |
| `npm run test:app` | PASS — 1035 tests |
| `npm run test:image` | PASS |
| `npm run typecheck` | PASS |
| `npm run lint` | PASS (0 errors; pre-existing warnings only) |
| `npm run build` / `npm run check` | PASS |
| `git diff --check` | PASS |

---

## SEO certification

- Indexable: `/`, `/interiors`, `/shop`, category, PDP — unique title/description, canonical, Open Graph.
- Search + cart/checkout/track/order — `noindex` (transactional also `nofollow`).
- Filtered category listings — `noindex` + canonical to clean category URL.
- Sitemap includes `/`, `/interiors`, `/shop`, categories, products; **excludes** cart/checkout/track/order/search.
- Robots: disallow `/admin/`, `/api/admin/`, `/auth/` (unchanged; transactional rely on meta noindex + sitemap omission).
- Product + Breadcrumb JSON-LD from catalogue; INR from variant paise; **no** invent ratings/reviews.

---

## Security / COD / inventory

- No `NEXT_PUBLIC` service-role; commerce runtime secret server-only fail-closed.
- Tracking proof HttpOnly cookie; tamper + expiry reject; no PII in cookie payload.
- Order reference without proof → redirect to `/shop/track` (307 observed).
- Checkout: server quote/COD only; no browser price authority; public error map hides SQLSTATE.
- Admin: session client + fulfilment/cancel RPCs; staff-safe errors; no refund UI.
- D1 concurrency: one success / one stock miss under qty=1; rate-limit admission proofs green.
- No Razorpay/Stripe/Cashfree/PhonePe/PayU; no M38; no CRM lead side effects from purchase path.

---

## Accessibility / responsive / performance

- `lang="en"`; logical H1 on shop journeys; labelled forms; Escape closes header drawer; focus restore patterns preserved from C2.
- CSS: single-column under 380px; grids at 720/1100; touch targets ≥2.75rem; overflow-safe cart/pincode/form fields.
- Production build green; shop routes dynamic; Next/Image remotePatterns for commerce + portfolio; no hydration blockers in certification smoke.
- Known D2 note: prefer `http://localhost` over `127.0.0.1` for Next asset origin in **dev**; this gate used production `next start` on localhost:3001.

### Browser / HTTP smoke (production `next start` :3001)

Fixture: `npm run qa:phase-9d-d2-local-seed` → `/shop/product/d2-qa-oak-bed`, pincode `411001`.

| Route | Result |
| :--- | :--- |
| `/`, `/interiors`, `/shop`, PDP, category | 200; OG present where expected |
| `/shop/c/{slug}?sort=price_low_high` | `noindex` |
| `/shop/cart`, `/checkout`, `/track`, `/search` | 200 + noindex |
| `/shop/order/{ref}` without proof | 307 → track |
| `/admin/commerce/orders` unauthenticated | 307 → auth |
| `/robots.txt` | admin/API/auth disallow |
| `/sitemap.xml` | shop present; cart absent |
| PDP | Buy Now + Add to Cart; no PSP copy |
| Checkout HTML | Cash on delivery only |

Viewport matrix (320–1440): certified via responsive CSS contracts + production HTML smoke of critical routes. Interactive D2 checkout/tracking journeys remain covered by D2 closeout + M37/pgTAP/D1 concurrency; no regression introduced in purchase path.

---

## Remaining non-blockers

- M37 schema still allows `payment_method` value `online` in DB/quote types (no storefront create path).
- Race categories from local D1 concurrency seeds may appear in local browse until reset.
- Pre-existing eslint warnings outside shop surface.

---

## Phase 10 recommendation

**LOCAL certification PASS.** After owner merge of this branch, Phase 10 may activate **COD-only** public `/shop`. Phase 10 **must not** activate online payments, provider secrets, or webhooks (ADR-0033). Do not start Phase 10 in this worktree.
