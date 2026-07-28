/**
 * Approved shared homepage copy bridges.
 * Asset paths for UI live in ./content.ts (PM_ASSETS).
 */
import { SITE_CONFIG } from "@/config/site";
import { FEATURED_PORTFOLIO_COPY } from "@/features/portfolio/public/content/featured-portfolio";
import { PROCESS_STEPS } from "@/features/public-site/content/process";
import { SERVICE_STORIES } from "@/features/public-site/content/services";
import { TRUST_PILLARS } from "@/features/public-site/content/trust";

export { FEATURED_PORTFOLIO_COPY, PROCESS_STEPS, SITE_CONFIG, TRUST_PILLARS };

export const SERVICE_CARDS = SERVICE_STORIES.map((story) => ({
  id: story.id,
  ordinal: story.ordinal,
  title: story.title,
  description: story.description,
}));
