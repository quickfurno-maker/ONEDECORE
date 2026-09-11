import type { Database } from "../../../types/database.ts";
import {
  PORTFOLIO_SERVICE_LABELS,
  SLUG_GRAMMAR_REGEX,
  MAX_GALLERY_IMAGES,
} from "./constants.ts";
import type { PortfolioServiceKey } from "./constants.ts";
import {
  PORTFOLIO_CATEGORIES,
  isPortfolioCategoryId,
} from "./portfolio-categories.ts";
import {
  FOCAL_DEFAULT,
  isPortfolioRoomCode,
  normaliseFocalValue,
} from "./portfolio-rooms.ts";
import { buildPublicStorageUrl } from "./public-url.ts";
import type {
  PublicPortfolioCard,
  PublicPortfolioCategory,
  PublicPortfolioImage,
  PublicPortfolioProject,
  PublicPortfolioRoomPhoto,
  PublicPortfolioService,
} from "./types.ts";

type ProjectRow = Database["public"]["Tables"]["portfolio_projects"]["Row"];
type ServiceRow = Database["public"]["Tables"]["portfolio_project_services"]["Row"];
type MediaRow = Database["public"]["Tables"]["portfolio_media"]["Row"];
type CategoryRow =
  Database["public"]["Tables"]["portfolio_project_categories"]["Row"];

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

export type CardCategoryFields = Pick<
  CategoryRow,
  "project_id" | "category_code"
>;

/**
 * Category rows -> public DTOs, in the canonical order.
 *
 * Ordered by `PORTFOLIO_CATEGORIES` rather than by whatever order the database
 * returned, so a project's chips read the same on every request. Unknown codes
 * are dropped rather than rendered: the check constraint should make them
 * impossible, and a label this module invented would be worse than an omission.
 */
export function mapProjectCategories(
  projectId: string,
  categories: CardCategoryFields[]
): PublicPortfolioCategory[] {
  const codes = new Set(
    categories
      .filter((c) => c.project_id === projectId)
      .map((c) => c.category_code)
      .filter(isPortfolioCategoryId)
  );

  return PORTFOLIO_CATEGORIES.filter((c) => codes.has(c.id)).map((c) => ({
    categoryId: c.id,
    categoryLabel: c.label,
  }));
}

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
  | "room_category_code"
  | "focal_x"
  | "focal_y"
>;

/**
 * Room-photo fields plus the parent project a gallery card has to name.
 *
 * A room gallery lists photographs, but every photograph still belongs to a
 * delivered home — an image the visitor likes has to lead somewhere.
 */
export type RoomPhotoFields = CardMediaFields & {
  portfolio_projects: {
    slug: string;
    title: string;
    status: string;
    location_label: string | null;
  } | null;
};

/** A standalone library row, which has no embedded project to join. */
export type LibraryRoomPhotoFields = CardMediaFields & {
  room_gallery_published: boolean;
};

/**
 * One media row -> one room-gallery photograph, or null.
 *
 * The guards are the same displayability contract the cards use, applied to a
 * single image: the parent must be published, the photograph must be processed
 * and stored, and it must actually be tagged with the room being browsed. A row
 * failing any of those is skipped rather than rendered as a gap.
 */
