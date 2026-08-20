# ADR-0032 — Commerce Admin Control & Phase 9D-C Storefront Preparation

**Status:** Accepted (**docs only**; **PREPARATION**; **no 9D-C code**; **no M36**; **no `/shop` runtime**)
**Date:** August 20, 2026
**Deciders:** Business Owner, Senior Product Architect
**Depends on:** [ADR-0028](ADR-0028-phase-9d-ready-made-furniture-ecommerce.md), [ADR-0030](ADR-0030-phase-9d-ready-made-furniture-ecommerce-architecture.md), [ADR-0005](ADR-0005-version-1-no-erp-boundary.md), [ADR-0006](ADR-0006-public-and-admin-route-separation.md)
**Does not reopen:** OD9D-1–OD9D-12, payment port, inventory-hold/COD decrement, guest checkout, CRM identity reuse, GST-inclusive display lock, root+one-child category depth.

This ADR **is** the owner lock for **admin-first catalogue operations** and the **9D-C storefront/homepage preparation spec**. It does **not** authorize 9D-C implementation, any migration after M35, managed writes, checkout, payments, or Phase 10 activation.

**9D-C remains blocked** until:

1. Qualifying recovery backup exists for M35 apply, **and**
2. M35 is recovery-qualified **managed-applied and certified**, **and**
3. The **9D-B docs-only closeout** is independently reviewed **and merged**.

