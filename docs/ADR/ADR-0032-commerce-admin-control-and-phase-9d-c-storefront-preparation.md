# ADR-0032 — Commerce Admin Control & Phase 9D-C Storefront Preparation

**Status:** Accepted (**docs only**; **PREPARATION**; **no 9D-C code**; **no M36**; **no `/shop` or `/interiors` runtime**)
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

**Current status (2026-08-23):** those three gates are satisfied. 9D-B is **COMPLETE / CLOSED**. 9D-C is **READY / NEXT**. Canonical current truth: [00-project-truth](../00-project-truth.md) and [M35 closeout](../audits/phase-9d-b-m35-managed-apply-closeout.md). Architectural decisions in this ADR are unchanged.

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

Schema vs existing M35 fields:

- **Items 31 and 34** (serviceable cities/service areas; city/state/zone display data) require the future lean `commerce_service_areas` model (nullable `commerce_pincodes.service_area_id`). That migration is **specified here** and implemented only **after** the 9D-C entry gate — **next available** forward-only timestamp after certified M35; **not created in this gate**; do **not** call it M36; timestamp remains **unreserved**.
- **Item 35** (homepage/storefront featured product selection) uses existing M35 `commerce_products.featured`. No extra page-builder or feature-ordering schema is authorized. Optional `featured_rank` later **only if** evidence shows it is necessary (see §8).
- **Item 36** (store category ordering) uses existing M35 `commerce_categories.sort_order`.

---

## 2. Existing 9D-B admin — keep / build on it

Canonical admin routes (do **not** create a second commerce admin):

- `/admin/commerce`
- `/admin/commerce/categories`
- `/admin/commerce/products`
- `/admin/commerce/products/[id]`
- `/admin/commerce/settings`

After the 9D-C entry gate, **add** `/admin/commerce/service-areas` (and city detail) as an extension of this shell — not a parallel CMS.

RBAC remains ADR-0030 / M35. Canonical codes are exact; do not alias or rename:

| Role | Permissions |
| :--- | :--- |
| Super Admin | `commerce.read`, `commerce.catalog.manage`, `commerce.inventory.manage`, `commerce.orders.manage`, `commerce.payments.read`, `commerce.settings.manage` |
| Sales Manager | `commerce.read`, `commerce.orders.manage`, `commerce.payments.read` |
| All others | none |

Until order/payment phases exist: **do not** show fake functional order/payment management. `commerce.orders.manage` / `commerce.payments.read` stay seeded for later subphases only.

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

**One** unified `onedecore.in` brand. No second domain, subdomain split, splash gateway, or separate ecommerce visual identity. No marketplace-looking homepage.

Brand line remains: **“One Vision. Complete Interiors.”**

**Supersession (DEC-0092 / §9.2):** the §9/§9.1 **~70% Interiors / ~30% Furniture** ratio is superseded by **~60–65% Interiors/Kitchen / ~35–40% Furniture** on root `/`. The §9/§9.1 prohibition on a **separate Interiors homepage** is superseded **only** to authorize dedicated `/interiors` as an Interiors + Kitchen conversion route. This is **not** a separate brand or site. `/shop` remains dedicated commerce. Root `/` remains the unified brand homepage **above** both funnels. All other §9/§9.1 visual, funnel, admin-driven commerce, no-fake-cart, mobile, performance, SEO, and phase locks remain unless directly incompatible with §9.2.

**Supersession (DEC-0093 / §9.3):** three-layer architecture in §9.2 remains. Only root `/` **balance and composition** are refined: perceived **~50/50** Interiors+Kitchens / Furniture; two-journey desktop **50/50**; 16-section root order. Interiors are **not** described as visibly dominant on `/`. Dedicated `/interiors` and `/shop` conversion routes are unchanged.

Journeys remain conversion-separate (routes refined in §9.2):

- **Interiors:** `/` → `/interiors` → Consultation → CRM lead
- **Commerce:** `/` → `/shop` → category/PDP → future cart (9D-D) → future checkout