export function mapRoomPhoto(
  media: RoomPhotoFields
): PublicPortfolioRoomPhoto | null {
  const project = media.portfolio_projects;
  if (!project || project.status !== "published") return null;
  if (!project.slug || !SLUG_GRAMMAR_REGEX.test(project.slug)) return null;

  if (media.status !== "ready") return null;
  if (media.media_role !== "cover" && media.media_role !== "gallery") return null;
  if (!isPortfolioRoomCode(media.room_category_code)) return null;
  if (!media.public_object_path) return null;
  if (!media.width_px || media.width_px <= 0) return null;
  if (!media.height_px || media.height_px <= 0) return null;

  const url = buildPublicStorageUrl(media.public_object_path, {
    expectedProjectUuid: media.project_id,
    expectedMediaUuid: media.id,
  });
  if (!url) return null;

  return {
    mediaId: media.id,
    roomCode: media.room_category_code,
    image: {
      url,
      // The project title is a poor alt text but a real one; an empty alt on a
      // content image is worse than a generic description.
      altText: media.alt_text?.trim() || project.title,
      caption: media.caption ?? null,
      width: media.width_px,
      height: media.height_px,
      role: media.media_role,
      roomCode: media.room_category_code,
      focalX: normaliseFocalValue(media.focal_x ?? FOCAL_DEFAULT),
      focalY: normaliseFocalValue(media.focal_y ?? FOCAL_DEFAULT),
    },
    project: {
      slug: project.slug,
      title: project.title,
      locationLabel: project.location_label ?? null,
    },
    sortOrder: media.sort_order ?? 0,
    createdAt: media.created_at,
  };
}

/**
 * One STANDALONE library row -> one room-gallery photograph, or null.
 *
 * The guards mirror `mapRoomPhoto`, minus the project and plus the two things
 * that replace it: the row must genuinely have no project, and it must be
 * explicitly published into the room gallery. Both are already enforced by RLS,
 * and both are checked again here — this mapper is the last place that can stop
 * an unpublished photograph reaching a page, and it costs two comparisons.
 *
 * `project: null` is returned deliberately rather than a placeholder. There is
 * no project, and the renderer has to be told that rather than being handed a
 * plausible-looking object with empty strings in it.
 */
export function mapLibraryRoomPhoto(
  media: LibraryRoomPhotoFields
): PublicPortfolioRoomPhoto | null {
  if (media.project_id !== null) return null;
  if (media.room_gallery_published !== true) return null;
  if (media.status !== "ready") return null;
  if (media.media_role !== "gallery") return null;
  if (!isPortfolioRoomCode(media.room_category_code)) return null;
  if (!media.public_object_path) return null;
  if (!media.width_px || media.width_px <= 0) return null;
  if (!media.height_px || media.height_px <= 0) return null;

  const url = buildPublicStorageUrl(media.public_object_path, {
    expectedProjectUuid: null,
    expectedMediaUuid: media.id,
    expectedRoomCode: media.room_category_code,
  });
  if (!url) return null;

  const altText = media.alt_text?.trim();
  // No project title to fall back on here, so an empty alt is fatal rather
  // than merely poor. The upload route guarantees one; this is the backstop.
  if (!altText) return null;

  return {
    mediaId: media.id,
    roomCode: media.room_category_code,
    image: {
      url,
      altText,
      caption: media.caption ?? null,
      width: media.width_px,
      height: media.height_px,
      role: "gallery",
      roomCode: media.room_category_code,
      focalX: normaliseFocalValue(media.focal_x ?? FOCAL_DEFAULT),
      focalY: normaliseFocalValue(media.focal_y ?? FOCAL_DEFAULT),
    },
    project: null,
    sortOrder: media.sort_order ?? 0,
    createdAt: media.created_at,
  };
}

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
    /*
     * A cover is normally unclassified — it is the picture that represents the
     * whole home, not a room. The field travels anyway so a surface that wants
     * to label it can, without a second query.
     */
    roomCode: isPortfolioRoomCode(coverRow.room_category_code)
      ? coverRow.room_category_code
      : null,
    focalX: normaliseFocalValue(coverRow.focal_x ?? FOCAL_DEFAULT),
    focalY: normaliseFocalValue(coverRow.focal_y ?? FOCAL_DEFAULT),
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
  media: CardMediaFields[],
  categories: CardCategoryFields[] = []
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
        roomCode: isPortfolioRoomCode(m.room_category_code)
          ? m.room_category_code
          : null,
        focalX: normaliseFocalValue(m.focal_x ?? FOCAL_DEFAULT),
        focalY: normaliseFocalValue(m.focal_y ?? FOCAL_DEFAULT),
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
    categories: mapProjectCategories(project.id, categories),
    cover: card.cover,
    gallery,
  };
}
