# ADR-0017: Public Portfolio Cache & Revalidation Strategy

## Status
Accepted (Architecture Corrected & Frozen in Phase 2E3A Correction Gate)

## Context
In Next.js App Router (16.2.11), public pages (`/`, `/portfolio`, `/portfolio/[slug]`) must render instantly while staying synchronized with portfolio publication state changes.

When a Super Admin performs CMS mutations in `/admin/portfolio`:
- Creating or editing a project title, summary, description, or metadata
- Modifying service mappings
- Uploading or deleting cover/gallery images
- Publishing a draft project via `set_portfolio_project_status`
- Returning a published project to draft via `set_portfolio_project_status`
- Archiving a project

The public site (`https://onedecore.in`) must reflect these changes without requiring full site rebuilds or serving stale draft/published content to public visitors.

## Decision

### 1. Next.js 16 Caching Architecture (`unstable_cache`)
To avoid a global `cacheComponents` migration during the public Portfolio phase, public portfolio repository functions will be wrapped using Next.js `unstable_cache`.

- **Client Scope:** Dedicated server-only anonymous Supabase client using publishable key without session persistence. No cookies, headers, or authenticated session data inside cached public repository functions.
- **Cache Fallback:** `revalidate: false` (Explicit on-demand invalidation).

#### Proposed Cache Tag Architecture (`src/features/portfolio/public/constants.ts`):
- `portfolio:featured` — Attached to homepage featured query (`getFeaturedPortfolioCards`).
- `portfolio:list` — Attached to listing query (`getPublicPortfolioCards`).
- `portfolio:sitemap` — Attached to sitemap query (`getAllPublishedProjectSlugs`).
- `portfolio:project:<slug>` — Attached to project detail query (`getPublicPortfolioProjectBySlug`).

### 2. On-Demand Invalidation Contracts (`revalidateTag` & `revalidatePath`)

#### From CMS Server Actions (`src/features/portfolio/server/portfolio-cms-actions.ts`):
Upon successful database mutation in admin CMS actions, invoke two-argument `revalidateTag(tag, { expire: 0 })` and `revalidatePath(path)`:

1. **Project Metadata / Service Update:**
   - `revalidateTag('portfolio:list', { expire: 0 })`
   - `revalidateTag('portfolio:featured', { expire: 0 })`
   - `revalidateTag('portfolio:sitemap', { expire: 0 })`
   - `revalidateTag(\`portfolio:project:\${slug}\`, { expire: 0 })`
   - If slug changed: `revalidateTag(\`portfolio:project:\${oldSlug}\`, { expire: 0 })`
   - `revalidatePath('/')`
   - `revalidatePath('/portfolio')`
   - `revalidatePath(\`/portfolio/\${slug}\`)`
   - `revalidatePath('/sitemap.xml')`

2. **Status Transition (Publish / Unpublish / Archive):**
   - Execute exact same complete revalidation matrix as metadata update.
   - Specifically on unpublish/archive: `portfolio:project:<slug>` is invalidated instantly, converting `/portfolio/[slug]` to a 404.

#### From Media Route Handlers (`src/app/api/admin/portfolio/media/...`):
Upon successful media upload, deletion, or reordering:
   - Route Handlers MUST NOT use `updateTag` (which is Server-Action-only).
   - Use two-argument `revalidateTag(tag, { expire: 0 })` and `revalidatePath(path)`:
   - `revalidateTag('portfolio:list', { expire: 0 })`
   - `revalidateTag('portfolio:featured', { expire: 0 })`
   - `revalidateTag(\`portfolio:project:\${projectSlug}\`, { expire: 0 })`
   - `revalidatePath('/')`
   - `revalidatePath('/portfolio')`
   - `revalidatePath(\`/portfolio/\${projectSlug}\`)`

### 3. Failure & Operational Resilience
- **Database Transaction Atomicity:** Revalidation runs ONLY AFTER database operations successfully commit.
- **Revalidation Error Isolation:** If `revalidateTag` or `revalidatePath` encounters an internal Next.js error, the error is caught, logged with a generated operation ID (no user UUIDs or URLs exposed), and DOES NOT ROLL BACK the committed database transaction. The admin action returns a successful mutation result alongside a safe administrative warning.

## Consequences

### Positive
- **Instant Synchronization:** Public visitors see published projects and media updates immediately upon admin action.
- **Immediate Draft Protection:** Returning a project to draft invalidates `/portfolio/[slug]` instantly, turning it into a 404 for any subsequent request.
- **High Performance:** Unmodified public pages remain 100% cached at the edge or server response cache.

### Negative / Trade-offs
- Requires administrative Server Actions and API route handlers to invoke revalidation helpers consistently across all mutation endpoints.

## References
- [ADR-0014: Database-Controlled Portfolio Publication Workflow](file:///C:/Users/KESHAV%20SHARMA/Desktop/OneDecore/docs/ADR/ADR-0014-database-controlled-portfolio-publication.md)
- [ADR-0016: Public Portfolio Data Delivery Architecture](file:///C:/Users/KESHAV%20SHARMA/Desktop/OneDecore/docs/ADR/ADR-0016-public-portfolio-data-delivery.md)
