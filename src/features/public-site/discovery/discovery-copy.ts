import { HOME_CLAIMS, HOME_CLAIM_COPY } from "../home-r4/claims.ts";
import {
  PUBLIC_CONSULTATION,
  PUBLIC_CONSULTATION_BY_SERVICE,
} from "../chrome/public-nav.ts";

export type DiscoveryAssetKey =
  | "hero"
  | "completeHomeInteriors"
  | "modularKitchens"
  | "customWardrobes"
  | "dusk";

export const DISCOVERY_SECTION_ORDER = [
  "header",
  "hero",
  "trust",
  "benefits",
  "browse",
  "real-homes",
  "about",
  "process",
  "furniture",
  "consultation",
  "footer",
] as const;

/** Major homepage bands before footer. Furniture renders only when Shop is live. */
export const DISCOVERY_MAJOR_SECTIONS = [
  "hero",
  "trust",
  "benefits",
  "browse",
  "real-homes",
  "about",
  "process",
  "furniture",
  "consultation",
] as const;

export const DISCOVERY_PROCESS_STEPS = ["Consult", "Design", "Manufacture", "Install"] as const;

export const DISCOVERY_FURNITURE_PROCESS_STEPS = [
  "Browse",
  "Explore Details",
  "Check Serviceability",
] as const;

export const DISCOVERY_TRUST_STRIP_ITEMS = [
  { id: "consultation", label: "Pune-wide consultation" },
  { id: "manufacturing", label: HOME_CLAIM_COPY.manufacturing },
  { id: "pipeline", label: "Design → Manufacture → Install" },
  { id: "warranty", label: `${HOME_CLAIMS.warrantyYears}-Year Warranty` },
  {
    id: "rating",
    label: `${HOME_CLAIMS.rating}/5 Average Rating · ${HOME_CLAIMS.projectsDelivered}+ Projects`,
  },
  { id: "areas", label: "Kharadi · Baner · Wakad · Hinjewadi · Koregaon Park" },
] as const;

export const DISCOVERY_BENEFIT_CARDS = [
  {
    id: "consultation",
    title: HOME_CLAIM_COPY.freeConsultation,
    body: "Start with a no-obligation conversation about your home, scope and timeline.",
    href: PUBLIC_CONSULTATION.href,
  },
  {
    id: "warranty",
    title: HOME_CLAIM_COPY.warranty,
    body: "Approved interior scopes backed by ONEDECORE's written warranty terms.",
    href: PUBLIC_CONSULTATION.href,
  },
  {
    id: "manufacturing",
    title: HOME_CLAIM_COPY.manufacturing,
    body: "Custom kitchens and wardrobes built in our facility for accuracy and control.",
    href: "/interiors",
  },
  {
    id: "custom",
    title: HOME_CLAIM_COPY.customDesigns,
    body: "Layouts, storage and finishes planned around your home — not off-the-shelf templates.",
    href: PUBLIC_CONSULTATION.href,
  },
  {
    id: "team",
    title: "One Coordinated Team",
    body: "Design, manufacturing and installation connected through one interior direction.",
    href: "/#about",
  },
] as const;

export const DISCOVERY_PROOF_PILLARS = [
  {
    id: "team",
    title: "One coordinated team",
    body: "Design, manufacturing and installation stay connected through one interior direction.",
  },
  {
    id: "manufacturing",
    title: "In-house manufacturing",
    body: "Custom kitchens and wardrobes are made in our own facility for dimensional accuracy.",
  },
  {
    id: "install",
    title: "Quality-controlled installation",
    body: "Approved design intent is carried through site execution and final detailing.",
  },
  {
    id: "process",
    title: "Transparent process",
    body: "Scope, materials and milestones are clarified before work begins.",
  },
  {
    id: "warranty",
    title: "After-sales support",
    body: `${HOME_CLAIMS.warrantyYears}-year warranty on approved scopes · ${HOME_CLAIMS.rating}/5 average client rating.`,
  },
  {
    id: "precision",
    title: "Custom design + factory precision",
    body: "Layouts planned for your home, built with controlled production standards.",
  },
] as const;

