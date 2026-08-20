# Unified ONEDECORE Homepage — Design Checklist

**Status:** Supporting (non-authority). **Authority:** [ADR-0032 §9.1](../ADR/ADR-0032-commerce-admin-control-and-phase-9d-c-storefront-preparation.md) / DEC-0091  
**Date:** 2026-08-20  
**Scope:** Docs only. No homepage runtime. No `/shop`. No 9D-C code.

This file is a compact checklist for 9D-C implementation **after** M35 managed certification and 9D-B closeout merge. If this file and ADR-0032 ever differ, **ADR-0032 wins**.

## Brand

- One premium brand; ~70% interiors / ~30% furniture
- Tagline: One Vision. Complete Interiors.
- No splash chooser, no second visual identity, no marketplace sale language

## Locked section order

1. Header — Interiors, Modular Kitchen, Portfolio, Shop Furniture, About; Get Free Consultation. No fake cart (9D-C). Cart icon only in 9D-D.
2. Hero — interior photography; dual CTA Start Your Interior Project / Shop Furniture
3. Two Journeys — How would you like to begin? Plan (~60% desktop) then Shop (~40%)
4. Trust Strip — five short proof labels
5. Interior Services — service cards only; never Add to Cart
6. Modular Kitchen Feature — keep as major interior conversion
7. Shop Furniture Categories — active roots, `sort_order`, max six, admin labels
8. Featured Furniture — published + `featured`; GST-inclusive price; finalized public derivative; mobile max 4 then View All; no fake cart
9. Portfolio / Real Homes — not commerce-dependent
10. Why ONEDECORE — no fabricated stats
11. Interior Process — Consultation → Design → Manufacture → Installation & Handover
12. Furniture Pincode Checker — exact `commerce_pincodes.serviceable = true`; no order/cart/checkout
13. Testimonials — compact
14. Final Dual CTA — Design your home. Furnish it beautifully.
15. Footer — no Order Tracking until order phase

## Mobile length

Compact hero; stacked journeys; 2-col categories; 4 featured then View All; portfolio preview; compact testimonials; no long FAQ; no huge whitespace.

## Performance / SEO

Responsive hero; lazy below-fold; no autoplay video; no animation library for trivia; homepage SEO covers interiors + kitchens + furniture; Product JSON-LD on PDP not homepage dump.