Never auto-create CRM lead, MARKETING consent, or project from furniture browse. Never put Add to Cart inside interior services. Never use Get Consultation as the primary product-card action.

**Do not implement this homepage in this gate.** Runtime waits for the 9D-C entry sequence (M35 cert + 9D-B closeout merge).

### 9.1 Unified ONEDECORE Homepage Design Lock

Normative 9D-C homepage implementation target. Supporting checklist: [unified homepage design](../design/phase-9d-c-unified-homepage.md).

#### Header / navigation

Desktop: ONEDECORE logo; primary nav **Interiors**, **Modular Kitchen**, **Portfolio**, **Shop Furniture**, **About**; primary CTA **Get Free Consultation**.

Commerce utilities:

- Search icon only once 9D-C shop search exists
- Wishlist icon only once browser-local wishlist exists
- Cart icon **only** when functional cart exists in **9D-D**

Do **not** show a fake/non-functional cart in 9D-C.

Header: compact, premium, sticky after scroll, slightly reduced height after scroll, no clutter. Mobile: logo + menu; search only when implemented; no permanent oversized sticky bar covering content.

#### Hero

Interior-first. High-quality completed ONEDECORE-style residential interior; furniture appears **naturally in the room**. No product cut-out collage, sale banner, or carousel.

- Headline: **ONE VISION. COMPLETE INTERIORS.**
- Support: “Beautiful interiors, modular kitchens and furniture — designed for the way you live.”
- Primary CTA: **Start Your Interior Project**
- Secondary CTA: **Shop Furniture**
- Optional proof: Design • Manufacture • Execute • Furnish

Motion: restrained image scale/parallax, subtle text reveal. No particles, excessive floating text. Minimal motion on mobile.

#### Two-journey section (immediately below hero)

Title: **How would you like to begin?**

| | Plan Your Home | Shop Your Home |
| :--- | :--- | :--- |
| Includes | Full Home Interiors, Modular Kitchens, Wardrobes, Renovation | Sofas, Beds, Dining, Tables, Storage (production labels from admin roots) |
| CTA | Explore Interior Services | Shop Furniture |

Desktop visual weight **~60% Plan / ~40% Shop**. Mobile: stack Plan then Shop. Not a site-selection gateway.

#### Trust strip

Compact: End-to-End Interiors, In-House Manufacturing, Custom Furniture, Quality Control, After-Sales Support. Short labels/icons only.

#### Interior services

Title: **Everything your home needs, under one vision.** Cards: Full Home Interiors, Modular Kitchen, Wardrobes, Renovation, Design Consultation. These remain **service cards**. Never Add to Cart / Buy now here.

#### Modular kitchen feature

Headline: **Designed around the way you cook.** Benefits: custom layouts, machine-finished precision, smart storage, end-to-end installation. CTA **Explore Modular Kitchens**; optional **Get Kitchen Estimate**. Must not be weakened by ecommerce.

#### Furniture category entry

Title: **Furniture for the way you live.** Subtitle: “Thoughtfully selected pieces to complete your ONEDECORE home.”

9D-C source: `commerce_categories` where parent is null, status active, ordered by `sort_order`. **No hardcoded production category list.** Show up to six main roots. Example labels (Sofas, Beds, Dining, Tables, Storage, Chairs) are illustrative only. Mobile: 2-column compact cards. No oversized category cards.

#### Featured furniture

Title: **Featured Furniture.** Source: `commerce_products` with `status = published` and `featured = true`. Price: authoritative variant price, GST-inclusive; valid compare-at if present. Image: active finalized **public derivative** only. Desktop 4–8 max; mobile 4 then View All. Card: image, name, price, availability / made-to-order; wishlist only when 9D-C browser-local wishlist exists. **No fake cart.** CTA **View All Furniture**. Homepage must not become a long product catalogue.

#### Portfolio / Real Homes

Title: **Real homes. Designed and completed by ONEDECORE.** Bridges interiors and furniture visually. Optional: “Love this look? Explore furniture inspired by our interiors.” Portfolio **must not** depend on commerce data.

