# Three-layer public site — `/` · `/interiors` · `/shop`

**Status:** Supporting (non-authority). **Authority:** [ADR-0032 §9.2](../ADR/ADR-0032-commerce-admin-control-and-phase-9d-c-storefront-preparation.md) / DEC-0092
**Date:** 2026-08-20
**Scope:** Docs only. No runtime. No `/interiors`. No `/shop`. No homepage rewrite. No 9D-C code.

If this file and ADR-0032 ever differ, **ADR-0032 wins**. Visual language and no-fake-cart rules in §9.1 remain except where §9.2 supersedes them. Compact `/` checklist: [unified homepage](phase-9d-c-unified-homepage.md).

## One brand

Not three sites. Root `/` sits **above** both funnels.

- `/` — mixed brand homepage (~60–65% Interiors/Kitchen, ~35–40% Furniture)
- `/interiors` — dedicated Interiors + Modular Kitchen conversion
- `/shop` — dedicated furniture storefront

No splash gateway. No second domain or brand.

## Header (desktop)

ONEDECORE · Interiors → `/interiors` · Kitchens → `/interiors#modular-kitchen` (MVP; no default `/modular-kitchen`) · Portfolio → `/portfolio` · Shop Furniture → `/shop` · About. CTA: Get Free Consultation. No fake cart in 9D-C.

## Root `/` section order

1. Header
2. Mixed brand hero
3. Two primary journeys
4. Trust strip
5. Interior + kitchen services preview
6. Shop furniture category preview
7. Modular kitchen feature
8. Featured furniture
9. Portfolio / Real Homes
10. Why ONEDECORE
11. Interior project process
12. Furniture delivery pincode check
13. Testimonials
14. Final dual CTA
15. Footer

## `/interiors` section order

1. Compact header
2. Interior-first hero
3. Trust / proof
4. Complete Home Interiors
5. Modular Kitchen (major)
6. Wardrobes
7. Renovation
8. Why ONEDECORE
9. In-house manufacturing
10. Indicative pricing / estimator
11. Portfolio / Real Homes
12. Materials / finishes
13. Process
14. Service areas
15. Testimonials
16. Concise FAQ
17. Consultation CTA

Primary: Book / Start Free Consultation. Secondary: View Portfolio. Shop link secondary. No product grid required.

## `/shop` section order

1. Shop header / shared nav
2. Shop hero
3. Shop by category
4. Featured furniture
5. Product discovery
6. Availability / pincode
7. Furniture trust strip
8. Recently viewed (if local)
9. Inspiration / portfolio bridge
10. Footer

Cross-link: Planning a complete home? → `/interiors`. Category / PDP / search unchanged (ADR-0030). No checkout in 9D-C.

## Funnels

Interiors: `/` → `/interiors` → Consultation → CRM.
Commerce: `/` → `/shop` → category/PDP → future cart.
No CRM / MARKETING / project from furniture browse. Interior cards never Add to Cart. Product cards never lead with consultation.

## Admin commerce on `/` and `/shop`

Root categories: `commerce_categories` parent NULL, active, `sort_order`, up to 6.
Featured: `commerce_products` published + `featured = true`. GST-inclusive variant price. Finalized public media.
