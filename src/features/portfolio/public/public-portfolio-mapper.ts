import type { Database } from "../../../types/database.generated.ts";
import {
  PORTFOLIO_SERVICE_LABELS,
  SLUG_GRAMMAR_REGEX,
  MAX_GALLERY_IMAGES,
} from "./constants.ts";
import type { PortfolioServiceKey } from "./constants.ts";
import { buildPublicStorageUrl } from "./public-url.ts";
import type {
  PublicPortfolioCard,
  PublicPortfolioImage,
  PublicPortfolioProject,
  PublicPortfolioService,
} from "./types.ts";

type ProjectRow = Database["public"]["Tables"]["portfolio_projects"]["Row"];
type ServiceRow = Database["public"]["Tables"]["portfolio_project_services"]["Row"];
type MediaRow = Database["public"]["Tables"]["portfolio_media"]["Row"];

/**
 * The mappers accept column subsets so callers can select only what the public
 * DTO needs instead of `select("*")`, which would pull audit and owner columns
 * into the public layer.
 */
export type CardProjectFields = Pick<
  ProjectRow,
  | "id"
  | "slug"
  | "title"
  | "summary"
  | "status"
  | "published_at"
  | "location_label"
  | "property_type"
  | "completion_year"
  | "is_featured"
>;

export type DetailProjectFields = CardProjectFields &
  Pick<ProjectRow, "description" | "seo_title" | "seo_description">;

export type CardServiceFields = Pick<ServiceRow, "project_id" | "service_code">;

export type CardMediaFields = Pick<
  MediaRow,
  | "id"
  | "project_id"
  | "media_role"
  | "status"
  | "public_object_path"
  | "width_px"
  | "height_px"
  | "alt_text"
  | "caption"
  | "sort_order"
  | "created_at"
>;

export function mapProjectToCard(
  project: CardProjectFields,
  services: CardServiceFields[],
  media: CardMediaFields[]
): PublicPortfolioCard | null {
  // Invariant 1: Published status
  if (project.status !== "published") {
    console.error("[PublicPortfolioMapper] Redacted operation: MALFORMED_PROJECT_SKIPPED");
    return null;
  }

  // Invariant 2: Slug grammar
  if (!project.slug || !SLUG_GRAMMAR_REGEX.test(project.slug)) {
    console.error("[PublicPortfolioMapper] Redacted operation: MALFORMED_PROJECT_SKIPPED");
    return null;
  }

  // Invariant 3: Published date
  if (!project.published_at || isNaN(Date.parse(project.published_at))) {
    console.error("[PublicPortfolioMapper] Redacted operation: MALFORMED_PROJECT_SKIPPED");
    return null;
  }

  // Invariant 4: Non-empty valid services
  const mappedServices: PublicPortfolioService[] = [];
  for (const s of services) {
    // Object.hasOwn, not `in`: `in` walks the prototype chain and would treat
    // "__proto__" or "constructor" as a recognised service code.
    if (Object.hasOwn(PORTFOLIO_SERVICE_LABELS, s.service_code)) {
      mappedServices.push({
        serviceCode: s.service_code as PortfolioServiceKey,
        serviceLabel: PORTFOLIO_SERVICE_LABELS[s.service_code as PortfolioServiceKey],
      });
    }
  }

  if (mappedServices.length === 0) {
    console.error("[PublicPortfolioMapper] Redacted operation: MALFORMED_PROJECT_SKIPPED");
    return null;
  }

  // Invariant 5 & 6: Cover image validation and ownership check
  const coverRow = media.find(
    (m) =>
      m.project_id === project.id &&
      m.media_role === "cover" &&
      m.status === "ready" &&
      m.public_object_path &&
      m.width_px &&
      m.width_px > 0 &&
      m.height_px &&
      m.height_px > 0
  );

  if (!coverRow || !coverRow.public_object_path) {
    console.error("[PublicPortfolioMapper] Redacted operation: MALFORMED_PROJECT_SKIPPED");
    return null;
  }

  const coverUrl = buildPublicStorageUrl(coverRow.public_object_path, {
    expectedProjectUuid: project.id,
    expectedMediaUuid: coverRow.id,
  });

  if (!coverUrl) {
    console.error("[PublicPortfolioMapper] Redacted operation: MALFORMED_PROJECT_SKIPPED");
    return null;
  }

  const cover: PublicPortfolioImage = {
    url: coverUrl,
    altText: coverRow.alt_text?.trim() || project.title,
    caption: coverRow.caption ?? null,
    width: coverRow.width_px!,
    height: coverRow.height_px!,
    role: "cover",
  };

  return {
    slug: project.slug,
    title: project.title,
    summary: project.summary,
    locationLabel: project.location_label ?? null,
    propertyType: project.property_type ?? null,
    completionYear: project.completion_year ?? null,
    isFeatured: Boolean(project.is_featured),
    services: mappedServices,
    cover,
  };
}

export function mapProjectToDetail(
  project: DetailProjectFields,
  services: CardServiceFields[],
  media: CardMediaFields[]
): PublicPortfolioProject | null {
  const card = mapProjectToCard(project, services, media);
  if (!card) {
    return null;
  }

  // Gallery items selection
  const galleryRows = media
    .filter(
      (m) =>
        m.project_id === project.id &&
        m.media_role === "gallery" &&
        m.status === "ready" &&
        m.public_object_path &&
        m.width_px &&
        m.width_px > 0 &&
        m.height_px &&
        m.height_px > 0
    )
    .sort((a, b) => {
      const sortDiff = (a.sort_order ?? 0) - (b.sort_order ?? 0);
      if (sortDiff !== 0) return sortDiff;
      const timeDiff = new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
      if (timeDiff !== 0) return timeDiff;
      return a.id.localeCompare(b.id);
    })
    .slice(0, MAX_GALLERY_IMAGES);

  const gallery: PublicPortfolioImage[] = [];
  for (const m of galleryRows) {
    const url = buildPublicStorageUrl(m.public_object_path!, {
      expectedProjectUuid: project.id,
      expectedMediaUuid: m.id,
    });
    if (url) {
      gallery.push({
        url,
        altText: m.alt_text?.trim() || project.title,
        caption: m.caption ?? null,
        width: m.width_px!,
        height: m.height_px!,
        role: "gallery",
      });
    }
  }

  return {
    slug: card.slug,
    title: card.title,
    summary: card.summary,
    description: project.description ?? null,
    locationLabel: card.locationLabel,
    propertyType: card.propertyType,
    completionYear: card.completionYear,
    seoTitle: project.seo_title ?? null,
    seoDescription: project.seo_description ?? null,
    publishedAt: project.published_at!,
    services: card.services,
    cover: card.cover,
    gallery,
  };
}
