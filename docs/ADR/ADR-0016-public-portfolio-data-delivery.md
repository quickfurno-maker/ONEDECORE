# ADR-0016: Public Portfolio Data Delivery Architecture

## Status
Accepted (Architecture Corrected & Frozen in Phase 2E3A Correction Gate)

## Context
Phase 2E2/2E2A established the Portfolio Admin CMS, media processing pipeline (Sharp WebP derivatives), database publication constraints, and SECURITY DEFINER status transition RPC workflow. Published portfolio projects, associated service mappings, and ready media metadata are now manageable by authenticated Super Admins.

Phase 2E3 requires exposing published portfolio projects on the public ONEDECORE website (`https://onedecore.in`) across three primary touchpoints:
1. Featured Portfolio Projects section on the main Homepage (`/`).
2. Public Portfolio Listing page (`/portfolio`).
3. Public Portfolio Detail page (`/portfolio/[slug]`).

The public data delivery architecture must enforce strict security, performance, accessibility, and SEO constraints:
- **Official Domain & Site Identity:** Canonical URL base is `https://onedecore.in`. All site metadata, canonical URLs, sitemaps, robots.txt, and structured data derive from `src/config/site.ts`.
- **Zero Information Leakage:** Draft projects, archived projects, draft/retired media, private original media metadata (`portfolio_media_sources`), private storage paths (`portfolio-originals`), and internal audit/user identity fields (`created_by`, `updated_by`, internal UUIDs) must never be exposed to public or unauthenticated clients.
- **Server Components First:** Data retrieval must execute exclusively on the server within Next.js React Server Components (RSC) using server-scoped data repositories marked `import "server-only"`. No direct Supabase queries may be initiated from Client Components.
- **No Request-Time Processing:** Image assets served to public visitors must use pre-generated WebP derivatives stored in the `portfolio-public` bucket. No request-time image transformations or third-party image delivery services will be used.
- **Outcome A RLS Alignment:** Existing database RLS policies on `portfolio_projects`, `portfolio_project_services`, and `portfolio_media` already enforce `status = 'published'` and `status = 'ready'` for anonymous/public queries. No schema migrations are required for Phase 2E3 data delivery.

## Decision

### 1. Central Site Configuration (`src/config/site.ts`)
Proposed central site identity configuration contract for Phase 2E3B:

```typescript
export const SITE_CONFIG = {
  name: "ONEDECORE",
  tagline: "One Vision. Complete Interiors.",
  url: "https://onedecore.in",
  locale: "en_IN",
} as const;
```

### 2. Data Contracts (Proposed DTOs in `src/features/portfolio/public/types.ts`)
All public portfolio data returned by server repositories must strictly conform to decoupled, strongly-typed Data Transfer Objects (DTOs). Internal database row structures, audit fields, and user UUIDs are stripped before reaching page components.

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

### 3. Server Data Repository Module (`src/features/portfolio/public/public-portfolio-repository.ts`)
Proposed server-only repository module using `@supabase/ssr` with the public publishable key (`NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`) and no session persistence.

#### Repository Query Contracts & Exact Bounded Database Queries:
- **`getFeaturedPortfolioCards(limit?: number = 6): Promise<PublicPortfolioCard[]>`**
  - Executed on `/` (Homepage).
  - Maximum 3 batched database queries (Project rows, Service mappings, Ready cover media).
  - Filter: `status = 'published' AND is_featured = true`.
  - Ordering: 1. `sort_order ASC`, 2. `published_at DESC`, 3. `id ASC`.
  - If zero featured projects exist: returns empty array `[]`. Homepage renders restrained section empty state without backfilling non-featured projects or rendering fake cards.

- **`getPublicPortfolioCards(options?: { page?: number; service?: string }): Promise<PublicPortfolioPaginatedCards>`**
  - Executed on `/portfolio` listing page.
  - Maximum 3 batched database queries (Project rows, Service mappings, Ready cover media).
  - Page size: 12 cards per page.
  - Page validation: Positive integers only (`page >= 1`). Invalid page or unknown service filter returns `notFound()`.
  - Pagination mechanism: Requests 13 rows to calculate `hasNextPage` while returning at most 12 cards.
  - Service Allow-List: `complete_home_interiors`, `modular_kitchens`, `custom_wardrobes`. Unknown service filter returns `notFound()`.

