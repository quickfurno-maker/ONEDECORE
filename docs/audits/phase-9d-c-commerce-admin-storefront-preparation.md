# Phase 9D-C — Commerce Admin Control & Storefront Preparation Spec

**Status:** `PREPARATION_FROZEN` (architecture unchanged) — 9D-C becomes **READY / NEXT** only after this 9D-B closeout is independently reviewed and merged
**Date:** 2026-08-20 (preparation freeze); current-status truth-sync 2026-08-23
**Starting main (homepage lock):** `e1aa6ca5d412fb03d9e92835098236c8254b42c0` (PR #74 true merge)
**Authority:** ADR-0028 / ADR-0030 / ADR-0032 / DEC-0079 / DEC-0083 / DEC-0089 / DEC-0090 / DEC-0091 / DEC-0092 / DEC-0093 / OD9D-1–OD9D-12
**Scope of this file:** frozen preparation. This closeout does **not** implement `/shop`, `/interiors`, homepage runtime, checkout, payments, M36, or `commerce_service_areas`.

---

## 1. Sequence (locked)

`9D-A complete → 9D-B repository complete (PR #73) → M35 managed certified → 9D-B closeout merge (this PR; final gate) → 9D-C READY / NEXT → 9D-D+`

M35 is managed-certified. Repository and managed history are **M1–M35**. PR #80 is merged. This 9D-B docs-only closeout merge is the final remaining gate. After independent review and merge of this closeout, Phase 9D-B is **COMPLETE / CLOSED** and Phase 9D-C is **READY / NEXT** and may start. Remaining 9D-C work after this preparation freeze was the public storefront / public journey. **Current (2026-08-23):** C1 is merged (PR #82) and M36 is managed-certified. C2 repository implements `/`, `/interiors`, and unified public nav. Phase 9D-C is **IMPLEMENTATION SUBSTANTIALLY COMPLETE / FINAL QA-CLOSEOUT PENDING**. Cart, checkout, orders, and payments remain **9D-D+**. Production **OFF**.

---

## 2. Current evidence

| Area | State |
| :--- | :--- |
| Repository migrations | **M1–M35** |
| Managed Supabase `lpurlfmpvriyvpkujvyl` | **M1–M35**; latest `20260822140000` / `commerce_catalogue_inventory_foundation` |
| Production | **OFF** |
| Admin routes | `/admin/commerce`, `/categories`, `/products`, `/products/[id]`, `/settings` |
| Public `/shop` | **absent** |
| Homepage | Interior-led; furniture categories/featured **not** bound to catalogue |
| Service areas table | **absent** |
| GST-inclusive display | CHECK-locked true; settings UI read-only |
| Category depth | Root + one child; reparenting that would create grandchildren denied |
| PR #80 | MERGED (`565fa12d10bc98163b30d1832a4aa06367913242`; exact head `0bd24c62c2711319a8daa2cc82352513f9bbe7fb`) |

### Foundation still present (M35 + admin)

- Category CRUD, SEO, overrides, archive, parent = root only
- Product general fields including featured, SEO, tax, HSN, shipping overrides
- Variants (SKU, options, prices, availability mode)
- Media authorize/finalize/archive (objects required)
- Specs, related products
- Inventory signed delta on product detail
- Tax rates + shipping + pincodes on settings
- Storefront-disabled / Phase 10 banner

### Delivered by PR #80 (do not treat as remaining 9D-C admin polish)

- Commerce overview / command centre
- Products UX
- Category tree UX
- Settings / pincode UX
- Permission-gated actions
- Category-first empty state
- No orders / payments / inventory nav
- No public `/shop`

### Remaining 9D-C (public journey + genuinely unresolved items)

9D-C owns:

- public `/shop` browse
- category / storefront UX
- product detail
- search / filter / sort as frozen for MVP
- public SEO
- admin-driven categories / featured products on the public site
- root balanced 50/50 homepage commerce integration
- `/interiors` public journey
- pincode / serviceability display / check only where existing authority permits
- local wishlist only if still required by the locked MVP and cheap enough

Still deferred (not 9D-C ownership unless a later gate says otherwise):

- `/admin/commerce/service-areas` and any post-M35 service-area schema (timestamp unreserved; **not** M36 from this closeout)
- dedicated inventory list page / further admin inventory nav (not required to start storefront)
- tabbed product detail if still desired after PR #80
- committed cart, checkout, order creation, payments (9D-D+)

---

## 3. Frozen preparation decisions

Normative text: [ADR-0032](../ADR/ADR-0032-commerce-admin-control-and-phase-9d-c-storefront-preparation.md).

| Topic | Freeze |
| :--- | :--- |
| Admin-first | Items 1–38 in ADR-0032 §1 must not require source edits |
| Single admin | Extend `/admin/commerce*`; no second commerce admin |
| RBAC | Exact M35 codes only: SA `commerce.read`, `commerce.catalog.manage`, `commerce.inventory.manage`, `commerce.orders.manage`, `commerce.payments.read`, `commerce.settings.manage`; SM `commerce.read`, `commerce.orders.manage`, `commerce.payments.read`; others none. No aliases. No fake order/payment UI |
| Depth | Root → subcategory only |
| GST display | Locked true; no toggle |
| Tax rates | Staff-configured; no statutory % seed |
| Featured / category order | Item 35 uses existing M35 `commerce_products.featured`. Item 36 uses existing M35 `commerce_categories.sort_order`. No page-builder or extra feature-ordering schema. Optional `featured_rank` later only if needed |
| Pincode vs city | Pincode is serviceability authority; city is grouping/display |
| Service areas | Items 31 and 34 only. Next forward-only migration **after** certified M35; timestamp **unreserved**; **not** this gate; do not call it M36 |
| Launch city | Pune first; later cities from Admin |
| GIS | Forbidden |
| Homepage | One brand; root `/` perceived ~50/50 interiors+kitchens / furniture; dedicated `/interiors` and `/shop`; admin-driven furniture categories + featured; **three-layer journey DEC-0092**; **balanced mixed homepage ADR-0032 §9.3 / DEC-0093**; no fake cart; compact mobile length |
| Page builder | Forbidden |
| Cart in 9D-C | No functional cart; 9D-D owns cart/checkout |
| Production | Phase 10 only; not an admin toggle |

---

## 4. Allowed now vs forbidden now

**Allowed for 9D-C implementation (separate gate):** public `/shop` and `/interiors` journey, homepage commerce integration per DEC-0093, storefront SEO, and genuinely remaining admin/storefront gaps listed above.

**Forbidden in this closeout and still later-gated:** M36 or any post-M35 SQL, service-area DB, checkout, payment provider runtime, deployment, production activation.

---

## 5. Explicit not done

- 9D-C public storefront / public journey **NOT STARTED**
- 9D-D / 9D-E / 9D-F / Phase 10 **NOT STARTED**
- No public `/shop`, `/interiors` runtime, cart, checkout, commerce orders, payments, SDKs, webhooks
- No CRM lead or MARKETING consent from commerce
- No project conversion from furniture
- No M36 allocated by 9D-B closeout
- Protected stashes untouched

---

## 6. Unified homepage design lock (DEC-0091)

Normative visual language: [ADR-0032 §9.1](../ADR/ADR-0032-commerce-admin-control-and-phase-9d-c-storefront-preparation.md). DEC-0091 ratio, “no separate interiors homepage”, Kitchen header target, and root section order are **superseded by §9.2 / DEC-0092**. Remaining §9.1 visual/funnel/admin/no-fake-cart/phase locks remain.

## 6.1 Three-layer public journey (DEC-0092)

Normative: [ADR-0032 §9.2](../ADR/ADR-0032-commerce-admin-control-and-phase-9d-c-storefront-preparation.md). Checklists: [unified homepage](../design/phase-9d-c-unified-homepage.md), [three-layer public site](../design/phase-9d-c-three-layer-public-site.md).

Layers: `/` mixed brand homepage **above** `/interiors` (Interiors + Kitchen conversion) and `/shop` (commerce). Root `/` **composition** is §9.3 / DEC-0093 (perceived ~50/50). MVP kitchens nav: `/interiors#modular-kitchen`. No default `/modular-kitchen` page.

§9.2 15-section root order and ~60–65/~35–40 ratio are **superseded by §9.3**.

## 6.2 Balanced mixed homepage (DEC-0093)

Normative: [ADR-0032 §9.3](../ADR/ADR-0032-commerce-admin-control-and-phase-9d-c-storefront-preparation.md). Checklist: [unified homepage](../design/phase-9d-c-unified-homepage.md).

Root `/` order: Header → Balanced hero → 50/50 journeys → Combined trust → Interior/kitchen preview → Furniture categories → Design it / Furnish it bridge → Modular kitchen feature → Featured furniture → Real Homes → Why → Dual process → Pincode → Testimonials → Final 50/50 CTA → Footer.

No homepage, `/interiors`, or `/shop` runtime in this documentation. Cart icon only in 9D-D. Search/wishlist icons only when those 9D-C features exist.
