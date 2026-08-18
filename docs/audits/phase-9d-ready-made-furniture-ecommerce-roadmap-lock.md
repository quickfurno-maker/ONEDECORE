# Phase 9D — Ready-Made Furniture E-commerce (Roadmap Lock)

**Status:** ROADMAP LOCKED — **implementation NOT STARTED**
**Date:** August 17, 2026
**Governance:** docs only; no schema, storage, public `/shop` runtime, admin commerce routes, or payment provider wiring
**Architecture:** ADR-0028 / DEC-0079 / OD9D-1–OD9D-12
**Placement:** after Phase 9C, before Phase 10
**Current formal work:** Phase 9B is next (**NOT_STARTED**). Phase 9A is **COMPLETE**. Phase 9D remains **ROADMAP_LOCKED** — do **not** start 9D implementation in this docs gate.

---

## Canonical sequence

```
9A Campaign Consent, Audience & Approval     COMPLETE
    ↓
9B Landing Page Lab                          NEXT FORMAL IMPLEMENTATION (NOT STARTED)
    ↓
9C Campaign Execution, Attribution & Feedback
    ↓
9D Ready-Made Furniture E-commerce           ROADMAP LOCKED / NOT STARTED
    ↓
10 Final Security, E2E, Performance & Production Launch
```

Next Phase 9D gate after 9A–9C: **`PHASE_9D_ENTRY_AUDIT`** (9D-A). No database implementation before that audit and architecture freeze.

---

## Goal

Build a beautiful, premium, mobile-first ready-made furniture store inside ONEDECORE.

Canonical flow:

`Shop → Category → Product → Variant → Cart → Checkout → Payment/COD → Order → Tracking`

Main site remains interior-design-led. Full commerce lives under `/shop`. Homepage/nav may later add Shop Furniture, Featured Products, New Arrivals, and View Shop CTA only.

---

## Owner locks (OD9D-1–OD9D-12)

| Lock | Decision |
| :--- | :--- |
| **OD9D-1** | Category-based ready-made furniture only. **No** Shop by Room, Shop the Look, room packages, or interior packages. |
| **OD9D-2** | Dynamic admin-managed categories/subcategories. Taxonomy is **not** permanently hard-coded. |
| **OD9D-3** | Guest checkout is first-class. Customer account is **not** required for MVP. |
| **OD9D-4** | Ready-made products + simple variants (color/finish/size/upholstery). **No** parametric custom-furniture configurator. |
| **OD9D-5** | Supabase is authoritative for catalogue, inventory, orders, and payment state. Browser totals are never authoritative. |
| **OD9D-6** | Order item, delivery address, price, tax, and discount snapshots are immutable after commit. |
| **OD9D-7** | COD + online payment. Provider webhook/server verification is authoritative for online success. Browser redirect is not. No payment secrets in the browser. |
| **OD9D-8** | Simple single-pool sellable SKU/variant inventory. **No** multi-warehouse, WMS, procurement, or supplier platform. Database must still prevent invalid overselling. |
| **OD9D-9** | Use the existing ONEDECORE admin shell (`/admin/commerce…`). **No** separate commerce admin product. |
| **OD9D-10** | WhatsApp “Need Help?” is support only — **not** order, payment, or inventory truth. Marketing remains Phase 9A/9C consent/execution rules. |
| **OD9D-11** | No ERP / accounting / procurement / warehouse expansion. Commerce SKU stock is **not** a warehouse ERP. |
| **OD9D-12** | Phase 10 remains the final global production activation gate. |

DEC-0014 / ADR-0005 No-ERP warehouse/procurement/accounting exclusions remain. Phase 9D adds **bounded ready-made SKU stock** for the storefront only.

---

## Category-first commerce

- Primary public route: `/shop`.
- Categories are dynamic and admin-managed (create/edit/reorder, activate/deactivate, subcategories, move products, SEO metadata).
- Initial **examples** only (not frozen taxonomy): Sofas, Beds, Dining, Chairs, Tables, TV Units, Storage, Office Furniture.