#### Why ONEDECORE

One team from design to delivery; in-house manufacturing; customisation; quality control; after-sales support. Numeric counters **only** if verified. No fabricated statistics.

#### Interior process

1. Consultation 2. Design 3. Manufacture 4. Installation & Handover. Interior funnel only.

#### Pincode delivery checker

Copy: **Check furniture delivery availability.** Input pincode; CTA **Check Availability**. Authority: exact `commerce_pincodes` row with `serviceable = true`. City is display/grouping only. This interaction must **not** create order, cart, or checkout.

#### Testimonials

Retain existing social proof. Compact slider or grid. Not a very tall mobile section. Furniture/interior labels only when data supports them.

#### Final dual CTA

Headline: **Design your home. Furnish it beautifully.** Primary **Start Your Interior Project**. Secondary **Shop Furniture**.

#### Footer

ONEDECORE (short description, social); INTERIORS (Full Home Interiors, Modular Kitchen, Wardrobes, Renovation, Portfolio); SHOP (admin-driven major categories where practical, Shop All); COMPANY (About, Contact, Privacy, Terms); SUPPORT (Furniture Delivery, Pincode Availability, Consultation, WhatsApp). **Do not** expose Order Tracking until the order phase authorizes it.

#### Visual language

Premium contemporary Indian interiors brand: warm neutrals, ivory/off-white, charcoal, existing ONEDECORE accent used sparingly; high-quality interior photography and clean furniture images; generous but controlled whitespace; refined borders/shadows; elegant headlines; modern readable body. Avoid marketplace styling, ecommerce red/orange sale language, giant discount badges, excessive gradients, too many rounded cards, SaaS dashboard look, over-animation, noisy carousels, or visual split that makes furniture feel like another brand.

#### Mobile length

Homepage must not become excessively long: compact hero; stacked two-journey cards; 2-column furniture categories where usable; max 4 featured products before View All; portfolio preview only; compact testimonials; no huge whitespace; no long homepage FAQ; collapse secondary text where appropriate; keep clear section rhythm.

#### Admin-driven commerce (no page builder)

| Content | Source |
| :--- | :--- |
| Categories | `commerce_categories` parent null, active, `sort_order` |
| Featured | `commerce_products` published + `featured = true` |
| Prices | `commerce_product_variants` |
| Inventory / mode | `commerce_inventory` / availability mode |
| Images | `commerce_product_media` finalized active public derivative |
| SEO | existing category/product SEO fields |

Do **not** hardcode commerce data in homepage source.

#### Performance

Optimized responsive hero; public product derivatives; lazy-load below fold; server-rendered commerce browse where appropriate; minimal client JS; no autoplay hero video; no animation library for trivial transitions; protect Core Web Vitals.

#### SEO

Homepage remains brand authority for Interiors, Modular Kitchens, **and** Furniture — not furniture-only. Internal links: Interiors, Modular Kitchen, Portfolio, Shop, major categories. Product JSON-LD primarily on PDP; BreadcrumbList on category/PDP. Do not overload homepage with product structured data.

#### Locked section order

1. Header
2. Hero
3. Two Journeys
4. Trust Strip
5. Interior Services
6. Modular Kitchen Feature
7. Shop Furniture Categories
8. Featured Furniture
9. Portfolio / Real Homes
10. Why ONEDECORE
11. Interior Process
12. Furniture Pincode Checker
13. Testimonials
14. Final Dual CTA
15. Footer

This order keeps interiors dominant, introduces shop early enough to discover, preserves existing ONEDECORE strengths, limits ecommerce clutter, and keeps mobile scanning manageable.

**§9.1 section order and header labels are superseded for root `/` by §9.2** (interiors preview vs dedicated `/interiors`; kitchen nav as `/interiors#modular-kitchen`; new 15-section root order). Visual language, no-fake-cart, admin-driven category/featured rules, pincode authority, and performance/SEO principles in §9.1 remain.

### 9.2 Owner refinement — three-layer public journey

