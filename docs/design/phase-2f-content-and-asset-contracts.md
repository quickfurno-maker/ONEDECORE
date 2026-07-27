# Phase 2F — Content & Asset Contracts

**Document Status:** Frozen  
**Rule:** Never render `OWNER CONTENT REQUIRED` publicly. Never invent claims.

---

## 1. Content Classification Legend

| Class | Meaning |
|---|---|
| **APPROVED BRAND FACT** | May ship as-is |
| **NEUTRAL PRODUCTION COPY REQUIRED** | Professional placeholder copy needed before launch — no false claims |
| **OWNER CONTENT REQUIRED** | Block public render until owner supplies |
| **CMS DATA** | From Supabase portfolio CMS |
| **LEGAL REVIEW REQUIRED** | Privacy/terms — legal review before publish |

---

## 2. Section Content Contracts

### Hero

| Field | Class | Value / Rule |
|---|---|---|
| Brand name | APPROVED BRAND FACT | ONEDECORE |
| Tagline | APPROVED BRAND FACT | One Vision. Complete Interiors. |
| Value proposition line | OWNER CONTENT REQUIRED | Beyond tagline |
| Primary CTA label | APPROVED BRAND FACT | Book a Design Consultation |
| Secondary CTA label | APPROVED BRAND FACT | Explore Our Work |
| Hero image | OWNER CONTENT REQUIRED | Licensed marketing photography |

### Brand Proposition

| Field | Class |
|---|---|
| Heading | NEUTRAL PRODUCTION COPY REQUIRED |
| Body (2–3 sentences) | OWNER CONTENT REQUIRED |
| Supporting image | OWNER CONTENT REQUIRED or licensed stock |

### Services (×3)

| Service | Route | Title | Class |
|---|---|---|---|
| Complete Home Interiors | `/services/complete-home-interiors` | APPROVED BRAND FACT | |
| Modular Kitchens | `/services/modular-kitchens` | APPROVED BRAND FACT | |
| Custom Wardrobes | `/services/custom-wardrobes` | APPROVED BRAND FACT | |
| Descriptions | | NEUTRAL PRODUCTION COPY REQUIRED | |
| Row images | | Licensed marketing — not CMS unless approved | |

### Featured Portfolio

| Field | Class |
|---|---|
| Section title | NEUTRAL PRODUCTION COPY REQUIRED |
| Project cards | CMS DATA |
| Cover images | CMS DATA (WebP derivatives) |
| Alt text | CMS DATA (`alt_text` column) |
| Empty state | NEUTRAL PRODUCTION COPY REQUIRED |

### Process

| Field | Class |
|---|---|
| Step copy | OWNER CONTENT REQUIRED |
| Step count | 3–4 steps |

### Materials

| Field | Class |
|---|---|
| Captions | OWNER CONTENT REQUIRED |
| Images | Licensed / owner-provided |

### Why ONEDECORE

| Field | Class |
|---|---|
| Pillars (max 3) | OWNER CONTENT REQUIRED |
| Statistics / awards | **Forbidden** unless verified |
| Testimonials | **Do not display** until authentic approved |

### Consultation Band

| Field | Class |
|---|---|
| Headline | NEUTRAL PRODUCTION COPY REQUIRED |
| Reassurance lines | NEUTRAL PRODUCTION COPY REQUIRED |
| CTA | Book a Design Consultation → `/contact` |

### Footer

| Field | Class |
|---|---|
| Address | OWNER CONTENT REQUIRED |
| Phone | OWNER CONTENT REQUIRED |
| Email | OWNER CONTENT REQUIRED |
| Legal links | `/privacy`, `/terms` — LEGAL REVIEW REQUIRED |
| Legal name | **Never** `ONEDECORE Interiors` |

### About (`/about` — Phase 2F-E)

| Field | Class |
|---|---|
| Company narrative | OWNER CONTENT REQUIRED |
| Founder/team imagery | OWNER CONTENT REQUIRED — omit section if unavailable |
| Pune presence | APPROVED BRAND FACT (market) — no invented address |

### Contact (`/contact` — Phase 2F-E)

| Field | Class |
|---|---|
| Form fields | Standard lead capture — NEUTRAL PRODUCTION COPY REQUIRED |
| Contact details | OWNER CONTENT REQUIRED |
| WhatsApp opt-in | Per `docs/08-whatsapp-and-n8n-boundary.md` when implemented |

### Legal (`/privacy`, `/terms`)

| Field | Class |
|---|---|
| Full text | LEGAL REVIEW REQUIRED |

---

## 3. Asset Categories

| Category | Provenance | Allowed use | Aspect | Alt ownership | Optimisation | Priority |
|---|---|---|---|---|---|---|
| Brand logo | Owner design asset | Header, footer, OG | SVG preferred | Decorative if wordmark text present | SVG inline or optimised | High |
| Hero marketing image | Owner or licensed stock | Homepage hero only | 16:9–3:2 | Content team | AVIF/WebP ≤200KB | `priority` LCP |
| Service images | Licensed marketing | Service rows + service pages | 4:3 | Content team | ≤120KB WebP/AVIF | Lazy below fold |
| Material/detail images | Licensed / owner | Material section | 16:9 or 3:2 | Content team | ≤120KB | Lazy |
| Portfolio CMS images | CMS upload pipeline | Featured, listing, detail | CMS derivative | CMS `alt_text` | Existing WebP contract | Featured: eager first row |
| About/process imagery | Owner | About, process pages | 3:2 | Content team | ≤120KB | Lazy |
| Icons | Lucide-style SVG inline or minimal custom | UI chrome only | 24px | `aria-hidden` if decorative | Inline SVG | — |
| Textures | None V1 | — | — | — | — | — |
| Open Graph | Generated template | Social sharing | 1200×630 | Brand name in image | ≤100KB | On metadata |

**Prohibited:** Generated Phase 2F-A concept PNGs presented as completed ONEDECORE projects.

---

## 4. Image Transfer Targets

| Asset type | Target size | Format |
|---|---|---|
| Hero | ≤ 200 KB | AVIF primary, WebP fallback |
| Section marketing | ≤ 120 KB | AVIF/WebP |
| Portfolio cover (CMS) | Existing pipeline | WebP derivatives only |
| OG | ≤ 100 KB | JPEG or WebP |

No unoptimised PNG/JPEG delivery to public visitors.

---

## 5. Placeholder Strategy

| Context | Behaviour |
|---|---|
| OWNER CONTENT REQUIRED text | Omit from public HTML entirely OR render neutral "Details coming soon" without fake specifics |
| Missing hero image | Neutral stone gradient + typography only — no stock fraud |
| Empty featured portfolio | Existing empty state pattern — neutral copy |
| Missing contact details | Omit phone/address blocks; keep form if policy allows |
| Missing testimonials | Section omitted entirely |

---

## 6. Related Documents

- [ADR-0020](../ADR/ADR-0020-public-website-content-and-asset-boundaries.md)
- [Production Spec](phase-2f-direction-a-production-spec.md)
- [Portfolio Architecture](../04-portfolio-architecture.md)