## Product foundation

Every product supports UUID, stable product reference, name, slug, SKU, category/subcategory, Draft / Published / Archived, short/long description, highlights, specifications, dimensions, material, finish/color, optional weight, warranty, assembly, care, ready-stock / made-to-order, dispatch estimate, delivery information, MRP/regular where applicable, selling price, optional sale price, tax metadata, and badges (featured/new/best-seller/quick-delivery/premium/sale).

Never delete historical products referenced by orders.

## Simple variants

Color, finish, size, upholstery/fabric. Variant may have own SKU, price override, stock, availability, image, dimension/weight override. **No** unlimited parametric configurator.

## Media

Multiple HD images: primary, front, side, rear, close-up, lifestyle, dimension diagram, variant image. Admin reorder. Public PDP zoom + mobile swipe.

**Not MVP:** video, 360, AR/3D.

## Listing, search, PDP

- Desktop 3–4 premium cards/row; mobile 2 compact cards where usable.
- Cards: large image, name, category/material hint, price, discount badge, wishlist, availability, variant indicator, View Product / Quick Add where safe.
- Filters: category/subcategory, price, material, color/finish, size, availability, ready stock / made to order, optional discount.
- Sort: featured, newest, price low-high, price high-low; best selling **only** when real sales data exists.
- Search: `/shop/search` — database-backed over name, SKU, category, material, finish/color, useful keywords. No AI/vector search for MVP.
- PDP: `/shop/product/[slug]` — gallery, zoom, title, SKU, category, price, variants, selected stock, quantity, Add to Cart, Buy Now, wishlist, pincode check, dispatch, COD availability, warranty, assembly, dimensions + dimension image, specs, description, care, delivery/returns summary, similar/related, sticky mobile CTA recommended. **No fake scarcity.**

Admin-managed key/value specifications (material, finish, W×D×H, warranty, assembly, etc.).

## Inventory (simple)

Per sellable SKU/variant: quantity, in stock / out of stock / made to order, optional low-stock threshold. Database-authoritative allocation so two simultaneous checkouts cannot silently oversell the last unit. **Not** a warehouse reservation platform. Allocation model chosen in 9D-A.

## Pincode / shipping

PDP checker: serviceable yes/no, estimated delivery, shipping cost / free shipping, assembly/install where relevant. V1: standard charge, free-shipping threshold, product/category override, configured pincode/zone model. **No** complex courier aggregator in MVP.

## Wishlist / recently viewed

Wishlist required. Guest may use browser persistence; signed-in sync may use Supabase later. Wishlist never reserves inventory. Recently viewed is lightweight browser-side and must not delay MVP.

## Cart, Buy Now, checkout

Persistent cart with add/remove, quantity, variant, subtotal, discount, shipping, tax, total, checkout CTA. Server revalidates before checkout: published status, active variant, stock, current price, shipping, discount, tax.

Buy Now uses the **same** checkout/order engine.

Guest checkout is first-class. Required delivery data: name, mobile, email as business chooses, address, locality, city, state, pincode. Safe reuse/linkage with CRM identity is a **9D-A** decision.

Checkout: Customer + Delivery → Review → Payment → Confirmation. Authoritative server revalidation before order commit.

## Payment

MVP: COD + Online Payment. **Provider is not locked** — choose during 9D-A. Provider-independent architecture required.

Online success: verified webhook/server is authoritative. Browser success page is not. No card secrets stored. Payment record is separate (order, provider, method, provider refs, amount, currency, status, verified timestamp, bounded failure code). Webhook verified, idempotent, replay-safe.

COD: admin global enable/disable, product/category override, optional maximum order amount. No complex fraud engine for MVP.

## Orders

Recommended reference `OD-O-{YYYY}-{SEQ6}` (UUID PK). Lifecycle: `pending_payment` → `confirmed` → `processing` → `shipped` → `delivered`. Exceptions: `payment_failed`, `cancelled`. No ERP-grade fulfilment machine.

