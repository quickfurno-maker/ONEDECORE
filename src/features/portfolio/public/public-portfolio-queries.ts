import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "../../../types/database.generated.ts";
import { PUBLIC_LISTING_PAGE_SIZE, MAX_HOMEPAGE_FEATURED } from "./constants.ts";
import {
  mapProjectToCard,
  mapProjectToDetail,
  type CardMediaFields,
  type CardServiceFields,
} from "./public-portfolio-mapper.ts";
import type {
  PublicPortfolioCard,
  PublicPortfolioPaginatedCards,
  PublicPortfolioProject,
  PublicSitemapEntry,
} from "./types.ts";

export type PublicSupabaseClient = SupabaseClient<Database>;

/**
 * Uncached anonymous Portfolio queries.
 *
 * The Supabase client is injected rather than constructed here so this module
 * stays free of `server-only` and can be exercised directly in tests. The
 * server-only binding lives in public-portfolio-repository.ts.
 *
 * Column projections are explicit so audit, owner and private-origin columns
 * never enter the public data path.
 */

export const CARD_PROJECT_COLUMNS =
  "id, slug, title, summary, status, published_at, location_label, property_type, completion_year, is_featured";

export const DETAIL_PROJECT_COLUMNS = `${CARD_PROJECT_COLUMNS}, description, seo_title, seo_description`;

export const SERVICE_COLUMNS = "project_id, service_code";

export const MEDIA_COLUMNS =
  "id, project_id, media_role, status, public_object_path, width_px, height_px, alt_text, caption, sort_order, created_at";

/**
 * Listing projections.
 *
 * Written out in full rather than composed from CARD_PROJECT_COLUMNS: the
 * Supabase select-string type parser only infers row shapes from a single
 * literal, so a composed or conditional select degrades to a ParserError.
 *
 * Both variants inner-join services and cover media so undisplayable projects
 * are excluded by the database. Filtering them out after the page window was
 * applied would return short pages and compute hasNextPage from the filtered
 * count, which silently hides later projects.
 */
export const LISTING_SELECT =
  "id, slug, title, summary, status, published_at, location_label, property_type, completion_year, is_featured, portfolio_project_services!inner(service_code), portfolio_media!inner(id)";

export const LISTING_FILTERED_SELECT =
  "id, slug, title, summary, status, published_at, location_label, property_type, completion_year, is_featured, portfolio_project_services!inner(service_code), portfolio_media!inner(id)";

/** Single embedded projection backing the one-request sitemap contract. */
export const SITEMAP_SELECT = `${CARD_PROJECT_COLUMNS}, updated_at,
   portfolio_project_services(${SERVICE_COLUMNS}, created_at),
   portfolio_media(${MEDIA_COLUMNS}, updated_at)`;

function logRedacted(operation: string): void {
  console.error(`[PublicPortfolioQueries] Redacted operation: ${operation}`);
}

function collectCards(
  projects: Array<Parameters<typeof mapProjectToCard>[0]>,
  services: CardServiceFields[],
  media: CardMediaFields[]
): PublicPortfolioCard[] {
  const cards: PublicPortfolioCard[] = [];

  for (const project of projects) {
    const card = mapProjectToCard(
      project,
      services.filter((s) => s.project_id === project.id),
      media.filter((m) => m.project_id === project.id)
    );
    if (card) {
      cards.push(card);
    }
  }

  return cards;
}

/**
 * Resolves the sitemap `lastModified` for one project as the newest of the
 * project row, its publication timestamp, its service mappings and its ready
 * public media.
 */
export function resolveLastModified(input: {
  updated_at: string;
  published_at: string | null;
  services: Array<{ created_at: string }>;
  media: Array<{ updated_at: string }>;
}): Date {
  const candidates = [
    Date.parse(input.updated_at),
    Date.parse(input.published_at ?? ""),
    ...input.services.map((s) => Date.parse(s.created_at)),
    ...input.media.map((m) => Date.parse(m.updated_at)),
  ].filter((t) => Number.isFinite(t));

  return new Date(Math.max(...candidates));
}

/** Homepage featured projects. Featured-only, never backfilled. */
export async function queryFeaturedProjects(
  supabase: PublicSupabaseClient
): Promise<PublicPortfolioCard[]> {
  const { data: projects, error } = await supabase
    .from("portfolio_projects")
    .select(CARD_PROJECT_COLUMNS)
    .eq("status", "published")
    .eq("is_featured", true)
    .order("sort_order", { ascending: true })
    .order("published_at", { ascending: false })
    .order("id", { ascending: true })
    .limit(MAX_HOMEPAGE_FEATURED);

  if (error || !projects || projects.length === 0) {
    if (error) logRedacted("FEATURED_QUERY_FAILED");
    return [];
  }

  const projectIds = projects.map((p) => p.id);

  const { data: services } = await supabase
    .from("portfolio_project_services")
    .select(SERVICE_COLUMNS)
    .in("project_id", projectIds);

  const { data: media } = await supabase
    .from("portfolio_media")
    .select(MEDIA_COLUMNS)
    .in("project_id", projectIds)
    .eq("status", "ready")
    .eq("media_role", "cover")
    .order("sort_order", { ascending: true })
    .order("created_at", { ascending: true })
    .order("id", { ascending: true });

  return collectCards(projects, services ?? [], media ?? []);
}