Repository at freeze: main `06b6d2ea5f1cf4d886be497a8eed7ce8d1d52e58` (PR #73 merge). Repository **M1–M35**. Managed **M1–M34**. Production **OFF**.

---

## 1. Owner lock — admin-first commerce operations

Normal catalogue and store operations MUST be operable from the existing ONEDECORE Admin. Staff MUST NOT need source-code edits for:

1. Root categories  
2. Subcategories  
3. Category ordering  
4. Category SEO  
5. Category active/archive  
6. Products  
7. Product descriptions  
8. Product SEO  
9. Featured products  
10. Product publication/archive  
11. Variants  
12. Color  
13. Finish  
14. Size  
15. Upholstery  
16. SKU  
17. Price  
18. Compare-at price  
19. Ready-stock / made-to-order  
20. Inventory  
21. Product media  
22. Primary image  
23. Gallery images  
24. Variant images  
25. Specifications  
26. Related products  
27. Tax-rate configuration  
28. Shipping settings  
29. COD setting  
30. Free-shipping threshold  
31. Serviceable cities/service areas  
32. Serviceable pincodes  
33. ETA  
34. City/state/zone **display** data  
35. Homepage/storefront featured product selection  
36. Store category ordering  
37. Pincode availability data  
38. Basic storefront SEO already represented by catalogue fields  

Items 31 and 34–36 that need schema beyond M35 are **specified here** and implemented only **after** the 9D-C entry gate (service-area master in the **next available** forward-only migration after certified M35 — **not created in this gate**).

---

## 2. Existing 9D-B admin — keep / build on it

Canonical admin routes (do **not** create a second commerce admin):

- `/admin/commerce`
- `/admin/commerce/categories`
- `/admin/commerce/products`
- `/admin/commerce/products/[id]`
- `/admin/commerce/settings`

After the 9D-C entry gate, **add** `/admin/commerce/service-areas` (and city detail) as an extension of this shell — not a parallel CMS.

RBAC remains ADR-0030 / M35:

| Role | Permissions |
| :--- | :--- |
| Super Admin | `commerce.read`, `catalog.manage`, `inventory.manage`, `orders.manage`, `payments.read`, `settings.manage` |
| Sales Manager | `commerce.read`, `orders.manage`, `payments.read` |
| All others | none |

Until order/payment phases exist: **do not** show fake functional order/payment management. `orders.manage` / `payments.read` stay seeded for later subphases only.

Inventory **mutation** remains Super Admin (`commerce.inventory.manage`).

---

## 3. Admin information architecture (target)

`/admin/commerce` dashboard cards (target after 9D-C entry; 9D-B already has a lean subset):

- total active categories / active subcategories
- draft / published / archived / featured products
- ready-stock SKUs / made-to-order SKUs / zero-stock ready-stock SKUs
- total serviceable pincodes / active cities (service areas)
- tax configuration readiness / shipping configuration readiness
- media readiness warnings

Quick actions: Add category, Add product, Adjust inventory, Manage service areas, Commerce settings.

Keep: **“Storefront / production activation is controlled by Phase 10.”** No admin control may bypass that gate.

---

## 4. Category / subcategory admin

Route: `/admin/commerce/categories`.

Root: create, rename, slug, short description, SEO title/description, sort order, shipping/COD/free-shipping overrides, active/archive, preview child count, preview product count.

Subcategory: same fields plus **exactly one root parent**. Move between roots only if the M35 depth invariant remains valid. Promote child back to root if valid.

**ROOT → SUBCATEGORY only. Never a third level.** Destructive delete is not an ordinary admin operation (archive only).

UI: tree/list (e.g. Sofas & Seating → 3-Seater / L-Shaped / Sofa-cum-Beds). Actions: Edit, Reorder, Archive, Reactivate.

---

## 5. Product, inventory, and media admin

### 5.1 Products

`/admin/commerce/products` filters: search name/SKU/`OD-P-*`, category, subcategory, draft/published/archived, featured, ready-stock, made-to-order, zero stock.

List columns: image, name, `OD-P` reference, category/subcategory, status, featured, price range, variant count, available ready-stock count, publication readiness.

Detail `/admin/commerce/products/[id]` tabs:

1. **General** — name, slug, root/subcategory, short/full description, HSN/SAC, tax rate, featured, SEO, shipping/COD/free-shipping overrides  
2. **Variants & price** — SKU, color/finish/size/upholstery, selling + compare-at paise, `ready_stock` / `made_to_order`, active/archive, sort  
3. **Media** — primary, gallery, variant images, alt, reorder, archive/replace, readiness (metadata-only is **not** complete)  
4. **Specifications** — simple key/value  
5. **Related** — manual pairs  
6. **Inventory** — per SKU stock on hand / reserved / available; signed delta + required reason  
7. **Publication** — readiness checklist, publish, archive  

### 5.2 Inventory admin

Super Admin mutation. Filters: zero/low stock, ready-stock, made-to-order, category. No WMS, procurement, or purchase orders.

### 5.3 Media

JPEG/PNG/WebP. Originals private ≤ 20 MiB. Public derivatives ≤ 8 MiB. Finalize remains fail-closed unless both `storage.objects` exist (`COMMERCE_MEDIA_OBJECT_MISSING`). UI must show upload status, derivative generated, primary/gallery/variant binding, alt text, readiness.

---

## 6. Tax and shipping admin

Route: `/admin/commerce/settings`.

Tax rates: code, name, basis points, description, active/inactive, optional product usage count. **No statutory GST percentage is hardcoded or seeded.**

GST-inclusive display: **LOCKED TRUE** for ONEDECORE MVP. Read-only: “GST-inclusive pricing — locked for ONEDECORE MVP”. No disable toggle.

Shipping: default charge, free-shipping threshold, COD enabled global, assembly/install note. Per category/product overrides remain. No courier integration in current MVP.

---

## 7. City / service area admin (owner requirement)

**PINCODE remains checkout/serviceability authority.**

City/service area is:

- admin grouping
- storefront display/filter context
- expansion management

City **active** status alone **never** authorizes delivery. Public pincode checker MUST confirm an exact `commerce_pincodes` row with `serviceable = true`.

### 7.1 Lean model (9D-C implementation only — not this gate)

Forward-only table `public.commerce_service_areas` after certified M35:

- `id`, `name` (e.g. Pune), unique `slug`, `state_name`, nullable `state_code`
- `status` `active | paused | archived`
- `sort_order`, `storefront_visible`
- audit timestamps / `created_by` / `updated_by`

Nullable then-managed FK: `commerce_pincodes.service_area_id`.

Each pincode continues to own: `serviceable`, `zone_code`, `eta_min_days`, `eta_max_days`.

Admin: `/admin/commerce/service-areas` — add/edit city, activate/pause/archive, storefront visibility, sort, pincode counts, manage that city’s pincodes. City detail: add/edit/enable/disable pincode, zone, ETA. Bulk CSV **later only if needed**.

MVP launch city: **Pune**. Future cities (e.g. Mumbai) added from Admin **without code edits**.

**Forbidden:** lat/long, GIS, distance matrix, courier-zone engine.

Migration timestamp is **unreserved** (`NEXT-AVAILABLE-AFTER-CERTIFIED-M35`). Do **not** create it before the 9D-C entry gate. Do **not** call it M36 from this document.

---

## 8. Storefront control from Admin (no page builder)

Do **not** create a CMS/page-builder.

9D-C homepage furniture content:

- **Categories:** active root categories ordered by `sort_order`
- **Featured products:** `commerce_products.featured = true` AND `status = published`, deterministic order (add `featured_rank` later **only if** needed)

Storefront listings driven by category status, `sort_order`, and published products. **No hardcoded product/category lists in source.**

---

## 9. Locked homepage strategy

**One** unified `onedecore.in` homepage. No separate domains. No choose-a-site splash.

Initial balance: **~70% Interiors / ~30% Furniture**.

Journeys remain separate:

- **DESIGN MY HOME** — Full Home Interiors, Modular Kitchen, Wardrobes, Renovation, Portfolio, Consultation  
- **SHOP FURNITURE** — Sofas, Beds, Dining, Tables, Storage, Chairs (labels from **admin** root categories, not hardcoded SKUs)

Structure:

1. Hero — “One Vision. Complete Interiors.” CTA 1 Start Your Interior Project; CTA 2 Shop Furniture  
2. Two journey cards — Plan Your Home / Shop Your Home  
3. Interior services  
4. Furniture categories — admin-driven active roots  
5. Featured furniture — admin-driven published featured products  
6. Portfolio / Real Homes  
7. Why ONEDECORE  
8. Dual CTA — Book Consultation / Shop Furniture  

---

## 10. Phase 9D-C public storefront UX (prepared; not implemented)

**Do not implement until the entry gate in the header.**

Then 9D-C implements:

- `/shop`
- `/shop/c/[slug]`
- `/shop/product/[slug]`
- `/shop/search`

**No checkout** in 9D-C. `/shop/cart` remains **absent or non-functional** until 9D-D. Do **not** fake a working cart. PDP “Add to cart” may be unavailable/coming if cart is deferred.

Shop home: intro, category grid, featured, trust strip, pincode checker (exact pincode row), SEO content.

Category: breadcrumbs, title, short description, product count, filters, sort, responsive grid, SEO.

MVP filters: price, availability, simple option filters (color/finish/size/upholstery) where meaningful. Do not add twenty dimensions.

Sort: featured/default, price low–high, price high–low, newest **if** a reliable timestamp exists. No popularity ranking without evidence.

PDP: gallery, name, **GST-inclusive** selling price, compare-at if valid, variant selector, availability, pincode checker, specs, shipping/assembly note, related, **browser-local** wishlist and recently viewed.

Mobile-first: compact cards, consistent image ratio, usable 2-column mobile grid, sticky PDP purchase hierarchy, large targets, no variant overflow.

SEO (9D-C generates from admin fields): canonical URLs, Product JSON-LD, BreadcrumbList, category metadata, sitemap **published** categories/products only. Draft/archive **not** public.

---

## 11. Subphase reminder (unchanged sequence)

| Gate | This ADR |
| :--- | :--- |
| 9D-B closeout | **Not** this document. Docs-only after M35 managed certification. |
| **9D-C** | Storefront + discovery + service-area admin + homepage furniture from catalogue. **Blocked** until M35 certified + 9D-B closeout merged. |
| 9D-D+ | Cart, checkout, payments per ADR-0030. |

---

## 12. Consequences

- 9D-B admin is the only commerce admin; polish and service areas extend it after the entry gate.
- Pincode remains delivery truth; cities are grouping/display.
- Production `/shop` and payment keys remain Phase 10.
- Catalogue data prepared now (images, copy, tax/shipping/pincodes) is allowed; schema/runtime for 9D-C is not.

---

## Related

- [Preparation audit](../audits/phase-9d-c-commerce-admin-storefront-preparation.md)
- [9D-B implementation](../audits/phase-9d-b-commerce-catalogue-inventory-foundation.md)
- DEC-0089, DEC-0090
