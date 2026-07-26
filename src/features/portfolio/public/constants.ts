export const PORTFOLIO_SERVICE_LABELS = {
  complete_home_interiors: "Complete Home Interiors",
  modular_kitchens: "Modular Kitchens",
  custom_wardrobes: "Custom Wardrobes",
} as const;

export type PortfolioServiceKey = keyof typeof PORTFOLIO_SERVICE_LABELS;

export const SLUG_GRAMMAR_REGEX = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

export const PUBLIC_CACHE_TAGS = {
  FEATURED: "portfolio:featured",
  LIST: "portfolio:list",
  SITEMAP: "portfolio:sitemap",
  PROJECT: (slug: string) => `portfolio:project:${slug}`,
} as const;

export const PUBLIC_STORAGE_BUCKET = "portfolio-public";

/**
 * The only derivative filenames the media pipeline writes to the public bucket.
 * Kept in sync with src/app/api/admin/portfolio/media/route.ts.
 */
export const PUBLIC_DERIVATIVE_FILENAMES = [
  "cover-1600.webp",
  "gallery-1200.webp",
  "thumb-480.webp",
] as const;

export const MAX_HOMEPAGE_FEATURED = 6;
export const PUBLIC_LISTING_PAGE_SIZE = 12;
export const MAX_GALLERY_IMAGES = 12;
