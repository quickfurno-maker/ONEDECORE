import { SITE_CONFIG } from "@/config/site";

/** Frozen C3 homepage copy — factual only; no unsupported claims. */
export const HOMEPAGE_COPY = {
  h1: SITE_CONFIG.tagline,
  supportingLine:
    "Complete home interiors, modular kitchens, and custom wardrobes in Pune.",
  ctaLabel: "Explore Our Work",
  ctaHref: "/portfolio",
} as const;

export const BRAND_PROPOSITION_COPY = {
  heading: "Interior design with clarity and craft",
  body:
    "ONEDECORE brings complete home interiors, modular kitchens, and custom wardrobes to homes across Pune — with a single vision from concept through installation.",
} as const;
