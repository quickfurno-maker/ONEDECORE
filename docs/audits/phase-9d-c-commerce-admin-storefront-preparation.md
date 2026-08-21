# Phase 9D-C — Commerce Admin Control & Storefront Preparation Spec

**Status:** `PREPARATION_FROZEN` (docs only; **not** 9D-C implementation; **not** 9D-B closeout)
**Date:** 2026-08-20
**Starting main (homepage lock):** `e1aa6ca5d412fb03d9e92835098236c8254b42c0` (PR #74 true merge)
**Authority:** ADR-0028 / ADR-0030 / ADR-0032 / DEC-0079 / DEC-0083 / DEC-0089 / DEC-0090 / DEC-0091 / DEC-0092 / DEC-0093 / OD9D-1–OD9D-12
**Scope:** docs only. No M36. No `commerce_service_areas`. No `/shop`. No `/interiors`. No homepage runtime. No checkout. No payment. No managed write. No deploy.

---

## 1. Sequence (locked)

`9D-A freeze merged → 9D-B repository merged (PR #73 / main 06b6d2e) → M35 managed apply **pending** → 9D-B docs closeout **not started** → **9D-C BLOCKED** → 9D-D+`

9D-C code must **not** start until M35 is recovery-qualified managed-certified **and** 9D-B closeout is merged.

---

## 2. Current evidence

| Area | State |
| :--- | :--- |
| Repository migrations | **M1–M35** |
| Managed Supabase `lpurlfmpvriyvpkujvyl` | **M1–M34**; M35 **not** applied |
| Production | **OFF** |
| Admin routes | `/admin/commerce`, `/categories`, `/products`, `/products/[id]`, `/settings` |
| Public `/shop` | **absent** |
| Homepage | Interior-led; furniture categories/featured **not** bound to catalogue |
| Service areas table | **absent** |
| GST-inclusive display | CHECK-locked true; settings UI read-only |
| Category depth | Root + one child; reparenting that would create grandchildren denied |

### 9D-B admin vs owner target (gap, not a reopen)

Present in M35 + current admin (foundation; UX polish deferred to 9D-C entry):

- Category CRUD, SEO, overrides, archive, parent = root only
- Product general fields including featured, SEO, tax, HSN, shipping overrides
- Variants (SKU, options, prices, availability mode)
- Media authorize/finalize/archive (objects required)
- Specs, related products
- Inventory signed delta on product detail
- Tax rates + shipping + pincodes on settings
- Storefront-disabled / Phase 10 banner

Not yet (allowed as **9D-C / post-closeout admin polish**, not this PR):

- Dashboard cards as specified (featured SKU counts, cities, media warnings, quick actions)
- Category tree presentation, child/product counts
- Product list filters/columns as specified
- Tabbed product detail / dedicated inventory list page
- `/admin/commerce/service-areas`
- Homepage 70/30 furniture from admin data
- Public `/shop*`

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
| 9D-C code | Blocked until M35 cert + 9D-B closeout merge |

---

## 4. Allowed now vs forbidden now

**Allowed:** business catalogue preparation, image preparation, this admin/UX spec, SEO copy in existing fields, homepage **design** preparation (no runtime).

**Forbidden now:** M36 or any post-M35 SQL, service-area DB, `/shop` or `/interiors` implementation, homepage runtime rewrite, checkout, payment, deployment, 9D-B closeout impersonation, M35 managed apply.

---

## 5. Explicit not done

- 9D-C **NOT STARTED**
- 9D-D / 9D-E / 9D-F / Phase 10 **NOT STARTED**
- M35 **NOT** managed-applied
- 9D-B closeout **NOT STARTED**
- No `/shop`, `/interiors`, cart, checkout, commerce orders, payments, SDKs, webhooks
- No CRM lead or MARKETING consent from commerce
- No project conversion from furniture
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