Immutable order-item snapshot (product/variant identity, names, SKU, options, image ref, prices, discount, tax, qty, line total). Immutable delivery snapshot. Later catalogue or profile edits never rewrite history.

Confirmation shows order number, items, amount, payment status, address, estimated delivery, support contact.

Guest tracking: Order Number + Mobile. Show permitted states. Do not expose full order PII without successful identity match.

Customer account (My Orders, synced wishlist, saved addresses, profile) is **not** MVP. Guest remains first-class.

## Coupons / returns (schedule)

Optional simple V1 coupons (percentage/fixed, min cart, validity, one per order, no stacking) if schedule permits; otherwise post-MVP 9D enhancement.

MVP cancellation: admin-controlled + customer request; manual support workflow allowed. **Not MVP:** full returns portal, reverse logistics, automatic refunds, exchange workflow.

## Admin

Existing shell. Possible routes: `/admin/commerce`, `/categories`, `/products`, `/orders`. Staff manage catalogue, media, price/sale/stock, shipping/COD overrides, publish/archive, orders, payment/fulfilment states, tracking reference, cancellation.

## SEO / analytics / related

MVP SEO: category and product slug, title, meta, canonical, indexing controls, alt text, Product structured data (SKU, price, currency, availability, variant metadata), sitemap, robots safety.

Provider-neutral analytics events (not source of truth): product_view, category_view, search, add_to_wishlist, add_to_cart, remove_from_cart, begin_checkout, purchase.

Related: Similar / Related / Frequently Bought Together — **manual** admin relationships. No AI recommendations.

Product compare (up to 3) is useful but secondary; may defer.

---

## Explicit MVP exclusions

Do **not** build: room-wise shopping, Shop by Room, room packages, interior bundles, custom interior quotation ecommerce, marketplace vendors/seller dashboard/commissions, procurement, supplier platform, WMS, accounting, ERP, multiple warehouses, loyalty, gift cards, subscription commerce, advanced returns, automated refunds, dynamic pricing, complex coupons, AI recommendations/visual search, AR, 3D configurator, parametric custom-size furniture, real-time courier aggregator, autonomous Kriti order/payment actions.

---

## Subphases (not started)

| Subphase | Purpose |
| :--- | :--- |
| **9D-A** | Entry audit + architecture freeze (domains, routes, CRM identity overlap, quotation/payment collisions, storage, SEO, RBAC, tax, payment provider, shipping, order/inventory). Output: ADR refinements + owner locks + migration plan. **NO implementation.** |
| **9D-B** | Catalogue + admin foundation |
| **9D-C** | Storefront + discovery |
| **9D-D** | Cart + checkout + orders (COD) |
| **9D-E** | Online payment + order operations |
| **9D-F** | SEO + E2E + performance certification |

Phase 10 remains final production activation.

---

## Deferred to 9D-A (must not invent now)

- Payment provider selection
- CRM contact/lead linkage for guest checkout
- Exact inventory allocation/locking model
- Tax configuration reuse vs commerce-specific tax
- Shipping zone/pincode data model
- Commerce RBAC permission codes
- Coupon inclusion in MVP vs post-MVP
- Compare-feature timing
- Storage bucket design for product media

---

## Success (after implementation + Phase 10 activation)

Customers can browse, search/filter/sort, open PDP, choose variant, see price/stock/delivery, wishlist, cart, Buy Now, guest checkout, pay online or COD, receive order reference, track order.

Staff can manage categories/products/variants/media/prices/stock, publish/archive, manage orders, inspect payment state, update permitted fulfilment states.

System guarantees: no browser-authoritative pricing; no silent oversell; no historical order mutation from catalogue edits; no online success from redirect alone; no provider secrets client-side; no room-wise commerce; no marketplace; no ERP; no Phase 9A consent bypass; no premature production activation.

---

## This packet does not

- Create migrations or tables
- Create `/shop` or `/admin/commerce` runtime
- Select a payment provider
- Start Phase 9B or 9C implementation
- Alter M31
- Activate production or public intake
