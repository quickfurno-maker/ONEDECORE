# ONEDECORE Phase 2E3A — Public Portfolio Experience & SEO Architecture Audit

**Status:** Architecture Corrected, Frozen & Approved for Phase 2E3B Implementation  
**Working Directory:** `C:\Users\KESHAV SHARMA\Desktop\OneDecore`  
**Branch:** `phase-2e3-public-portfolio-experience`  
**Base HEAD:** `36700b10205450715cc93c4c026a1d2e370ed9e2` (Main merge commit of Phase 2E2/2E2A)  
**Official Supabase Project:** `lpurlfmpvriyvpkujvyl` (Mumbai, ap-south-1)  

---

## 1. Executive Summary & Correction Log

Phase 2E3 will make published Portfolio projects visible on the public ONEDECORE website (`https://onedecore.in`).

Phase 2E3A represents the architecture, data modeling, SEO design, accessibility freeze, and security threat audit. No production UI code, database schema migrations, remote data mutations, image uploads, or dependency additions are performed during Phase 2E3A.

This corrected document incorporates 16 architecture fixes required by the Phase 2E3A Final Architecture Correction Gate:

1. **Official Site Identity Correction:** Updated all domain references to `onedecore.in` (`https://onedecore.in`). Added central site config contract `src/config/site.ts`.
2. **Evidence Language Correction:** Explicitly distinguished between existing inspected repository files vs proposed Phase 2E3B production files.
3. **Homepage Featured Query Correction:** Fixed filter to `status = 'published' AND is_featured = true`. Zero featured projects renders a restrained empty section without backfilling non-featured items.
4. **Bounded Listing Pagination & Filter Allow-List:** Bounded `/portfolio` to 12 cards/page. Requests 13 rows to determine `hasNextPage`. Invalid page number or unknown service filter returns `notFound()`. Service allow-list: `complete_home_interiors`, `modular_kitchens`, `custom_wardrobes`.
5. **Exact Query Counts & Anti-N+1 Strategy:** Defined maximum database query counts per route (Homepage: $\le 3$, Listing: $\le 3$, Detail: $\le 3$, Sitemap: $\le 1$). Zero N+1 queries.
6. **Malformed Record Contract:** Defined 7 displayable invariants. Listing/homepage omits malformed items with redacted server logging; Detail returns `notFound()`; Sitemap excludes them.
7. **Media Selection & Strict Path Ownership:** Fixed cover selection to `media_role = 'cover'`, `status = 'ready'`, `public_object_path IS NOT NULL`, `ORDER BY sort_order ASC, created_at ASC, id ASC`. Gallery max 12 images. Strict path ownership format `<project_uuid>/<media_uuid>/<derivative_file_name>` validated in `public-url.ts`.
8. **Restricted Next.js Image Config:** Pathname pattern restricted strictly to `/storage/v1/object/public/portfolio-public/**`. Stored WebP derivatives only, explicit width/height. Corrected CLS claim to "minimizes layout shift".
9. **Next.js 16 Cache & Invalidation Architecture:** Uses `unstable_cache` with server-only anonymous client (no session/cookies). Invalidation uses two-argument `revalidateTag(tag, { expire: 0 })` and `revalidatePath(path)`. Media Route Handlers avoid `updateTag`. Invalidation failures do not roll back database mutations.
10. **Core Web Vitals Budget:** Replaced FID with INP. Target 75th percentile: LCP $\le 2.5\text{s}$, INP $\le 200\text{ms}$, CLS $\le 0.1$.
11. **Exact Structured Data Contract:** Single `@graph` for detail page containing `WebPage`, `BreadcrumbList`, `CreativeWork` (using `ImageObject` array). Publisher references central site identity. Zero fake claims or reviews.
12. **Sitemap & Dynamic Route Strategy:** Removed `generateStaticParams()` for V1 to support instant CMS publication. Detail routes resolve dynamically through cached repository. `lastModified = greatest(updated_at, published_at)`.
13. **Route & File Ownership:** Consolidated all public portfolio repository, cache, mapper, and component files under `src/features/portfolio/public/`. Marked server modules `import "server-only"`.
14. **Expanded Test Matrix:** Added detailed test specifications for repository filters, pagination, URL builder traversal/ownership checks, cache invalidation, and SEO.

---

## 2. Central Site Identity (`src/config/site.ts`)

