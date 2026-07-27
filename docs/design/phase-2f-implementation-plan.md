# Phase 2F — Implementation Plan

**Document Status:** Frozen  
**Sequencing:** 2F-C → 2F-D → 2F-E → 2F-F  
**No implementation in Phase 2F-B**

---

## 1. Route Phase Classification

| Route | Phase | Notes |
|---|---|---|
| `/` | **2F-C** | Homepage + global shell |
| `/portfolio` | **Done (2E3)** | Restyle only if needed in 2F-F |
| `/portfolio/[slug]` | **Done (2E3)** | Preserve contracts |
| `/services` | **2F-D** | Services index |
| `/services/complete-home-interiors` | **2F-D** | |
| `/services/modular-kitchens` | **2F-D** | |
| `/services/custom-wardrobes` | **2F-D** | |
| `/about` | **2F-E** | |
| `/process` | **2F-E** | |
| `/contact` | **2F-E** | |
| `/privacy` | **2F-E** | Legal review |
| `/terms` | **2F-E** | Legal review |
| `/craftsmanship` | **Later** | Merge into materials narrative or defer |
| `/testimonials` | **Later** | Blocked until authentic content |
| `/consultation` | **Later** | Contact page sufficient V1 |
| `/pune/[location]` | **Later** | SEO expansion |
| `/login`, `/admin/*` | **Existing** | No change |

---

## 2. Implementation Slices

### 2F-C1 — Tokens, Typography, Shared Primitives

| Field | Detail |
|---|---|
| Allowed files | `src/app/layout.tsx` (fonts only), `src/styles/tokens.css`, `src/features/public-site/components/ui/*`, Tailwind theme extension |
| Deliverables | CSS variables, Cormorant + Inter via `next/font/google`, Container, Section, VisuallyHidden, PrimaryButton, SecondaryLink, ImageFrame |
| Tests | Token contrast unit checks; font class applied |
| Visual evidence | Typography sheet vs Figma A18 |
| Performance | Font transfer ≤ 80KB woff2 |
| Commit boundary | Single commit after C1 QA |
| Stop | Tokens render in isolation page or Storybook-equivalent route **not** in production sitemap |

### 2F-C2 — Header, Mobile Nav, Footer, Shell

| Field | Detail |
|---|---|
| Allowed files | `src/features/public-site/components/shell/*`, `header/*`, `PublicFooter`, `src/app/layout.tsx` (shell wrap) |
| Deliverables | PublicSiteShell, PublicHeader, MobileNavigation, SkipLink, PublicFooter |
| Tests | Header scroll mock; mobile nav keyboard; landmarks |
| Visual evidence | Figma A05, A13, A14 |
| Performance | Header client JS ≤ 8KB gzip |
| Stop | Shell wraps all public routes; portfolio routes unchanged functionally |

### 2F-C3 — Hero and Proposition

| Field | Detail |
|---|---|
| Allowed files | `hero/*`, `sections/BrandProposition`, `src/app/page.tsx` (hero + proposition only) |
| Deliverables | HeroSection, HeroReveal client island, BrandProposition |
| Tests | CTA hrefs; reduced motion |
| Visual evidence | Figma A05, A06 |
| Performance | LCP hero ≤ 200KB; motion JS minimal |
| Stop | Homepage top two sections match Figma ledger |

### 2F-C4 — Services and Featured Portfolio

| Field | Detail |
|---|---|
| Allowed files | `ServiceEditorialRow`, `sections/*`, `FeaturedPortfolioSection` styling, `PortfolioCard` styling |
| Deliverables | 3 alternating service rows; restyled featured portfolio |
| Tests | Existing portfolio tests pass; service links |
| Visual evidence | A07, A08, A15, A16 |
| Performance | No new portfolio data fetches |
| Stop | No marketplace cards; CMS data intact |

### 2F-C5 — Process, Materials, Trust, Consultation

| Field | Detail |
|---|---|
| Allowed files | Remaining homepage sections, `src/app/page.tsx` completion |
| Deliverables | ProcessSection, MaterialStorySection, TrustSection, ConsultationBand |
| Tests | Dark section contrast; no testimonial render |
| Visual evidence | A09–A12, A17 |
| Stop | Full homepage section order canonical |

### 2F-C6 — Homepage Visual QA and Correction

| Field | Detail |
|---|---|
| Allowed files | Bugfix only in 2F-C scope |
| Deliverables | Mismatch ledger cleared for 5 viewports |
| Tests | Full homepage test pass; a11y spot check |
| Visual evidence | Screenshots vs Figma A01–A04 |
| Performance | LCP ≤ 2.5s local prod build |
| Stop | Owner visual sign-off on homepage |

### 2F-D — Service Routes

| Field | Detail |
|---|---|
| Routes | `/services`, 3 service detail pages |
| Allowed files | `src/app/services/**`, shared section components |
| Stop | All service routes render; metadata defined |

### 2F-E — About, Process, Contact, Legal

| Field | Detail |
|---|---|
| Routes | `/about`, `/process`, `/contact`, `/privacy`, `/terms` |
| Stop | OWNER CONTENT REQUIRED sections omitted or neutral; legal flagged |