**Status:** Owner lock **DEC-0092**. Docs only. **9D-C runtime remains blocked** until M35 managed certification and 9D-B closeout merge. Does **not** reopen ADR-0030 or OD9D-1–OD9D-12.

#### What §9.2 supersedes

| Old (§9 / §9.1 / DEC-0091) | New |
| :--- | :--- |
| Root homepage **~70% Interiors / ~30% Furniture** | Root `/` **~60–65% Interiors + Modular Kitchen / ~35–40% Furniture** (hierarchy rule, not pixel math) |
| “No separate interiors homepage” | Dedicated **`/interiors`** is authorized as Interiors + Kitchen conversion. Not a second brand/site/domain |
| Header Kitchen as “Modular Kitchen” without a dedicated interiors route | Header **Interiors** → `/interiors`; **Kitchens** → `/interiors#modular-kitchen` for MVP (no default `/modular-kitchen` page) |
| §9.1 15-section root order (kitchen feature before shop categories) | §9.2 root order below (shop category preview before modular kitchen feature) |

Everything else in §9/§9.1 stays in force unless directly incompatible.

#### Three layers — one brand

```
                    ONEDECORE  (`/`)
                         |
         +---------------+---------------+
         |                               |
    DESIGN HOME                     SHOP HOME
         |                               |
    `/interiors`                       `/shop`
         |                               |
 Consultation / CRM          Browse / PDP / future cart
```

Canonical intent (not mounted on current main):

| Route | Intent |
| :--- | :--- |
| `/` | Mixed brand homepage (above both funnels) |
| `/interiors` | Dedicated Complete Interiors + Modular Kitchen conversion |
| `/portfolio` | Portfolio / Real Homes |
| `/shop` | Furniture ecommerce home |
| `/shop/c/[slug]` | Category |
| `/shop/product/[slug]` | PDP |
| `/shop/search` | Search |
| `/shop/cart`, `/shop/checkout`, `/shop/track` | Later phases (ADR-0030) |

Do **not** create a second domain, subdomain split, interiors-only brand, shop-only brand, or a splash that forces a choice before seeing ONEDECORE.

#### Root `/` — header

ONEDECORE · **Interiors** · **Kitchens** · **Portfolio** · **Shop Furniture** · **About**. Primary CTA **Get Free Consultation**.

- Interiors → `/interiors`
- Kitchens → `/interiors#modular-kitchen` (MVP). Do **not** create `/modular-kitchen` by default.
- Portfolio → `/portfolio`
- Shop Furniture → `/shop`
- About → current public-site canonical About route

Search / wishlist / cart icons: same as §9.1 (no fake cart in 9D-C).

#### Root `/` — hero

Interior-led completed home; furniture in-room, not cutouts. **ONE VISION. COMPLETE INTERIORS.** Support: “Beautiful interiors, modular kitchens and furniture — designed for the way you live.” Primary **Design My Home** → `/interiors` (or consultation UX). Secondary **Shop Furniture** → `/shop`.

#### Root `/` — two journeys

Title: **How would you like to begin?** Desktop **~55–60% Design / ~40–45% Shop**. Mobile: Design then Shop. Not a gateway.

- **Design Your Home** — Complete Home Interiors, Modular Kitchens, Wardrobes, Renovation. CTA **Explore Interiors & Kitchens** → `/interiors`
- **Shop Your Home** — Sofas, Beds, Dining, Tables, Storage, Chairs (admin labels in production). CTA **Shop Furniture** → `/shop`

#### Root `/` — locked section order

1. Header
2. Mixed brand hero
3. Two primary journeys
4. Trust strip
5. Interior + kitchen services **preview** (not the full `/interiors` page)
6. Shop furniture category preview (admin roots, up to 6)
7. Modular kitchen feature (preview / link into `/interiors#modular-kitchen`)
8. Featured furniture (published + `featured`; desktop 4–8; mobile 4 then View All → `/shop`)
9. Portfolio / Real Homes
10. Why ONEDECORE
11. Interior project process
12. Furniture delivery pincode check (`commerce_pincodes.serviceable = true`)
13. Testimonials
14. Final dual CTA
15. Footer

