export const SITE_CONFIG = {
  name: "ONEDECORE",
  tagline: "One Vision. Complete Interiors.",
  url: "https://onedecore.in",
  locale: "en_IN",
} as const;

// Helper to build absolute URLs safely
export function absoluteUrl(path: string): string {
  // Ensure path does not start with a slash
  const cleaned = path.startsWith("/") ? path.slice(1) : path;
  return `${SITE_CONFIG.url}/${cleaned}`;
}

export function canonicalPortfolioUrl(slug: string): string {
  return absoluteUrl(`portfolio/${slug}`);
}

export function formatSiteTitle(pageTitle?: string): string {
  return pageTitle ? `${pageTitle} — ${SITE_CONFIG.name}` : SITE_CONFIG.name;
}