/**
 * Hero slides carry NO call to action.
 *
 * The hero's job is brand and service storytelling; the persistent sticky
 * dock is the page's one conversion action. Two more buttons per slide only
 * competed with it, and on mobile they cost a large share of the first screen.
 */
export const DISCOVERY_HERO_SLIDES = [
  {
    id: "complete-home",
    kicker: "Premium interiors for Pune homes",
    headline: "Complete home interiors, designed around you.",
    lede:
      "From concept and modular manufacturing to installation, ONEDECORE brings your home together through one coordinated team.",
    assetKey: "hero" as const satisfies DiscoveryAssetKey,
    badge: null,
  },
  {
    id: "kitchen-wardrobe",
    kicker: "Modular Kitchens · Custom Wardrobes",
    headline: "Made to fit your space. Built to last.",
    lede:
      "Precision-made modular kitchens and custom wardrobes designed for your layout, storage needs and finish preferences.",
    assetKey: "modularKitchens" as const satisfies DiscoveryAssetKey,
    badge: null,
  },
  {
    id: "furniture-ecosystem",
    kicker: "Complete-home ecosystem",
    headline: "A complete-home experience, under one design language.",
    lede:
      "ONEDECORE is expanding from interiors into coordinated furniture and décor — so every room can share the same considered direction.",
    assetKey: "completeHomeInteriors" as const satisfies DiscoveryAssetKey,
    badge: "Furniture & Décor — coming soon",
  },
] as const;

export const DISCOVERY_CATEGORY_TILES = [
  {
    id: "complete-home" as const,
    title: "Complete Home Interiors",
    lede: "One coordinated design language across your entire home.",
    cta: "Plan My Home",
    href: PUBLIC_CONSULTATION_BY_SERVICE["complete-home-interiors"],
    assetKey: "completeHomeInteriors" as const satisfies DiscoveryAssetKey,
    featured: false,
    comingSoon: false,
  },
  {
    id: "modular-kitchen" as const,
    title: "Modular Kitchens",
    lede: "Precision-made kitchens designed for workflow, storage and finish.",
    cta: "Plan My Kitchen",
    href: PUBLIC_CONSULTATION_BY_SERVICE["modular-kitchens"],
    assetKey: "modularKitchens" as const satisfies DiscoveryAssetKey,
    featured: true,
    comingSoon: false,
  },
  {
    id: "wardrobes" as const,
    title: "Custom Wardrobes",
    lede: "Made-to-fit storage planned around your room and daily routine.",
    cta: "Plan My Wardrobe",
    href: PUBLIC_CONSULTATION_BY_SERVICE["custom-wardrobes"],
    assetKey: "customWardrobes" as const satisfies DiscoveryAssetKey,
    featured: false,
    comingSoon: false,
  },
  {
    id: "furniture-decor" as const,
    title: "Furniture & Décor",
    lede: "Coordinated furniture and décor under one ONEDECORE design language.",
    cta: "Plan My Home",
    href: PUBLIC_CONSULTATION_BY_SERVICE["complete-home-interiors"],
    assetKey: "dusk" as const satisfies DiscoveryAssetKey,
    featured: false,
    comingSoon: true,
    badge: "Coming soon",
  },
] as const;

export const DISCOVERY_SERVICE_CARDS = DISCOVERY_CATEGORY_TILES.filter((tile) => !tile.comingSoon).map(
  (tile) => ({
    id: tile.id,
    title: tile.title,
    lede: tile.lede,
    points: [] as const,
    href: tile.href,
    cta: tile.cta,
    assetKey: tile.assetKey,
  })
);

/** @deprecated Use DISCOVERY_CATEGORY_TILES — kept for transitional test references. */
export const DISCOVERY_SERVICE_SECTIONS = DISCOVERY_CATEGORY_TILES.filter((t) => !t.comingSoon).map(
  (card) => ({
    id: card.id,
    title: card.title,
    href: card.href,
    kicker:
      card.id === "complete-home"
        ? "Complete home"
        : card.id === "modular-kitchen"
          ? "Kitchen"
          : "Wardrobes",
    lede: card.lede,
    points: [] as const,
  })
);

export const DISCOVERY_TRUST_LABELS = [
  "End-to-End Interiors",
  "In-House Manufacturing",
  "Custom Furniture",
  "Quality Control",
  "After-Sales Support",
] as const;
