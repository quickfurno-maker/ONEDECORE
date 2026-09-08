import { PUBLIC_CACHE_TAGS } from "./constants.ts";

/**
 * Pure cache-key and invalidation-target derivation.
 *
 * Kept free of `server-only` and `next/cache` imports so the cache contract can
 * be asserted directly in tests instead of inferred from a running server.
 */

export function featuredCacheKeyParts(): string[] {
  return ["public-portfolio", "featured"];
}

/**
 * The listing cache identity.
 *
 * The category belongs IN here, not appended by the caller. It was appended
 * before, which meant this pure function -- the one the tests read -- described
 * a key the runtime did not actually use. Two listings that differ only by
 * category must not share an entry, and the function that says so should be the
 * function that proves it.
 */
export function listingCacheKeyParts(
  page: number,
  serviceFilter?: string,
  categoryFilter?: string
): string[] {
  return [
    "public-portfolio",
    "list",
    `page:${page}`,
    `service:${serviceFilter ?? "all"}`,
    `category:${categoryFilter ?? "all"}`,
  ];
}

/**
 * A room gallery's cache identity.
 *
 * The room is IN the key, not appended by the caller: two rooms must never
 * share an entry, and the function that says so should be the one a test can
 * read.
 */
export function roomGalleryCacheKeyParts(room: string): string[] {
  return ["public-portfolio", "room", `room:${room}`];
}

export function detailCacheKeyParts(slug: string): string[] {
  return ["public-portfolio", "project", `slug:${slug}`];
}

export function sitemapCacheKeyParts(): string[] {
  return ["public-portfolio", "sitemap"];
}

/**
 * Every tag a Portfolio mutation must expire. The project tag is slug-scoped,
 * so a rename has to be invalidated under both the old and the new slug.
 */
export function publicPortfolioTagsFor(slug: string): string[] {
  return [
    PUBLIC_CACHE_TAGS.FEATURED,
    PUBLIC_CACHE_TAGS.LIST,
    // Room galleries draw from the same media a project mutation touches, so
    // any portfolio change expires them too.
    PUBLIC_CACHE_TAGS.ROOMS,
    PUBLIC_CACHE_TAGS.SITEMAP,
    PUBLIC_CACHE_TAGS.PROJECT(slug),
  ];
}

/** Every rendered path a Portfolio mutation must refresh. */
export function publicPortfolioPathsFor(slug: string): string[] {
  return ["/", "/portfolio", `/portfolio/${slug}`, "/sitemap.xml"];
}