`/` must not become a long catalogue. Interior/kitchen cards preview into `/interiors`. Featured CTA **View All Furniture** → `/shop`. No fake Add to Cart before 9D-D.

#### `/interiors` — dedicated conversion (not a `/` duplicate)

High-conversion Interiors + Modular Kitchens + Wardrobes + Renovation. Primary CTA **Book / Start Free Consultation**. Secondary **View Portfolio**. Ecommerce product grid **not** required. Shop Furniture cross-link allowed but **secondary**.

Recommended order:

1. Compact premium header
2. Interior-first hero
3. Trust / proof
4. Complete Home Interiors
5. Modular Kitchen (major section: layouts, storage, machine-finished precision, hardware/appliances, finishes, installation; CTA Plan My Kitchen / Get Kitchen Estimate)
6. Wardrobes
7. Renovation
8. Why ONEDECORE
9. In-house manufacturing / factory
10. Indicative pricing / existing estimator where appropriate
11. Portfolio / Real Homes
12. Materials / finishes / quality
13. Process
14. Service areas
15. Testimonials
16. Concise FAQ
17. Consultation CTA

**Reuse/reorganize** existing ONEDECORE public strengths; do not delete them. `/` = concise preview; `/interiors` = detailed conversion. Avoid duplicated long copy.

#### `/shop` — dedicated commerce

Same brand system; shopping interaction. Do not duplicate the full interior service page.

Recommended order:

1. Shop header / shared brand nav
2. Shop hero
3. Shop by category
4. Featured furniture
5. Product discovery / curated collection
6. Availability / pincode confidence
7. Furniture quality / support trust strip
8. Recently viewed if browser-local
9. Furniture inspiration / portfolio bridge
10. Footer

Cross-link: “Planning a complete home?” → `/interiors`. Category / PDP / search remain ADR-0030 + §10. No checkout/payment in 9D-C.

#### Design system / mobile / SEO

Shared wordmark, type, neutrals, accent, spacing, buttons, footer. `/interiors` editorial/conversion-led; `/shop` cleaner discovery (not marketplace); `/` bridges both.

Root mobile: compact hero, stacked journeys, concise service preview, 2-col categories, max 4 featured then View All. `/interiors`: strong sections, progressive disclosure, estimator reachable; sticky consult CTA only if it does not obstruct. `/shop`: 2-col grid, compact filters, large targets, no variant overflow.

SEO: `/` broad brand (interiors + kitchens + furniture); `/interiors` service-intent (complete interiors, modular kitchens, wardrobes, Pune); `/shop` commerce; category/PDP transactional. Canonicals match route intent. No identical long sections on `/` and `/interiors`. Product JSON-LD on PDP.

#### 9D-C implementation (after entry gate only)

When authorized: lean service areas + mixed `/` + `/interiors` + `/shop` (+ category/PDP/search) + authorized admin extensions. **Not this PR.**

### 9.3 Owner refinement — balanced mixed homepage

**Status:** Owner lock **DEC-0093**. Docs only. **9D-C runtime remains blocked** until M35 managed certification and 9D-B closeout merge. Does **not** reopen ADR-0030 or OD9D-1–OD9D-12. **No runtime is authorized.**

1. **DEC-0092 three-layer architecture remains in force.** `/` sits above dedicated `/interiors` and dedicated `/shop`. One brand. One domain. No gateway/splash. Kitchens MVP remains `/interiors#modular-kitchen`.
2. **Only root `/` balance/composition is refined.** `/interiors` remains dedicated service conversion. `/shop` remains dedicated commerce.
3. **§9.2's ~60–65 / ~35–40 root ratio is superseded.**
4. **New root target is perceived ~50/50** Interiors + Modular Kitchens / Furniture Ecommerce. Not pixel arithmetic. A visitor must understand within the first screen and first few sections that ONEDECORE both designs/builds interiors and kitchens **and** sells furniture. Neither line should feel secondary on `/`.
5. **§9.2 two-journey ~55–60 / ~40–45 becomes 50/50** desktop visual width and importance. Mobile: Design then Shop, comparable image/copy/CTA/height.
6. **§9.2 15-section root order is superseded** by the 16-section order below.
7. Wording that describes interiors as **visibly dominant** on the root homepage is superseded for `/` only.
8. **No fake cart.** Admin-driven commerce remains. GST-inclusive pricing, pincode exact authority, no page builder, performance/mobile/SEO principles, and 9D-C entry gates remain.

