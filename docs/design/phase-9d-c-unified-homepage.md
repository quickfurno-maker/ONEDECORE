# Unified ONEDECORE Homepage — Design Checklist

**Status:** Supporting (non-authority). **Authority:** [ADR-0032 §9.2](../ADR/ADR-0032-commerce-admin-control-and-phase-9d-c-storefront-preparation.md) for journey architecture; [§9.1](../ADR/ADR-0032-commerce-admin-control-and-phase-9d-c-storefront-preparation.md) for visual language unless superseded. DEC-0092 supersedes DEC-0091 on ratio, `/interiors` route, header Kitchen target, and root section order.
**Date:** 2026-08-20
**Scope:** Docs only. No homepage runtime. No `/interiors`. No `/shop`. No 9D-C code.

This file is a compact checklist for **root `/`** after M35 managed certification and 9D-B closeout merge. Three-layer IA: [three-layer public site](phase-9d-c-three-layer-public-site.md). If this file and ADR-0032 ever differ, **ADR-0032 wins**.

## Brand

- One premium brand; root `/` ~60–65% interiors/kitchen / ~35–40% furniture
- Tagline: One Vision. Complete Interiors.
- No splash chooser, no second visual identity, no marketplace sale language
- Dedicated `/interiors` conversion page is authorized; it is not a second site

## Locked section order (root `/`)

1. Header — Interiors (`/interiors`), Kitchens (`/interiors#modular-kitchen`), Portfolio, Shop Furniture (`/shop`), About; Get Free Consultation. No fake cart (9D-C). Cart icon only in 9D-D.
2. Mixed brand hero — interior photography with furniture in-room; Design My Home / Shop Furniture
3. Two Journeys — How would you like to begin? Design (~55–60% desktop) then Shop (~40–45%)
4. Trust Strip — five short proof labels
5. Interior + kitchen services **preview** — cards into `/interiors`; never Add to Cart
6. Shop Furniture Categories — active roots, `sort_order`, max six, admin labels
7. Modular Kitchen Feature — preview / link to `/interiors#modular-kitchen`
8. Featured Furniture — published + `featured`; GST-inclusive price; finalized public derivative; desktop 4–8; mobile max 4 then View All → `/shop`; no fake cart
9. Portfolio / Real Homes — not commerce-dependent
10. Why ONEDECORE — no fabricated stats
11. Interior Process — Consultation → Design → Manufacture → Installation & Handover
12. Furniture Pincode Checker — exact `commerce_pincodes.serviceable = true`; no order/cart/checkout
13. Testimonials — compact
14. Final Dual CTA — Design your home. Furnish it beautifully.
15. Footer — no Order Tracking until order phase

## Mobile length

Compact hero; stacked journeys; concise service preview; 2-col categories; 4 featured then View All; portfolio preview; compact testimonials; no long FAQ; no huge whitespace.

## Performance / SEO

Responsive hero; lazy below-fold; no autoplay video; no animation library for trivia; `/` SEO is broad brand (interiors + kitchens + furniture); detailed service copy lives on `/interiors`; Product JSON-LD on PDP not homepage dump.