### 2F-F — Hardening, SEO, A11y, Performance, Merge

| Field | Detail |
|---|---|
| Scope | Cross-route QA, production HTTP tests, sitemap updates, JSON-LD review, performance audit |
| Stop | `npm run check` + `check:db` + production HTTP gate |

---

## 3. Server / Client Boundaries

| Layer | Default |
|---|---|
| Pages | Server Components |
| Data fetch | Server-only repositories |
| Client allowed | Mobile nav, header scroll, Reveal, WAAPI sequences, hover wrappers |
| Forbidden client | Portfolio fetch, Supabase browser client on marketing pages |

---

## 4. Motion Primitives (implementation reference)

| Primitive | Purpose | Boundary | Reduced motion | Mobile |
|---|---|---|---|---|
| `useScrollHeader` | Header solid state | Client | Instant swap | Same |
| `Reveal` | Section entrance | Client | No transform | Shorter/no stagger |
| `HeroReveal` | Hero load sequence | Client | Static | Opacity only |
| `useReducedMotion` | Media query hook | Client | — | — |
| CSS transitions | Hover, focus | CSS | N/A | N/A |
| WAAPI | Optional hero sequence | Client | Skip animation | Simplified |

**GSAP:** Not installed. Proposal gate in ADR-0019.

---

## 5. Testing & Fidelity Gates

### Automated

| Type | Tool | When |
|---|---|---|
| Unit/component | `node --test` | Each slice |
| Portfolio regression | `public-portfolio.test.ts` | C4+ |
| Route/metadata | App tests | C6, 2F-D, 2F-E |
| Production HTTP | `scripts/verify-production-http.ts` | 2F-F |
| Reduced motion | CSS media + component test | C3+ |

### Manual / Browser

| Type | Method |
|---|---|
| Responsive | Cursor browser @ 5 viewports |
| Screenshot compare | Browser screenshot vs Figma export |
| Keyboard | Tab through header, nav, CTAs |
| Console/network | Zero errors; no third-party scripts |
| Performance | Lighthouse local prod; LCP/INP/CLS |

### Fidelity loop (mandatory per slice)

1. Implement one slice
2. Render in browser
3. Screenshot
4. Compare to Figma frame
5. Record mismatch in ledger
6. Fix
7. Repeat on mobile (390px)

**Primary:** Cursor browser. **Fallback:** Playwright (existing `_tools/` pattern, not repo package changes).

---

## 6. Performance Budgets

| Metric | Target | Measurement |
|---|---|---|
| LCP | ≤ 2.5s | Lighthouse 75th, mid-tier mobile |
| INP | ≤ 200ms | Lighthouse / Web Vitals |
| CLS | ≤ 0.1 | Lighthouse |
| Initial route JS | ≤ 120KB gzip | `next build` analyzer |
| Homepage client JS | ≤ 45KB gzip | Build output |
| Motion JS delta | 0KB V1 (no GSAP) | Build output |
| Font transfer | ≤ 80KB woff2 | Network panel |
| Hero image | ≤ 200KB | Asset weight |
| First viewport images | ≤ 400KB total | Network waterfall |
| Third-party scripts | 0 first viewport | Network panel |
| Long tasks | < 50ms during scroll | Performance panel |
| Frame time | ≤ 16ms during animation | Performance panel |

**Baseline:** Current scaffold is RSC-heavy with minimal client JS (~portfolio listing only). Post-2F-C measurement required to confirm headroom.

---

## 7. SEO Boundaries

| Item | Owner | Rule |
|---|---|---|
| Homepage metadata | `src/app/page.tsx` | `formatSiteTitle`, description NEUTRAL COPY |
| Service metadata | Per-route `metadata` export | Unique title/description |
| Canonicals | `SITE_CONFIG.url` | Absolute via `absoluteUrl()` |
| Breadcrumbs | 2F-D/E | `BreadcrumbList` where depth > 1 |
| Portfolio SEO | **Frozen** | Preserve existing JSON-LD, sitemap entries |
| Sitemap | `src/app/sitemap.ts` | Add routes as they ship in D/E |
| Robots | `src/app/robots.ts` | No change V1 |
| JSON-LD Organization | 2F-F | No `LocalBusiness` until contact approved |
| JSON-LD CreativeWork | Portfolio detail | **Preserve** |
| noindex | Draft/admin | Admin routes blocked |

---

## 8. Header Contract Summary

| Field | Value |
|---|---|
| Transparent state | Over hero; no blur glass |
| Solid threshold | `scrollY > 80` |
| Transition | 300ms background/border |
| Mobile open | Focus trap, `aria-modal`, Escape, scroll lock |
| Route change | Close drawer, restore focus |
| No-JS fallback | Solid header always (progressive enhancement via CSS `scroll` if feasible, else solid) |

---

## 9. Related Documents

- [Production Spec](phase-2f-direction-a-production-spec.md)
- [Component Architecture](phase-2f-component-architecture.md)
- [ADR-0019](../ADR/ADR-0019-public-website-motion-architecture.md)
