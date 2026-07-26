import "server-only";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "../../../types/database.generated.ts";
import {
  queryFeaturedProjects,
  queryPaginatedProjects,
  queryProjectBySlug,
  querySitemapEntries,
  type PublicSupabaseClient,
} from "./public-portfolio-queries.ts";
import type {
  PublicPortfolioCard,
  PublicPortfolioPaginatedCards,
  PublicPortfolioProject,
  PublicSitemapEntry,
} from "./types.ts";

/**
 * Server-only binding for the uncached public Portfolio queries.
 *
 * Public delivery relies entirely on anonymous RLS: no cookie, no request
 * header, no authenticated SSR session and no service-role credential. That is
 * what makes the results safe to share across all visitors in the cache layer.
 */
export function createPublicAnonClient(): PublicSupabaseClient {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

  if (!supabaseUrl || !supabaseKey) {
    throw new Error("Missing Supabase public environment variables");
  }

  return createClient<Database>(supabaseUrl, supabaseKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
  });
}

export function fetchFeaturedProjects(): Promise<PublicPortfolioCard[]> {
  return queryFeaturedProjects(createPublicAnonClient());
}

export function fetchPaginatedProjects(
  page: number,
  serviceFilter?: string
): Promise<PublicPortfolioPaginatedCards> {
  return queryPaginatedProjects(createPublicAnonClient(), page, serviceFilter);
}

export function fetchProjectBySlug(
  slug: string
): Promise<PublicPortfolioProject | null> {
  return queryProjectBySlug(createPublicAnonClient(), slug);
}

export function fetchSitemapEntries(): Promise<PublicSitemapEntry[]> {
  return querySitemapEntries(createPublicAnonClient());
}
