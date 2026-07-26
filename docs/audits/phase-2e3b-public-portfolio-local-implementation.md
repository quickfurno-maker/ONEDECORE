# ONEDECORE Phase 2E3B — Public Portfolio Local Implementation Audit

**Status:** Verified & Approved  
**Branch:** `phase-2e3-public-portfolio-experience`  
**Architecture Commit:** `4dee9a02eaab02e635ecd0be39d9b254e57831a5` (`docs(portfolio): freeze public portfolio architecture`)  
**Functional Commit:** `205cb8deb081f68802589ab420bbb67b3f62e885` (`feat(portfolio): deliver public portfolio experience`)  
**Official Domain:** `https://onedecore.in`  
**Migrations:** 8 (no new migration in Phase 2E3)

---

## 1. Executive Summary

Phase 2E3B delivers the public Portfolio experience on the ONEDECORE website: homepage featured section, paginated listing (`/portfolio`), dynamic detail routes (`/portfolio/[slug]`), SEO metadata, JSON-LD, sitemap, and robots.txt. Implementation reuses existing anonymous RLS policies (Outcome A — zero schema migration). Two defects discovered during local gate were corrected before approval.

---

## 2. Implementation Highlights

| Area | Decision |
| :--- | :--- |
| Site identity | `src/config/site.ts` — `https://onedecore.in`, no invented legal name |
| Data access | Server-only anonymous Supabase client; public DTOs strip audit/internal fields |
| Storage validation | Exact WebP derivatives only: `cover-1600.webp`, `gallery-1200.webp`, `thumb-480.webp` |
| Homepage | Featured-only (`status = published AND is_featured = true`); no backfill |
| Listing | 12 cards/page; database-side displayable filtering before pagination |
| Detail | Dynamic route; true HTTP 404 for draft/archived/malformed/unknown slugs |
| Caching | Uncached repository layer + `unstable_cache` wrapper + mutation invalidation helper |
| Sitemap | Media-to-sitemap invalidation on CMS mutations |
| Next Image | Strict `/storage/v1/object/public/portfolio-public/**` pathname pattern |
| Proxy | Session guard only (`/admin`, `/auth`); no public Portfolio interception |

---

## 3. Defect Corrections

### 3.1 True HTTP 404 Fix
**Problem:** `src/app/portfolio/loading.tsx` created a whole-route Suspense boundary. `notFound()` rendered 404 content but the response status remained HTTP 200 (loading shell committed first).  
**Fix:** Removed `src/app/portfolio/loading.tsx`. Invalid slugs and listing parameters now return true HTTP 404 with no streamed loading shell mixed into the response.

### 3.2 Database-Side Pagination Filtering Fix
**Problem:** Listing applied the page window before filtering malformed projects, hiding valid projects and producing short pages.  
**Fix:** Inner-join services and cover media at the database query level in `public-portfolio-queries.ts` so only displayable projects occupy page slots.

---

## 4. Quality Gate Results

| Gate | Result |
| :--- | :---: |
| Database pgTAP (`npm run db:test`) | 107 / 107 |
| Application/public (`npm run test:app`) | 90 / 90 |
| Image pipeline (`npm run test:image`) | 17 / 17 |
| Production HTTP endpoints | 13 / 13 |
| Deep body assertions | 82 / 82 |
| TypeScript (`npm run typecheck`) | Pass |
| ESLint (`npm run lint`) | Pass |
| Production build (`npm run build`) | Pass |
| Full check (`npm run check`) | Pass |
| Migrations | 8 synchronized, 0 new |

---

## 5. Production HTTP Verification

Executed against `npm run build` + `npm run start -- -p 3100` with deterministic local fixtures (`scripts/seed-local-fixtures.sql`).

Verified:
- Invalid page/service/slug responses are true HTTP 404
- Page 1 renders 12 displayable cards when enough records exist
- Page 2 exposes remaining valid projects
- Featured homepage excludes non-featured projects
- Approved WebP derivatives only in public markup
- No private bucket/source/audit/internal UUID leakage
- `.in` canonicals throughout
- Valid JSON-LD `@graph` on detail pages
- Correct sitemap and robots.txt

Tooling: `scripts/verify-production-http.ts` (13 endpoints), ignored handoff deep verifier (82 assertions).

---

## 6. NPM Audit Exception

| Severity | Count |
| :--- | :---: |
| Critical | 0 |
| High | 3 |

Origin: Transitive `postcss` and optional `sharp` nested under Next.js 16.2.11. Direct ONEDECORE `sharp@0.35.3` is unaffected. `npm audit fix --force` rejected (proposes breaking `next@9.3.3` downgrade). No dependency change applied.

---

## 7. Related Documents

- [ADR-0016: Public Portfolio Data Delivery](../ADR/ADR-0016-public-portfolio-data-delivery.md)
- [ADR-0017: Public Portfolio Cache & Revalidation](../ADR/ADR-0017-public-portfolio-cache-and-revalidation.md)
- [Phase 2E3A Architecture Audit](phase-2e3a-public-portfolio-architecture.md)
- [Phase 2E3C Remote E2E Audit](phase-2e3c-remote-portfolio-e2e.md)
