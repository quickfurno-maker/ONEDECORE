export type PublicPortfolioServiceCode =
  | "complete_home_interiors"
  | "modular_kitchens"
  | "custom_wardrobes";

export type PublicPortfolioService = {
  serviceCode: PublicPortfolioServiceCode;
  serviceLabel: string;
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
  cover: PublicPortfolioImage;
  gallery: PublicPortfolioImage[];
};

export type PublicPortfolioPaginatedCards = {
  cards: PublicPortfolioCard[];
  page: number;
  pageSize: number;
  hasNextPage: boolean;
  activeService: string | null;
};

export type PublicSitemapEntry = {
  slug: string;
  lastModified: Date;
};