Proposed Phase 2E3B configuration module:

```typescript
export const SITE_CONFIG = {
  name: "ONEDECORE",
  tagline: "One Vision. Complete Interiors.",
  url: "https://onedecore.in",
  locale: "en_IN",
} as const;
```

All public metadata, canonical URLs, sitemaps, robots.txt, and structured data MUST derive from `SITE_CONFIG.url`.

---

## 3. Inspected Baseline vs Proposed File Plan

### Existing Inspected Repository Files:
- `src/app/page.tsx` — Homepage placeholder ("One Vision. Complete Interiors.").
- `src/app/layout.tsx` — Root layout with Inter font and global metadata.
- `src/lib/supabase/client.ts` & `src/lib/supabase/server.ts` — SSR Supabase client creators.
- `src/config/env.ts` — Runtime environment variable validator.
- `next.config.ts` — Framework configuration file.
- `supabase/migrations/20260725033329_harden_portfolio_rls_and_audit_privileges.sql` — RLS policies.
- `supabase/migrations/20260725123040_harden_portfolio_status_rpc_exposure.sql` — Two-tier RPC architecture.

### Proposed Phase 2E3B Production Files (To Be Created in Phase 2E3B):
- `src/config/site.ts` — Site identity configuration.
- `src/features/portfolio/public/types.ts` — Public DTO definitions.
- `src/features/portfolio/public/constants.ts` — Cache tags & service label mappings.
- `src/features/portfolio/public/public-url.ts` — Strict public URL builder & path validator.
- `src/features/portfolio/public/public-portfolio-mapper.ts` — Database row to DTO mapper.
- `src/features/portfolio/public/public-portfolio-repository.ts` — Server-only cached database queries.
- `src/features/portfolio/public/public-portfolio-cache.ts` — Invalidation helpers.
- `src/features/portfolio/public/components/PortfolioCard.tsx` — Project card UI.
- `src/features/portfolio/public/components/PortfolioGrid.tsx` — Listing grid UI.
- `src/features/portfolio/public/components/PortfolioGallery.tsx` — Detail gallery UI.
- `src/features/portfolio/public/components/FeaturedPortfolioSection.tsx` — Homepage section.
- `src/features/portfolio/public/__tests__/public-portfolio.test.ts` — Unit & repository tests.
- `src/app/portfolio/page.tsx` — Public listing page.
- `src/app/portfolio/loading.tsx` — Listing loading UI.
- `src/app/portfolio/[slug]/page.tsx` — Detail page with `generateMetadata`.
- `src/app/portfolio/[slug]/not-found.tsx` — Detail 404 UI.
- `src/app/sitemap.ts` — Sitemap generator.
- `src/app/robots.ts` — Robots generator.

---

## 4. Public Route Map & Page Behavior

### 1. Homepage (`/`)
- **Featured Section:** Renders up to 6 featured published projects.
- **Filter:** `status = 'published' AND is_featured = true`.
- **Ordering:** 1. `sort_order ASC`, 2. `published_at DESC`, 3. `id ASC`.
- **Empty State:** If 0 featured projects exist, renders a restrained section header with fallback message ("Curated portfolio projects coming soon.") and preserves CTA button to `/portfolio`. Does NOT backfill non-featured projects or render fake cards.

### 2. Listing Page (`/portfolio`)
- **Bounded Pagination:** `/portfolio?page=1`, `/portfolio?service=modular_kitchens&page=2`.
- **Page Size:** 12 cards. Requests 13 rows to compute `hasNextPage`.
- **Validation:** Page must be a positive integer (`>= 1`). Service filter must be in allow-list (`complete_home_interiors`, `modular_kitchens`, `custom_wardrobes`).
- **Invalid Parameter Behavior:** Invalid page number or unknown service filter returns `notFound()`.
- **Ordering:** 1. `is_featured DESC`, 2. `sort_order ASC`, 3. `published_at DESC`, 4. `id ASC`.

### 3. Detail Page (`/portfolio/[slug]`)
- **Access Rule:** Returns `notFound()` if slug does not exist, or status is not `published`, or cover media is missing/not ready, or required services are empty.
- **Content:** Title, summary, description, service badges, location label, property type, completion year, publication date, cover WebP image, gallery WebP images (max 12).

---

## 5. Public DTO Contracts

Proposed in `src/features/portfolio/public/types.ts`:

```typescript
export type PublicPortfolioService = {
  serviceCode: "complete_home_interiors" | "modular_kitchens" | "custom_wardrobes";
  serviceLabel: string;
};

export type PublicPortfolioImage = {
  url: string;
  altText: string;
  caption: string | null;
  width: number;
  height: number;
  role: "cover" | "gallery";
};

export type PublicPortfolioCard = {
  slug: string;
  title: string;
  summary: string;
  locationLabel: string | null;
  propertyType: string | null;
  completionYear: number | null;
  isFeatured: boolean;
  services: PublicPortfolioService[];
  cover: PublicPortfolioImage;
};

export type PublicPortfolioProject = {
  slug: string;
  title: string;
  summary: string;
  description: string | null;
  locationLabel: string | null;
  propertyType: string | null;
  completionYear: number | null;
  seoTitle: string | null;
  seoDescription: string | null;
  publishedAt: string;
  services: PublicPortfolioService[];
  cover: PublicPortfolioImage;
  gallery: PublicPortfolioImage[];
};

export type PublicPortfolioPaginatedCards = {
  cards: PublicPortfolioCard[];
  page: number;
  pageSize: number;
  hasNextPage: boolean;
  activeService: string | null;
};
```

---

## 6. Query Counts & Anti-N+1 Strategy

All public routes execute using bounded batched queries to prevent N+1 query overhead:

1. **Homepage `/`:** Maximum 3 database queries.
   - Query 1: Up to 6 project rows (`status = 'published' AND is_featured = true`).
   - Query 2: Service mappings for returned project IDs (`IN (...)`).
   - Query 3: Ready cover media for returned project IDs (`IN (...)`).
2. **Listing `/portfolio`:** Maximum 3 database queries.
   - Query 1: Up to 13 project rows for current page and filter.
   - Query 2: Service mappings for returned project IDs.
   - Query 3: Ready cover media for returned project IDs.
3. **Detail `/portfolio/[slug]`:** Maximum 3 database queries.
   - Query 1: Single published project row by slug.
   - Query 2: Service mappings for project ID.
   - Query 3: Ready cover & gallery media for project ID.
4. **Sitemap `/sitemap.xml`:** Maximum 1 database query returning slugs for displayable published projects.

---

## 7. RLS Decision: Outcome A

- **Decision:** **Outcome A — Existing RLS is sufficient.**
- **Verification:** Existing migrations (`20260725033329` & `20260725123040`) already enforce strict anonymous SELECT access on `portfolio_projects` (`status = 'published'`), `portfolio_project_services` (published projects), `portfolio_media` (`status = 'ready'` for published projects), and `portfolio-public` bucket (`public = true`). Anonymous SELECT on `portfolio_media_sources` is 100% revoked.
- **Zero Schema Drift:** No database schema migration will be created in Phase 2E3.

---

## 8. Media Path Validation & Next.js Image Config

- **Public URL Builder (`src/features/portfolio/public/public-url.ts`):**
  - Path ownership format check: `<project_uuid>/<media_uuid>/<derivative_file_name>`.
  - Rejects leading slash, `..`, backslash `\`, query strings `?`, fragments `#`, and path traversal.
  - Rejects mismatched project or media UUID path ownership.
  - Bucket fixed to `portfolio-public`.
- **Next.js Image Config (`next.config.ts`):**
  ```typescript
  import type { NextConfig } from "next";

  const nextConfig: NextConfig = {
    images: {
      remotePatterns: [
        {
          protocol: "https",
          hostname: "lpurlfmpvriyvpkujvyl.supabase.co",
          port: "",
          pathname: "/storage/v1/object/public/portfolio-public/**",
          search: "",
        },
      ],
    },
  };

  export default nextConfig;
  ```

---

## 9. Next.js 16 Cache & Invalidation Architecture

- **Caching Mechanism:** Wrapped in `unstable_cache` using a dedicated server-only anonymous client (no cookies/session).
- **Cache Tags:** `portfolio:featured`, `portfolio:list`, `portfolio:sitemap`, `portfolio:project:<slug>`.
- **Invalidation Calls:**
  - CMS Actions: `revalidateTag(tag, { expire: 0 })` and `revalidatePath(path)`.
  - Media Route Handlers: `revalidateTag(tag, { expire: 0 })` and `revalidatePath(path)` (does NOT use `updateTag`).