#### Product principle

`/` = brand discovery (not full service page, catalogue, checkout, CRM, or shop listing).
`/interiors` = 100% Interiors + Kitchens service conversion.
`/shop` = 100% furniture ecommerce conversion.

#### Header

ONEDECORE · Interiors → `/interiors` · Kitchens → `/interiors#modular-kitchen` · Portfolio → `/portfolio` · Shop Furniture → `/shop` · About. CTA **Get Free Consultation**. Shop Furniture is a **first-class** nav destination, not a small secondary link. Search / wishlist / cart icons: same as §9.1 (no fake cart in 9D-C).

#### Balanced hero

Premium completed residential scene: designed architecture, interior/kitchen detailing where practical, furniture naturally in-room. No cut-out collage, sale banner, or marketplace styling. Headline may remain **ONE VISION. COMPLETE INTERIORS.** Support must name interiors, modular kitchens, and furniture. Recommended: “Interiors, modular kitchens and furniture — designed together to make your home complete.” CTAs **Design My Home** → `/interiors` and **Shop Furniture** → `/shop` with near-equal prominence (about 50/50 to 55/45 maximum; not 80/20).

#### Two primary journeys — 50/50

Title: **How would you like to begin?** Not a gateway splash.

- **Design Your Home** — Complete Home Interiors, Modular Kitchens, Wardrobes, Renovation. CTA **Explore Interiors & Kitchens** → `/interiors`
- **Shop Your Home** — Sofas, Beds, Dining, Tables, Storage, Chairs (illustrative; production labels from admin). CTA **Shop Furniture** → `/shop`

#### Combined trust strip

Support **both** lines. Preferred concepts (truth-supported only): Design Expertise; In-House Manufacturing; Custom Furniture; Quality Control; Installation Support; After-Sales Support. Must not read as interiors-only.

#### Interiors + kitchen preview

Heading: **Spaces designed around your life.** Cards: Complete Home Interiors, Modular Kitchens, Wardrobes, Renovation — image, short value, link into `/interiors`. CTA **Explore Interiors** → `/interiors`. Not a duplicate of `/interiors`.

#### Furniture category preview — equal visual weight

Heading: **Furniture made for complete homes.** Source: `commerce_categories` parent NULL, active, `sort_order`, up to six roots. Lifestyle/room imagery where valid. No hardcoded production lists. CTA **Explore Furniture** → `/shop`. Visual mass comparable to the interiors preview.

#### Signature bridge — Design it / Furnish it

**DESIGNED BY ONEDECORE** + **FURNISHED BY ONEDECORE**. Center: **Design it. Furnish it. Live it.** Desktop two equal halves (planning/design/materials/manufacturing/installation vs sofas/beds/dining/storage/accent). Brand bridge only — not a catalogue or CRM form.

#### Modular kitchen feature

Heading: **Designed around the way you cook.** Layout, storage, machine-finished precision, hardware/appliances, finishes, installation. CTA **Explore Kitchens** → `/interiors#modular-kitchen`. Balances the following featured-furniture block.

#### Featured furniture — comparable weight

`commerce_products` published + `featured = true`. Desktop **4–6 recommended**, hard max **8**. Mobile max **4** before View All. Card: finalized public image, name, GST-inclusive price, valid compare-at, ready-stock / made-to-order, **View Product**. No fake cart. CTA **View All Furniture** → `/shop`.

#### Real Homes / complete ONEDECORE look