- **`getPublicPortfolioProjectBySlug(slug: string): Promise<PublicPortfolioProject | null>`**
  - Executed on `/portfolio/[slug]` detail page.
  - Maximum 3 batched database queries (Single project row by slug, Service mappings, Ready cover & gallery media).
  - Returns `null` if project does not exist, status is not `published`, cover media is missing/not `ready`, required services are empty, or public display invariants fail.
  - Cover selection: `media_role = 'cover'`, `status = 'ready'`, `public_object_path IS NOT NULL`, `ORDER BY sort_order ASC, created_at ASC, id ASC` (selects first valid record).
  - Gallery selection: `media_role = 'gallery'`, `status = 'ready'`, `public_object_path IS NOT NULL`, `ORDER BY sort_order ASC, created_at ASC, id ASC` (maximum 12 images).

- **`getAllPublishedProjectSlugs(): Promise<string[]>`**
  - Executed by `src/app/sitemap.ts`.
  - Maximum 1 database query returning slugs for published projects that satisfy all displayable invariants.

### 4. Malformed Record Handling & Invariant Enforcement
A published project is displayable only when ALL of the following invariants are satisfied:
1. `status = 'published'`
2. `published_at` is non-null
3. At least 1 assigned service mapping
4. At least 1 ready cover image metadata row
5. Cover `public_object_path` is non-null
6. Cover dimensions and file size are valid (`width > 0`, `height > 0`, `file_size_bytes > 0`)
7. Cover public object path passes strict path ownership validation (`<project_uuid>/<media_uuid>/cover-1600.webp`)

- **Listing/Homepage Behavior:** Omits malformed projects from the returned card array. Logs a redacted server warning (operation ID only; zero user UUIDs or URLs exposed).
- **Detail Page Behavior:** Returns `null`, causing `/portfolio/[slug]` to invoke `notFound()`.
- **Sitemap Behavior:** Excludes malformed published records from index.

### 5. Strict Public Media Path Ownership & URL Validation (`src/features/portfolio/public/public-url.ts`)
Proposed public URL builder contract:
- Validates public path ownership format: `<project_uuid>/<media_uuid>/<derivative_file_name>`.
- Enforces bucket `portfolio-public` exclusively.
- Rejects leading slash, `..`, backslash `\`, query strings `?`, fragments `#`, and path traversal.
- Rejects mismatched project or media UUID path ownership.
- Returns absolute URL: `https://lpurlfmpvriyvpkujvyl.supabase.co/storage/v1/object/public/portfolio-public/<path>`.

### 6. Next.js Image Configuration (`next.config.ts`)
Restricted `remotePatterns` in `next.config.ts`:

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

## Consequences

### Positive
- **Domain Consistency:** Unified canonical URL domain `https://onedecore.in` prevents duplicate indexing across `.com` / `.in` domain variants.
- **Guaranteed Security:** Anonymous visitors cannot access draft, archived, or original source metadata under any circumstance.
- **Anti-N+1 Performance:** All routes execute in at most 1 to 3 batched database queries.
- **Zero Schema Drift:** Uses existing verified RLS policies without database migrations.

### Negative / Trade-offs
- Detail routes resolve dynamically through cached repository rather than static build generation to support instant publication without app re-deployments.

## References
- [ADR-0013: Server-Side Portfolio Image Processing Pipeline](file:///C:/Users/KESHAV%20SHARMA/Desktop/OneDecore/docs/ADR/ADR-0013-server-side-portfolio-image-processing.md)
- [ADR-0014: Database-Controlled Portfolio Publication Workflow](file:///C:/Users/KESHAV%20SHARMA/Desktop/OneDecore/docs/ADR/ADR-0014-database-controlled-portfolio-publication.md)
- [ADR-0015: Private SECURITY DEFINER Helper & Public Status Transition RPC](file:///C:/Users/KESHAV%20SHARMA/Desktop/OneDecore/docs/ADR/ADR-0015-private-definer-status-transition-helper.md)