- **Revalidation Error Isolation:** Cache revalidation errors are logged safely with an operation ID without rolling back committed database mutations.

---

## 10. SEO, Sitemap & Structured Data

- **Canonical Base:** `https://onedecore.in` (derived from `SITE_CONFIG.url`).
- **Dynamic Route Strategy:** Detail routes resolve dynamically through cached repository; `generateStaticParams()` is omitted in V1 to ensure instant CMS publication availability.
- **Sitemap (`src/app/sitemap.ts`):** `lastModified = greatest(updated_at, published_at)`.
- **Robots (`src/app/robots.ts`):** Host `https://onedecore.in`, Sitemap `https://onedecore.in/sitemap.xml`, Disallow `/admin/`, `/api/admin/`, `/auth/`.
- **Structured Data (`/portfolio/[slug]`):** `@graph` containing `WebPage`, `BreadcrumbList`, `CreativeWork` (with `ImageObject` array). Publisher references `SITE_CONFIG`.

---

## 11. Core Web Vitals & Accessibility Budgets

- **75th Percentile Field Targets:** LCP $\le 2.5\text{s}$, INP $\le 200\text{ms}$, CLS $\le 0.1$.
- **Accessibility:** WCAG 2.1 AA compliant, semantic HTML, high contrast ($\ge 4.5:1$), visible focus rings (`focus-visible:ring-2`), mandatory `alt_text`, V1 static Server Component gallery grid.

---

## 12. Security Threat Matrix

| Threat ID | Threat Description | Prevention Control | Automated Test |
| :--- | :--- | :--- | :--- |
| **T-01** | Draft project leakage | RLS policy + Repository filter `status = 'published'` | Route test asserts 404 for draft slug |
| **T-02** | Archived project leakage | RLS policy + Repository filter `status = 'published'` | Route test asserts 404 for archived slug |
| **T-03** | Private original storage URL leakage | Exclusively query `public_object_path` from `portfolio-public` | DTO test asserts `portfolio-originals` never appears |
| **T-04** | Private source metadata leakage | `portfolio_media_sources` access revoked for anon | pgTAP test asserts anon SELECT on `portfolio_media_sources` fails |
| **T-05** | Audit / User Identity leakage | DTOs strip `created_by`, `updated_by`, user UUIDs | Unit test verifies DTO output contains zero UUIDs |
| **T-06** | Stored XSS via title/description | React JSX auto-escaping | Unit test checks raw HTML string handling |
| **T-07** | Cache leakage after unpublishing | `revalidateTag` & `revalidatePath` on status transition | Integration test asserts unpublish invalidates public page |
| **T-08** | Storage Path Traversal / Spoofing | `public-url.ts` strict UUID & path ownership validation | Unit test checks traversal/spoofing rejection |

---

## 13. Test Matrix for Phase 2E3B

Preserves existing 139 tests (107 database + 15 app + 17 image) and plans:
1. **Unit Tests (`src/features/portfolio/public/__tests__/public-portfolio.test.ts`):** DTO mapping, cover selection, gallery sorting, service label mapping, SEO fallbacks, canonical URL, URL builder path traversal/ownership validation.
2. **Route & Repository Integration Tests:** Bounded query counts, featured filter, page 12-card bound, 404s for invalid page/service/draft/archived/malformed records, two-argument `revalidateTag` calls.

---

## 14. Documentation Deliverables Created

- [docs/ADR/ADR-0016-public-portfolio-data-delivery.md](file:///C:/Users/KESHAV%20SHARMA/Desktop/OneDecore/docs/ADR/ADR-0016-public-portfolio-data-delivery.md)
- [docs/ADR/ADR-0017-public-portfolio-cache-and-revalidation.md](file:///C:/Users/KESHAV%20SHARMA/Desktop/OneDecore/docs/ADR/ADR-0017-public-portfolio-cache-and-revalidation.md)
- [docs/audits/phase-2e3a-public-portfolio-architecture.md](file:///C:/Users/KESHAV%20SHARMA/Desktop/OneDecore/docs/audits/phase-2e3a-public-portfolio-architecture.md)
- Updated planning sections in `README.md`, `docs/09-phase-roadmap.md`, `docs/10-decision-register.md`.

---

**PHASE_2E3A_ARCHITECTURE_CORRECTED_READY**
