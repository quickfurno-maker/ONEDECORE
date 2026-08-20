# Three-layer public site — `/` · `/interiors` · `/shop`

**Status:** Supporting (non-authority). **Authority:** [ADR-0032 §9.2](../ADR/ADR-0032-commerce-admin-control-and-phase-9d-c-storefront-preparation.md) / DEC-0092 for layers; [§9.3](../ADR/ADR-0032-commerce-admin-control-and-phase-9d-c-storefront-preparation.md) / DEC-0093 for root `/` 50/50 composition.
**Date:** 2026-08-20
**Scope:** Docs only. No runtime. No `/interiors`. No `/shop`. No homepage rewrite. No 9D-C code.

If this file and ADR-0032 ever differ, **ADR-0032 wins**. Compact `/` checklist: [unified homepage](phase-9d-c-unified-homepage.md).

## One brand

Not three sites. Root `/` sits **above** both funnels.

- `/` — brand discovery; perceived **~50/50** Interiors+Kitchens / Furniture
- `/interiors` — 100% Interiors + Modular Kitchen conversion
- `/shop` — 100% furniture storefront

No splash gateway. No second domain or brand.

## Header (desktop)

ONEDECORE · Interiors → `/interiors` · Kitchens → `/interiors#modular-kitchen` (MVP; no default `/modular-kitchen`) · Portfolio → `/portfolio` · Shop Furniture → `/shop` (first-class) · About. CTA: Get Free Consultation. No fake cart in 9D-C.

## Root `/` section order (DEC-0093)

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
12. Dual process — design + shopping (shopping informational in 9D-C)
13. Furniture pincode checker
14. Testimonials
15. Final 50/50 dual CTA
16. Footer

## `/interiors` section order

Unchanged from §9.2: compact header; interior-first hero; trust; complete interiors; major modular kitchen; wardrobes; renovation; Why; factory; estimator; portfolio; materials; process; service areas; testimonials; FAQ; consultation CTA.

Primary: Book / Start Free Consultation. Secondary: View Portfolio. Shop link secondary. No product grid required.

## `/shop` section order

Unchanged from §9.2: shop header/nav; shop hero; categories; featured; discovery; pincode; furniture trust; recently viewed if local; inspiration/portfolio bridge; footer.

Cross-link: Planning a complete home? → `/interiors`. Category / PDP / search unchanged (ADR-0030). No checkout in 9D-C.

## Funnels

Interiors: `/` → `/interiors` → Consultation → CRM.
Commerce: `/` → `/shop` → category/PDP → future cart.
No CRM / MARKETING / project from furniture browse. Interior cards never Add to Cart. Product cards never lead with consultation.

## Admin commerce on `/` and `/shop`

Root categories: `commerce_categories` parent NULL, active, `sort_order`, up to 6.
Featured: `commerce_products` published + `featured = true`. GST-inclusive variant price. Finalized public media.
