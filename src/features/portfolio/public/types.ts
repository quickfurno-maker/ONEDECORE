import type { PortfolioCategoryId } from "./portfolio-categories.ts";

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
