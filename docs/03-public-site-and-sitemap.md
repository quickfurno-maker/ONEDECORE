# 03 — PUBLIC WEBSITE SITEMAP AND INFORMATION ARCHITECTURE

**Document Status:** Locked Sitemap Baseline (truth-synced through Phase 9B architecture freeze, August 18, 2026)
**Scope:** Public Marketing Pages & Route Ownership  
**Target Market:** Pune, India  

---

## 1. Route Sitemap Matrix

| Proposed URL | Primary Purpose | Primary CTA | Access Status | Phase |
| :--- | :--- | :--- | :--- | :--- |
| `/` | Brand flagship landing, signature project highlights | Book Consultation | Public | Phase 4 |
| `/about` | Company history, design philosophy, Pune presence | View Portfolio | Public | Phase 6 |
| `/services` | Core service overview & design approach | Explore Services | Public | Phase 6 |
| `/services/complete-home-interiors` | Full home transformation service details | Book Consultation | Public | Phase 6 |
| `/services/modular-kitchens` | Modular kitchen layouts, hardware, finishes | Request Kitchen Quote | Public | Phase 6 |
| `/services/custom-wardrobes` | Custom wardrobes, walk-in closets, storage | Request Wardrobe Quote | Public | Phase 6 |
| `/portfolio` | Dedicated portfolio listing & room tag filters | Filter Projects | Public | Phase 5 |
| `/portfolio/[slug]` | Individual project case study details | Inquire About This Style | Public | Phase 5 |
| `/process` | 4-step architectural execution narrative | Schedule Site Visit | Public | Phase 6 |
| `/craftsmanship` | Premium materials, hardware, factory precision | Book Studio Consultation | Public | Phase 6 |
| `/testimonials` | Verified client stories & video reviews | Read Case Studies | Public | Phase 6 |
| `/contact` | Pune office address, phone, contact form | Send Message | Public | Phase 6 |
| `/consultation` | Dedicated lead capture booking experience | Submit Booking | Public | Phase 4 |
| `/pune/[location]` | Geo-targeted SEO pages (Koregaon Park, Baner, etc.) | Book Pune Consultation | Public | Phase 6 |
| `/privacy` | Data protection & WhatsApp consent policy | Read Policy | Public | Phase 6 |
| `/terms` | Website terms of service | Read Terms | Public | Phase 6 |
| `/login` | Staff authentication portal | Sign In | Public (Auth) | Phase 2 |
| `/admin/*` | Internal CRM portal (leads, quotes, portfolio CMS) | Administrative Controls | Role-Restricted | Phase 7 |
| `/shop` | Ready-made furniture category store | Browse Shop | Planned public | Phase 9D (ADR-0030 freeze; not implemented) |
| `/shop/c/[slug]` | Category / subcategory listing | View products | Planned public | Phase 9D |
| `/shop/search` | Catalogue search | Find products | Planned public | Phase 9D |
| `/shop/product/[slug]` | Product detail | Add to Cart / Buy Now | Planned public | Phase 9D |
| `/shop/cart` | Cart | Checkout | Planned public | Phase 9D |
| `/shop/checkout` | Guest checkout | Place order | Planned public | Phase 9D |
| `/shop/track` | Guest order lookup (order number + mobile) | View order | Planned public | Phase 9D |
| `/shop/order/[orderReference]` | Order status after successful guest match | Track order | Planned public | Phase 9D |
| `/admin/commerce*` | Catalogue and order operations | Manage store | Planned staff | Phase 9D |

---

## 2. Homepage Information Architecture

The homepage is designed as an architectural storytelling experience. It showcases **only selected signature projects** (where `is_featured = true`) and does not replace the dedicated `/portfolio` page.

```
┌──────────────────────────────────────────────────────────┐
│ 1. Hero Section (Cinematic Visuals & Booking CTA)        │
├──────────────────────────────────────────────────────────┤
│ 2. Brand Positioning ("One Vision. Complete Interiors.") │
├──────────────────────────────────────────────────────────┤
│ 3. Signature Projects Showcase (Curated 3-4 Highlights)  │
├──────────────────────────────────────────────────────────┤
│ 4. Core Services Grid (Full Home, Kitchens, Wardrobes)   │
├──────────────────────────────────────────────────────────┤
│ 5. Execution Process (4-Step Editorial Narrative)        │
├──────────────────────────────────────────────────────────┤
│ 6. Materials & Craftsmanship Spotlight                   │
├──────────────────────────────────────────────────────────┤
│ 7. Verified Client Stories & Case Study Excerpts         │
├──────────────────────────────────────────────────────────┤
│ 8. Consultation Booking Form (Form + WhatsApp Opt-In)    │
├──────────────────────────────────────────────────────────┤
│ 9. Footer & Pune Locality Trust Signals                  │
└──────────────────────────────────────────────────────────┘
```

---

## 3. SEO & Structured Data Strategy

- **Truthful Schemas Only:** Uses `Organization`, `LocalBusiness` / `HomeAndConstructionBusiness` (once physical details are verified by owner), `Service`, `CreativeWork`, `ImageObject`, `VideoObject`, and `BreadcrumbList`. Non-standard types such as `InteriorDesign` are prohibited.
- **Dynamic OpenGraph:** Automated meta tags and social preview images generated for all public pages and portfolio case studies.
- **Geo-Targeted Landing Pages:** Localized URL paths (`/pune/baner`, `/pune/koregaon-park`, `/pune/wakad`) optimized for high-intent Pune search queries.

---

## 4. Related Governance Documents

- [Product Requirements](01-product-requirements.md)
- [Portfolio Architecture](04-portfolio-architecture.md)
- [ADR-0006: Public and Admin Route Separation](ADR/ADR-0006-public-and-admin-route-separation.md)
- [ADR-0028: Phase 9D Ready-Made Furniture E-commerce](ADR/ADR-0028-phase-9d-ready-made-furniture-ecommerce.md)
- [ADR-0030: Phase 9D architecture freeze](ADR/ADR-0030-phase-9d-ready-made-furniture-ecommerce-architecture.md)

<!-- PHASE_9B_ARCHITECTURE_FREEZE_START -->
## Phase 9B Public/Admin Route Reservation

Reserved Phase 9B routes:

- Internal: `/admin/landing-pages` and nested staff-only editor/detail routes.
- Public campaign landing: `/lp/[slug]`.

Public Landing Lab rules:

- only `live` publications may render;
- draft/paused/archived/unknown publications are unavailable through a non-enumerating response;
- pages are `noindex, nofollow` by default;
- content is rendered only from validated structured blocks;
- the lead form submits through the existing `/api/public/lead-intake` boundary;
- no production route activation is authorized by the architecture freeze.

The documented `/consultation` path must not be treated as a mounted route unless implementation separately proves/creates it.
<!-- PHASE_9B_ARCHITECTURE_FREEZE_END -->

<!-- PHASE_9D_A_ARCHITECTURE_FREEZE_START -->
## Phase 9D-A Public/Admin Route Freeze (not mounted)

Canonical shop routes are frozen in ADR-0030. They are **not implemented** in this gate. Sitemap must not list guest track URLs as public indexable pages until 9D-C/F. `/shop` is not `/portfolio` and not `/consultation`.
<!-- PHASE_9D_A_ARCHITECTURE_FREEZE_END -->
