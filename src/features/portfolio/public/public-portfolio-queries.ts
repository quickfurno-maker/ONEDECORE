import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "../../../types/database.generated.ts";
import {
  PUBLIC_LISTING_PAGE_SIZE,
  MAX_HOMEPAGE_FEATURED,
  PUBLIC_ROOM_GALLERY_LIMIT,
} from "./constants.ts";
import {
  mapProjectToCard,
  mapProjectToDetail,
  mapRoomPhoto,
  type CardMediaFields,
  type CardServiceFields,
  type RoomPhotoFields,
} from "./public-portfolio-mapper.ts";
import type {
  PublicPortfolioCard,
  PublicPortfolioPaginatedCards,
  PublicPortfolioProject,
  PublicPortfolioRoomGallery,
  PublicSitemapEntry,
} from "./types.ts";
import type { PortfolioRoomCode } from "./portfolio-rooms.ts";

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

export const CATEGORY_COLUMNS = "project_id, category_code";

export const MEDIA_COLUMNS =
  "id, project_id, media_role, status, public_object_path, width_px, height_px, alt_text, caption, sort_order, created_at, room_category_code, focal_x, focal_y";

/**
 * Room-gallery projection: the photograph plus the project it belongs to.
 *
 * `portfolio_projects!inner` narrows to published parents in the database
 * rather than after the page window, so an unpublished project's photographs
 * never occupy a slot in someone else's gallery.
 */
export const ROOM_PHOTO_SELECT =
  "id, project_id, media_role, status, public_object_path, width_px, height_px, alt_text, caption, sort_order, created_at, room_category_code, focal_x, focal_y, portfolio_projects!inner(slug, title, status, location_label)";

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

/**
 * Category-filtered listing projections.
 *
 * The room category lives in its own many-to-many table now, so filtering by it
 * means an inner join rather than a column comparison. PostgREST returns the
 * PARENT once with only its matching children embedded, so a project mapped to
 * kitchen AND hall still appears exactly once in a kitchen listing -- the join
 * narrows the parent set, it does not multiply it.
 *
 * Written out in full rather than composed: the Supabase select-string type
 * parser infers row shapes from a single literal, and a composed or conditional
 * select degrades to a ParserError.
 */
export const LISTING_CATEGORY_SELECT =
  "id, slug, title, summary, status, published_at, location_label, property_type, completion_year, is_featured, portfolio_project_services!inner(service_code), portfolio_media!inner(id), portfolio_project_categories!inner(category_code)";

export const LISTING_CATEGORY_FILTERED_SELECT =
  "id, slug, title, summary, status, published_at, location_label, property_type, completion_year, is_featured, portfolio_project_services!inner(service_code), portfolio_media!inner(id), portfolio_project_categories!inner(category_code)";

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
  serviceFilter?: string,
  categoryFilter?: string
): Promise<PublicPortfolioPaginatedCards> {
  const offset = (page - 1) * PUBLIC_LISTING_PAGE_SIZE;
  const limit = PUBLIC_LISTING_PAGE_SIZE + 1;

  const empty: PublicPortfolioPaginatedCards = {
    cards: [],
    page,
    pageSize: PUBLIC_LISTING_PAGE_SIZE,
    hasNextPage: false,
    activeService: serviceFilter ?? null,
    activeCategory: categoryFilter ?? null,
  };

  /*
   * FOUR SHAPES, ONE PER FILTER COMBINATION.
   *
   * The category join has to be part of the select STRING when it is used, and
   * the select string must be a single literal for Supabase to infer the row
   * type, so the combinations are enumerated rather than composed. Service and
   * category filter independently and compose by intersection: asking for
   * kitchens sold as modular-kitchens narrows on both.
   *
   * An unclassified project has no row in the join table and is therefore
   * absent from every category listing. That is the point -- nobody has looked
   * at it, so it must not be shown to somebody who asked for bedrooms.
   */
  let base;
  if (categoryFilter && serviceFilter) {
    base = supabase
      .from("portfolio_projects")
      .select(LISTING_CATEGORY_FILTERED_SELECT)
      .eq("portfolio_project_services.service_code", serviceFilter)
      .eq("portfolio_project_categories.category_code", categoryFilter);
  } else if (categoryFilter) {
    base = supabase
      .from("portfolio_projects")
      .select(LISTING_CATEGORY_SELECT)
      .eq("portfolio_project_categories.category_code", categoryFilter);
  } else if (serviceFilter) {
    base = supabase
      .from("portfolio_projects")
      .select(LISTING_FILTERED_SELECT)
      .eq("portfolio_project_services.service_code", serviceFilter);
  } else {
    base = supabase.from("portfolio_projects").select(LISTING_SELECT);
  }

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
    activeCategory: categoryFilter ?? null,
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

  const { data: categories } = await supabase
    .from("portfolio_project_categories")
    .select(CATEGORY_COLUMNS)
    .eq("project_id", project.id);

  const { data: media } = await supabase
    .from("portfolio_media")
    .select(MEDIA_COLUMNS)
    .eq("project_id", project.id)
    .eq("status", "ready")
    .order("sort_order", { ascending: true })
    .order("created_at", { ascending: true })
    .order("id", { ascending: true });

  return mapProjectToDetail(project, services ?? [], media ?? [], categories ?? []);
}

/**
 * Every published photograph tagged with one room.
 *
 * THIS RETURNS MEDIA, NOT PROJECTS, and that is the whole correction. A visitor
 * who picks "Bedroom" wants to look at bedrooms; handing them whole-home case
 * studies that happen to contain a bedroom answers a different question, and
 * the alternative — splitting one delivered home into fake room-level projects
 * so each room gets a card — would put homes in the portfolio that were never
 * delivered as separate jobs.
 *
 * The filters are all applied in the database rather than after the window, so
 * an unpublished parent, an unprocessed image or an untagged photograph never
 * occupies a slot that a real one should have had.
 */
export async function queryRoomGallery(
  supabase: PublicSupabaseClient,
  room: PortfolioRoomCode
): Promise<PublicPortfolioRoomGallery> {
  const { data, error } = await supabase
    .from("portfolio_media")
    .select(ROOM_PHOTO_SELECT)
    .eq("room_category_code", room)
    .eq("status", "ready")
    .eq("portfolio_projects.status", "published")
    .not("public_object_path", "is", null)
    .order("sort_order", { ascending: true })
    .order("created_at", { ascending: true })
    .order("id", { ascending: true })
    .limit(PUBLIC_ROOM_GALLERY_LIMIT);

  if (error || !data || data.length === 0) {
    if (error) logRedacted("ROOM_GALLERY_QUERY_FAILED");
    return { room, photos: [] };
  }

  const photos = [];
  for (const row of data as unknown as RoomPhotoFields[]) {
    const photo = mapRoomPhoto(row);
    if (photo) photos.push(photo);
  }

  return { room, photos };
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
