/**
 * Single source of approved ONEDECORE copy and marketing assets for the three
 * R2 concepts. Everything here re-exports frozen production content so the
 * concepts stay a visual exercise: no concept may invent or reword copy.
 */
import { FEATURED_PORTFOLIO_COPY } from "@/features/portfolio/public/content/featured-portfolio";
import { HOMEPAGE_HERO_ASSET } from "@/features/public-site/config/home-hero";
import { MATERIAL_MARKETING_ASSETS } from "@/features/public-site/config/material-assets";
import { SERVICE_MARKETING_ASSETS } from "@/features/public-site/config/service-assets";
import {
  BRAND_PROPOSITION_COPY,
  HOMEPAGE_COPY,
} from "@/features/public-site/content/homepage";
import {
  MATERIAL_STORY_ITEMS,
  MATERIAL_STORY_SECTION_COPY,
} from "@/features/public-site/content/material-story";
import {
  PROCESS_SECTION_COPY,
  PROCESS_STEPS,
} from "@/features/public-site/content/process";
import {
  SERVICES_SECTION_COPY,
  SERVICE_STORIES,
} from "@/features/public-site/content/services";
import {
  TRUST_PILLARS,
  TRUST_SECTION_COPY,
} from "@/features/public-site/content/trust";
import { SITE_CONFIG } from "@/config/site";

export {
  BRAND_PROPOSITION_COPY,
  FEATURED_PORTFOLIO_COPY,
  HOMEPAGE_COPY,
  HOMEPAGE_HERO_ASSET,
  MATERIAL_STORY_ITEMS,
  MATERIAL_STORY_SECTION_COPY,
  PROCESS_SECTION_COPY,
  PROCESS_STEPS,
  SERVICES_SECTION_COPY,
  SERVICE_STORIES,
  SITE_CONFIG,
  TRUST_PILLARS,
  TRUST_SECTION_COPY,
};

/** Section anchors shared by all three concepts, in DOM order. */
export const SECTION_IDS = {
  proposition: "proposition",
  services: "services",
  work: "selected-work",
  process: "process",
  materials: "materials",
  trust: "why-onedecore",
} as const;

export interface ConceptNavItem {
  readonly label: string;
  readonly href: string;
  /** Routed links leave the concept; anchors scroll within it. */
  readonly kind: "route" | "anchor";
}

/** Only `/`-family routes that actually exist may be linked. */
export function buildConceptNav(conceptHref: string): readonly ConceptNavItem[] {
  return [
    { label: "Home", href: conceptHref, kind: "route" },
    { label: "Services", href: `#${SECTION_IDS.services}`, kind: "anchor" },
    { label: "Portfolio", href: "/portfolio", kind: "route" },
    { label: "Process", href: `#${SECTION_IDS.process}`, kind: "anchor" },
    { label: "Materials", href: `#${SECTION_IDS.materials}`, kind: "anchor" },
    { label: "Why ONEDECORE", href: `#${SECTION_IDS.trust}`, kind: "anchor" },
  ];
}

export const SERVICE_CARDS = SERVICE_STORIES.map((story) => ({
  id: story.id,
  ordinal: story.ordinal,
  title: story.title,
  description: story.description,
  asset: SERVICE_MARKETING_ASSETS[story.assetId],
}));

export const MATERIAL_CARDS = MATERIAL_STORY_ITEMS.map((item) => ({
  id: item.id,
  ordinal: item.ordinal,
  theme: item.theme,
  caption: item.caption,
  role: item.role,
  asset: MATERIAL_MARKETING_ASSETS[item.assetId],
}));

export const MATERIAL_PRIMARY = MATERIAL_CARDS.find(
  (item) => item.role === "primary"
)!;

export const MATERIAL_SUPPORTING = MATERIAL_CARDS.filter(
  (item) => item.role === "supporting"
);

/**
 * Provenance boundary required on every concept: the marketing artwork is
 * ONEDECORE-owned illustration, never a photograph of a delivered project.
 */
export const ARTWORK_PROVENANCE_NOTE =
  "Marketing artwork created for ONEDECORE. Not photography of a completed project.";

export const FOOTER_COPY = {
  tagline: SITE_CONFIG.tagline,
  servicesHeading: "Services",
  exploreHeading: "Explore",
  serviceNames: SERVICE_STORIES.map((story) => story.title),
  exploreLinks: [
    { label: "Portfolio", href: "/portfolio" },
  ],
  rights: "All rights reserved.",
} as const;