Portfolio as a bridge. Headings such as **Real Homes. Complete ONEDECORE Living.** or **Get the complete ONEDECORE look.** Links **View Project** and **Explore Furniture**. Do **not** claim products are from that project unless real mapping exists. No Shop-the-Look automation in this gate. If unmapped: “Explore furniture inspired by this look.” Portfolio remains independent of commerce data authority.

#### Why ONEDECORE

Heading: **One team. One standard. One complete home.** Balanced pillars: Interior Design + Execution; Modular Kitchen Expertise; In-House Manufacturing; Customisation; Furniture; Quality Control; After-Sales Support. No interiors-only card set. No fabricated stats.

#### Dual process

Replace interior-only process on `/`.

- **Design Your Home:** Consult → Design → Manufacture → Install
- **Shop Your Home:** informational only in 9D-C. Do not imply cart/checkout before 9D-D. Pre-activation safer wording: Browse → Choose → Check Availability → Delivery Flow. Runtime must follow the active phase.

#### Pincode

Heading: **Can we deliver furniture to your home?** Exact `commerce_pincodes` row with `serviceable = true`. No order/cart/checkout. Optional: Planning complete interiors? Book a consultation → `/interiors`.

#### Testimonials

Verified proof only. Interior testimonials may continue. Furniture testimonials only with genuine furniture evidence. Do **not** fabricate furniture reviews to force 50/50. Layout may balance; truth may not.

#### Final 50/50 dual CTA

Heading: **Design your home. Furnish it beautifully.** Equal panels: Design (Start Your Interior Project → `/interiors`) and Shop (Shop Furniture → `/shop`). Desktop 50/50. Mobile stacked, comparable height.

#### Locked 16-section root `/` order

1. Header
2. Balanced mixed hero
3. 50/50 two primary journeys
4. Combined trust strip
5. Interiors + kitchen preview
6. Furniture category preview
7. Design it / Furnish it signature bridge
8. Modular kitchen feature
9. Featured furniture
10. Real Homes / complete ONEDECORE look
11. Why ONEDECORE
12. Dual process — design journey + shopping journey
13. Furniture pincode checker
14. Testimonials
15. Final 50/50 dual CTA
16. Footer

#### Perceived balance (not identical blocks)

Evaluate: first view (both offers + both CTAs); first three sections (both journeys equal); comparable major conversion sections; comparable image mass (ecommerce not tiny vs full-width interiors); recurring interior and shop CTAs; first-class Shop Furniture nav; mobile furniture not pushed so far that ONEDECORE reads interiors-only; copy naturally includes design + furniture. Do not force mathematical equality if it harms UX. Do not create a huge scroll just to hit 50/50. Depth lives on `/interiors` and `/shop`.

#### Mobile / performance / SEO

Compact hero; stacked journeys; 2-col category grid; compact service preview; max 4 featured before View All; concise bridge; compact trust and testimonials; portfolio preview not full listing; no long homepage FAQ. Responsive hero; optimized/public derivatives; lazy below-fold; minimal client JS; no autoplay hero video; no trivia animation library; Core Web Vitals. `/` broad brand (interiors + kitchens + furniture). `/interiors` service-intent. `/shop` commerce. Category/PDP transactional. No identical long copy. Product JSON-LD on PDP.

---

## 10. Phase 9D-C public storefront UX (prepared; not implemented)


**Do not implement until the entry gate in the header.**

Then 9D-C implements:

- mixed brand `/` (balance/composition in §9.3; three-layer routes in §9.2)
- `/interiors` (dedicated interiors + kitchen conversion)
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
| **9D-C** | Balanced mixed `/` (§9.3) + `/interiors` + `/shop` discovery + service-area admin + catalogue-driven furniture previews. **Blocked** until M35 certified + 9D-B closeout merged. |
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
- [Unified homepage design](../design/phase-9d-c-unified-homepage.md)
- [Three-layer public site](../design/phase-9d-c-three-layer-public-site.md)
- [9D-B implementation](../audits/phase-9d-b-commerce-catalogue-inventory-foundation.md)
- DEC-0089, DEC-0090, DEC-0091, DEC-0092, DEC-0093