/**
 * Bounded listing. Requests one row beyond the page size to derive
 * hasNextPage without a second count query.
 */
export async function queryPaginatedProjects(
  supabase: PublicSupabaseClient,
  page: number,
  serviceFilter?: string
): Promise<PublicPortfolioPaginatedCards> {
  const offset = (page - 1) * PUBLIC_LISTING_PAGE_SIZE;
  const limit = PUBLIC_LISTING_PAGE_SIZE + 1;

  const empty: PublicPortfolioPaginatedCards = {
    cards: [],
    page,
    pageSize: PUBLIC_LISTING_PAGE_SIZE,
    hasNextPage: false,
    activeService: serviceFilter ?? null,
  };

  const base = serviceFilter
    ? supabase
        .from("portfolio_projects")
        .select(LISTING_FILTERED_SELECT)
        .eq("portfolio_project_services.service_code", serviceFilter)
    : supabase.from("portfolio_projects").select(LISTING_SELECT);

  const { data: projects, error } = await base
    .eq("status", "published")
    .eq("portfolio_media.status", "ready")
    .eq("portfolio_media.media_role", "cover")
    .not("portfolio_media.public_object_path", "is", null)
    .order("is_featured", { ascending: false })
    .order("sort_order", { ascending: true })
    .order("published_at", { ascending: false })
    .order("id", { ascending: true })
    .range(offset, offset + limit - 1);

  if (error || !projects || projects.length === 0) {
    if (error) logRedacted("LISTING_QUERY_FAILED");
    return empty;
  }

  const projectIds = projects.map((p) => p.id);

  const { data: services } = await supabase
    .from("portfolio_project_services")
    .select(SERVICE_COLUMNS)
    .in("project_id", projectIds);

  const { data: media } = await supabase
    .from("portfolio_media")
    .select(MEDIA_COLUMNS)
    .in("project_id", projectIds)
    .eq("status", "ready")
    .eq("media_role", "cover")
    .order("sort_order", { ascending: true })
    .order("created_at", { ascending: true })
    .order("id", { ascending: true });

  const cards = collectCards(projects, services ?? [], media ?? []);

  return {
    cards: cards.slice(0, PUBLIC_LISTING_PAGE_SIZE),
    page,
    pageSize: PUBLIC_LISTING_PAGE_SIZE,
    hasNextPage: cards.length > PUBLIC_LISTING_PAGE_SIZE,
    activeService: serviceFilter ?? null,
  };
}

/** Detail lookup. Returns null for draft, archived, missing and malformed projects. */
export async function queryProjectBySlug(
  supabase: PublicSupabaseClient,
  slug: string
): Promise<PublicPortfolioProject | null> {
  const { data: project, error } = await supabase
    .from("portfolio_projects")
    .select(DETAIL_PROJECT_COLUMNS)
    .eq("status", "published")
    .eq("slug", slug)
    .maybeSingle();

  if (error || !project) {
    if (error) logRedacted("DETAIL_QUERY_FAILED");
    return null;
  }

  const { data: services } = await supabase
    .from("portfolio_project_services")
    .select(SERVICE_COLUMNS)
    .eq("project_id", project.id);

  const { data: media } = await supabase
    .from("portfolio_media")
    .select(MEDIA_COLUMNS)
    .eq("project_id", project.id)
    .eq("status", "ready")
    .order("sort_order", { ascending: true })
    .order("created_at", { ascending: true })
    .order("id", { ascending: true });

  return mapProjectToDetail(project, services ?? [], media ?? []);
}

/**
 * Sitemap entries in exactly one Supabase request. Services and ready media
 * are embedded so the project count never drives the request count.
 */
export async function querySitemapEntries(
  supabase: PublicSupabaseClient
): Promise<PublicSitemapEntry[]> {
  const { data: projects, error } = await supabase
    .from("portfolio_projects")
    .select(SITEMAP_SELECT)
    .eq("status", "published")
    .eq("portfolio_media.status", "ready");

  if (error || !projects || projects.length === 0) {
    if (error) logRedacted("SITEMAP_QUERY_FAILED");
    return [];
  }

  const entries: PublicSitemapEntry[] = [];

  for (const project of projects) {
    const services = project.portfolio_project_services ?? [];
    const media = project.portfolio_media ?? [];

    // Reuse the displayable contract so drafts, archived and malformed
    // projects are excluded on real data rather than placeholder values.
    const card = mapProjectToCard(project, services, media);
    if (!card) {
      continue;
    }

    entries.push({
      slug: card.slug,
      lastModified: resolveLastModified({
        updated_at: project.updated_at,
        published_at: project.published_at,
        services,
        media,
      }),
    });
  }

  return entries;
}
