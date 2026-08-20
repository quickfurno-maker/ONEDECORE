# Unified ONEDECORE Homepage — Design Checklist

**Status:** Supporting (non-authority). **Authority:** [ADR-0032 §9.3](../ADR/ADR-0032-commerce-admin-control-and-phase-9d-c-storefront-preparation.md) for root `/` balance and 16-section order; [§9.2](../ADR/ADR-0032-commerce-admin-control-and-phase-9d-c-storefront-preparation.md) for three-layer routes; [§9.1](../ADR/ADR-0032-commerce-admin-control-and-phase-9d-c-storefront-preparation.md) for visual language unless superseded. DEC-0093 supersedes DEC-0092 on root ratio, two-journey weight, and root section order only.
**Date:** 2026-08-20
**Scope:** Docs only. No homepage runtime. No `/interiors`. No `/shop`. No 9D-C code.

This file is a compact checklist for **root `/`** after M35 managed certification and 9D-B closeout merge. Three-layer IA: [three-layer public site](phase-9d-c-three-layer-public-site.md). If this file and ADR-0032 ever differ, **ADR-0032 wins**.

## Brand

- One premium brand; root `/` perceived **~50/50** Interiors+Kitchens / Furniture
- `/` is brand discovery; `/interiors` and `/shop` hold conversion depth
- Tagline: One Vision. Complete Interiors.
- No splash chooser, no second visual identity, no marketplace sale language
- Shop Furniture is a first-class header destination

## Locked section order (root `/`)

1. Header — Interiors (`/interiors`), Kitchens (`/interiors#modular-kitchen`), Portfolio, Shop Furniture (`/shop`), About; Get Free Consultation. No fake cart (9D-C).
2. Balanced mixed hero — completed home with furniture in-room; support names interiors + kitchens + furniture; Design My Home / Shop Furniture near-equal (50/50–55/45 max)
3. 50/50 Two Journeys — How would you like to begin? Equal desktop width
4. Combined Trust Strip — both business lines; truth-supported only
5. Interiors + kitchen preview — Spaces designed around your life. CTA Explore Interiors → `/interiors`
6. Furniture category preview — Furniture made for complete homes. Admin roots, up to 6, comparable visual mass. CTA Explore Furniture → `/shop`
7. Design it / Furnish it signature bridge — not a catalogue or CRM form
8. Modular Kitchen Feature — Explore Kitchens → `/interiors#modular-kitchen`
9. Featured Furniture — published + `featured`; GST-inclusive; desktop 4–6 recommended, max 8; mobile max 4 then View All → `/shop`; View Product; no fake cart
10. Real Homes / complete ONEDECORE look — portfolio independent; no false product-project claims
11. Why ONEDECORE — One team. One standard. One complete home. No fabricated stats
12. Dual process — Design: Consult → Design → Manufacture → Install. Shop informational (no implied checkout before 9D-D)
13. Furniture Pincode Checker — exact `commerce_pincodes.serviceable = true`
14. Testimonials — verified only; do not fabricate furniture reviews
15. Final 50/50 Dual CTA — Design your home. Furnish it beautifully.
16. Footer — no Order Tracking until order phase

## Mobile length

Scan-friendly. Compact hero; stacked comparable journeys; 2-col categories; 4 featured then View All; concise bridge; compact trust/testimonials; portfolio preview; no long FAQ; no huge scroll just to hit 50/50.

## Performance / SEO

Responsive hero; lazy below-fold; no autoplay video; no animation library for trivia; `/` SEO is broad brand; detailed service copy on `/interiors`; commerce copy on `/shop`; Product JSON-LD on PDP not homepage dump.
