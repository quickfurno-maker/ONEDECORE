import type { PortfolioCategoryId } from "./portfolio-categories.ts";
import type { PortfolioRoomCode } from "./portfolio-rooms.ts";

export type PublicPortfolioServiceCode =
  | "complete_home_interiors"
  | "modular_kitchens"
  | "custom_wardrobes";

export type PublicPortfolioService = {
  serviceCode: PublicPortfolioServiceCode;
  serviceLabel: string;
};

/**
 * The room categories a project can be browsed under.
 *
 * A list, not a scalar: one whole-home project legitimately spans several. The
 * ids are the canonical ones from `portfolio-categories.ts` -- this module does
 * not restate the labels.
 */
export type PublicPortfolioCategory = {
  categoryId: PortfolioCategoryId;
  categoryLabel: string;
};

export type PublicPortfolioImage = {
  url: string;
  altText: string;
  caption: string | null;
  width: number;
  height: number;
  role: "cover" | "gallery";
  /** Which room this photograph shows, or null when it is not room-browsable. */
  roomCode: PortfolioRoomCode | null;
  /** Point of interest, 0-100 percent, so one original serves every crop. */
  focalX: number;
  focalY: number;
};

/**
 * One photograph in a room gallery, carrying the project it came from.
 *
 * The room views list PHOTOGRAPHS, not projects, but every photograph still
 * belongs to a delivered home and must be able to say which — otherwise the
 * gallery is a mood board and the visitor cannot get from an image they like to
 * the project that produced it.
 */
/**
 * One photograph in a room view.
 *
 * `project` IS NULLABLE, AND THAT IS THE WHOLE SHAPE OF THE FEATURE.
 *
 * A room view now draws from two sources: photographs belonging to a published
 * project, and standalone library images that belong to no project at all. The
 * second kind has no slug, no title and no locality, so those fields are
 * grouped into one nullable object rather than left as three independently
 * nullable strings — which would let a renderer read a title while the slug was
 * null and produce a card linking nowhere.
 *
 * Null here means "there is no project", not "we failed to load one". A
 * renderer must show the image without project chrome, never invent an href.
 */
export type PublicPortfolioRoomPhotoProject = {
  slug: string;
  title: string;
  locationLabel: string | null;
};

export type PublicPortfolioRoomPhoto = {
  mediaId: string;
  roomCode: PortfolioRoomCode;
  image: PublicPortfolioImage;
  project: PublicPortfolioRoomPhotoProject | null;
  sortOrder: number;
  /** Ordering tiebreak across the two sources. */
  createdAt: string;
};

export type PublicPortfolioRoomGallery = {
  room: PortfolioRoomCode;
  photos: PublicPortfolioRoomPhoto[];
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
  categories: PublicPortfolioCategory[];
  cover: PublicPortfolioImage;
  gallery: PublicPortfolioImage[];
};

export type PublicPortfolioPaginatedCards = {
  cards: PublicPortfolioCard[];
  page: number;
  pageSize: number;
  hasNextPage: boolean;
  activeService: string | null;
  activeCategory: string | null;
};

export type PublicSitemapEntry = {
  slug: string;
  lastModified: Date;
};
