import "server-only";
import { getFeaturedProjects } from "@/features/portfolio/public/public-portfolio-cache";
import type { PublicPortfolioCard } from "@/features/portfolio/public/types";

/**
 * Single cached read of the featured projects for a concept page.
 *
 * Concepts reuse the production cache entry rather than querying Supabase
 * themselves, so no concept adds a second fetch or a new cache key. A preview
 * page must still render for the owner when the database is unreachable, so a
 * transport failure degrades to the same empty state the production section
 * already handles.
 */
export async function loadConceptFeatured(): Promise<PublicPortfolioCard[]> {
  try {
    return await getFeaturedProjects();
  } catch {
    return [];
  }
}
