import "server-only";
import { unstable_cache } from "next/cache";
import { PUBLIC_CACHE_TAGS } from "./constants.ts";
import {
  detailCacheKeyParts,
  featuredCacheKeyParts,
  listingCacheKeyParts,
  sitemapCacheKeyParts,
} from "./public-cache-keys.ts";
import {
  fetchFeaturedProjects,
  fetchPaginatedProjects,
  fetchProjectBySlug,
  fetchSitemapEntries,
} from "./public-portfolio-repository.ts";
import type {
  PublicPortfolioCard,
  PublicPortfolioPaginatedCards,
  PublicPortfolioProject,
  PublicSitemapEntry,
} from "./types.ts";

/**
 * Cached read paths for public Portfolio delivery.
 *
 * Every callback is an anonymous query with no cookie, header or session
 * access, which is what makes a shared cache entry safe. Entries never expire
 * on a timer (`revalidate: false`); publication changes are pushed through the
 * invalidation helper instead.
 */

export function getFeaturedProjects(): Promise<PublicPortfolioCard[]> {
  return unstable_cache(fetchFeaturedProjects, featuredCacheKeyParts(), {
    tags: [PUBLIC_CACHE_TAGS.FEATURED],
    revalidate: false,
  })();
}

export function getPaginatedProjects(
  page: number,
  serviceFilter?: string
): Promise<PublicPortfolioPaginatedCards> {
  return unstable_cache(
    () => fetchPaginatedProjects(page, serviceFilter),
    listingCacheKeyParts(page, serviceFilter),
    {
      tags: [PUBLIC_CACHE_TAGS.LIST],
      revalidate: false,
    }
  )();
}

export function getProjectBySlug(
  slug: string
): Promise<PublicPortfolioProject | null> {
  return unstable_cache(
    () => fetchProjectBySlug(slug),
    detailCacheKeyParts(slug),
    {
      tags: [PUBLIC_CACHE_TAGS.PROJECT(slug)],
      revalidate: false,
    }
  )();
}

export function getSitemapEntries(): Promise<PublicSitemapEntry[]> {
  return unstable_cache(fetchSitemapEntries, sitemapCacheKeyParts(), {
    tags: [PUBLIC_CACHE_TAGS.SITEMAP],
    revalidate: false,
  })();
}
