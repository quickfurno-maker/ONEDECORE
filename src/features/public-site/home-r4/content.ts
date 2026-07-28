/**
 * Production homepage "Premium Motion Conversion Homepage" — concept-isolated content.
 *
 * Every string here is either factual ONEDECORE positioning or neutral product
 * language. Nothing may assert a number, a price, a promise, a quoted customer,
 * a contact channel, or a route that does not exist in this repository. The R4
 * guard suite enforces that list.
 */
import {
  FEATURED_PORTFOLIO_COPY,
  PROCESS_STEPS,
  SERVICE_CARDS,
  SITE_CONFIG,
  TRUST_PILLARS,
} from "./shared-content.ts";

export { FEATURED_PORTFOLIO_COPY, PROCESS_STEPS, SITE_CONFIG, TRUST_PILLARS };

export const PM_HREF = "/" as const;
export const PM_SECTION_IDS = {
  vision: "vision",
  services: "services",
  projects: "projects",
  approach: "approach",
  process: "process",
  materials: "materials",
  faqs: "faqs",
  plan: "plan",
} as const;

export const PM_NAV_ITEMS = [
  { label: "Services", href: `#${PM_SECTION_IDS.services}` },
  { label: "Projects", href: `#${PM_SECTION_IDS.projects}` },
  { label: "Process", href: `#${PM_SECTION_IDS.process}` },
  { label: "Materials", href: `#${PM_SECTION_IDS.materials}` },
  { label: "FAQs", href: `#${PM_SECTION_IDS.faqs}` },
] as const;

export const PM_TRACKED_SECTIONS = [
  PM_SECTION_IDS.services,
  PM_SECTION_IDS.projects,
  PM_SECTION_IDS.process,
  PM_SECTION_IDS.materials,
  PM_SECTION_IDS.faqs,
] as const;

/** Frozen CTA system carried forward from the approved R3.1 language. */
export const PM_CTA = {
  open: "Start My Interior Plan",
  continuePlan: "Continue My Interior Plan",
  submit: "Copy My Interior Brief",
  projects: "View Projects",
  editDetails: "Review or edit my details",
} as const;

/* ------------------------------------------------------------------ assets */

interface PmAsset {
  readonly path: string;
  readonly width: number;
  readonly height: number;
  readonly alt: string;
  readonly focalPoint: string;
  readonly mobileFocalPoint: string;
  readonly bytes: number;
  /** C = ONEDECORE marketing artwork. Never presented as project photography. */
  readonly provenanceCategory: "C";
  readonly depictsCompletedProject: false;
}

export const PM_ASSETS = {
  hero: {
    path: "/assets/onedecore/home/hero-living-warmth.webp",
    width: 1536,
    height: 1024,
    alt: "Warm neutral living room with an oak slatted wall, cream curved seating and a round travertine table in raking daylight",
    focalPoint: "52% 46%",
    mobileFocalPoint: "58% 50%",
    bytes: 112202,
    provenanceCategory: "C",
    depictsCompletedProject: false,
  },
  completeHomeInteriors: {
    path: "/assets/onedecore/home/service-complete-home-interiors.webp",
    width: 1536,
    height: 1024,
    alt: "Open-plan interior seen through an oak and bronze screen, with seating in the foreground and a lit dining area beyond",
    focalPoint: "56% 50%",
    mobileFocalPoint: "58% 50%",
    bytes: 76244,
    provenanceCategory: "C",
    depictsCompletedProject: false,
  },
  modularKitchens: {
    path: "/assets/onedecore/home/service-modular-kitchens.webp",
    width: 1536,
    height: 1024,
    alt: "Handleless espresso kitchen cabinetry with bronze channel reveals, a stone waterfall island and warm shelf lighting",
    focalPoint: "50% 52%",
    mobileFocalPoint: "56% 52%",
    bytes: 66152,
    provenanceCategory: "C",
    depictsCompletedProject: false,
  },
  customWardrobes: {
    path: "/assets/onedecore/home/service-custom-wardrobes.webp",
    width: 1536,
    height: 1024,
    alt: "Walk-in wardrobe in warm oak with fluted doors, glass-fronted sections and integrated shelf lighting",
    focalPoint: "50% 46%",
    mobileFocalPoint: "50% 48%",
    bytes: 79530,
    provenanceCategory: "C",
    depictsCompletedProject: false,
  },
  materialStone: {
    path: "/assets/onedecore/home/material-travertine-bronze.webp",
    width: 1536,
    height: 1024,
    alt: "Close detail of honed travertine meeting a slim polished bronze reveal against a charcoal shadow gap",
    focalPoint: "42% 48%",
    mobileFocalPoint: "48% 50%",
    bytes: 81614,
    provenanceCategory: "C",
    depictsCompletedProject: false,
  },
  materialTimber: {
    path: "/assets/onedecore/home/material-oak-joinery.webp",
    width: 1500,
    height: 1000,
    alt: "Close detail of a mitred oak corner with straight grain and a recessed brushed-bronze finger pull",
    focalPoint: "50% 50%",
    mobileFocalPoint: "50% 50%",
    bytes: 118816,
    provenanceCategory: "C",
    depictsCompletedProject: false,
  },
  materialTexture: {
    path: "/assets/onedecore/home/material-fluted-texture.webp",
    width: 1400,
    height: 933,
    alt: "Close detail of a fluted plaster wall moving from warm greige into a deep charcoal recess",
    focalPoint: "50% 50%",
    mobileFocalPoint: "50% 50%",
    bytes: 146000,
    provenanceCategory: "C",
    depictsCompletedProject: false,
  },
  dusk: {
    path: "/assets/onedecore/home/support-dusk-detail.webp",
    width: 1536,
    height: 1024,
    alt: "Dark fluted panelling with a slim warm light reveal, a stone ledge and a single ceramic vessel",
    focalPoint: "58% 52%",
    mobileFocalPoint: "60% 52%",
    bytes: 25912,
    provenanceCategory: "C",
    depictsCompletedProject: false,
  },
} as const satisfies Record<string, PmAsset>;

/* -------------------------------------------------------------------- hero */

export const PM_HERO = {
  eyebrow: "Interior design and build — Pune",
  /** Rendered as separate lines so the reveal can stagger by line. */
  titleLines: [
    "Interiors designed,",
    "built and handed over",
    "by one team.",
  ],
  /** Screen-reader and document-title safe single-line form of the H1. */
  titlePlain: "Interiors designed, built and handed over by one team.",
  lede: "Complete home interiors, modular kitchens and custom wardrobes — planned, detailed and delivered as one coordinated project for homes across Pune.",
  primaryCta: PM_CTA.open,
  secondaryCta: PM_CTA.projects,
  secondaryHref: "/portfolio",
  assurances: [
    "One team from first plan to final handover",
    "Materials and finishes decided with you",
    "Room-by-room planning for Pune homes",
  ],
  brandLine: SITE_CONFIG.tagline,
} as const;

/* ----------------------------------------------------------------- planner */

export const PM_PLANNER = {
  title: "Tell us about your home",
  entryHint: "Choose a service to begin — about a minute.",
  progressLabel: "Interior plan progress",
  steps: [
    { id: 1, legend: "What are you planning?", short: "Service" },
    { id: 2, legend: "What kind of home?", short: "Home" },
    { id: 3, legend: "When do you need it?", short: "Timeline" },
    { id: 4, legend: "Add locality notes (optional)", short: "Brief" },
  ],
  services: [
    { id: "complete-home-interiors", label: "Complete Home Interiors" },
    { id: "modular-kitchens", label: "Modular Kitchen" },
    { id: "custom-wardrobes", label: "Custom Wardrobe" },
  ],
  properties: [
    { id: "apartment-2bhk", label: "2 BHK apartment" },
    { id: "apartment-3bhk", label: "3 BHK apartment" },
    { id: "apartment-4bhk-plus", label: "4 BHK or larger" },
    { id: "villa-rowhouse", label: "Villa or row house" },
    { id: "single-room", label: "Single room or area" },
  ],
  timelines: [
    { id: "ready-now", label: "Ready now" },
    { id: "within-3-months", label: "Within 3 months" },
    { id: "3-6-months", label: "3–6 months" },
    { id: "more-than-6-months", label: "More than 6 months" },
    { id: "exploring", label: "Just exploring" },
  ],
  rooms: [
    { id: "living", label: "Living" },
    { id: "kitchen", label: "Kitchen" },
    { id: "bedrooms", label: "Bedrooms" },
    { id: "wardrobes", label: "Wardrobes" },
    { id: "dining", label: "Dining" },
    { id: "other", label: "Other" },
  ],
  roomsLegend: "Rooms or areas (optional)",
  nameLabel: "Name",
  mobileLabel: "Mobile number",
  localityLabel: "Pune locality",
  messageLabel: "Anything else we should know",
  backLabel: "Back",
  /** Between planner steps only — not a resume CTA. */
  continueLabel: "Continue",
  /** Resume from summary / non-planner sections. */
  resumeLabel: PM_CTA.continuePlan,
  submitLabel: PM_CTA.submit,
  finishLabel: "Finish — view my plan",
  closeLabel: "Close planner",
  /** Future privacy route. Not linked until the route exists. */
  privacyUrl: null as string | null,
  errorSummaryTitle: "Please fix the following:",
  summaryHeading: "Your interior plan",
  summaryEmpty: "Nothing selected yet.",
} as const;

/* -------------------------------------------------------------- proposition */

export const PM_VISION = {
  eyebrow: "The ONEDECORE approach",
  heading: "One vision, carried through every room.",
  body: "ONEDECORE brings complete home interiors, modular kitchens and custom wardrobes into a single coherent direction — from design through execution, installation and handover — for homes across Pune.",
  pull: "Design and delivery are the same conversation, not two separate ones.",
  asset: PM_ASSETS.dusk,
} as const;

/* ---------------------------------------------------------------- services */

const SERVICE_DETAIL: Record<
  string,
  {
    readonly value: string;
    readonly includes: string;
    readonly bestFor: string;
    readonly asset: PmAsset;
  }
> = {
  "complete-home-interiors": {
    value:
      "A coordinated direction so rooms, storage and finishes stay connected.",
    includes:
      "Space planning, finishes, storage and installation as one journey.",
    bestFor: "Homes shaping a full interior across rooms.",
    asset: PM_ASSETS.completeHomeInteriors,
  },
  "modular-kitchens": {
    value:
      "A kitchen that supports how you cook, held within the wider interior language.",
    includes:
      "Kitchen systems planned around movement, storage and a calm palette.",
    bestFor: "Homes that need an organised kitchen in daily life.",
    asset: PM_ASSETS.modularKitchens,
  },
  "custom-wardrobes": {
    value: "Wardrobes resolved as part of the interior, not an afterthought.",
    includes:
      "Made-to-fit wardrobes balancing storage, proportion and material detail.",
    bestFor: "Rooms that need storage fitted to the architecture.",
    asset: PM_ASSETS.customWardrobes,
  },
};

export const PM_SERVICES_COPY = {
  eyebrow: "What we do",
  heading: "Three services, one continuous design language",
  lede: "Select a service to see how it is planned — and to start your interior plan with that service already chosen.",
} as const;

export const PM_SERVICES = SERVICE_CARDS.map((card) => {
  const detail = SERVICE_DETAIL[card.id]!;
  return {
    id: card.id,
    ordinal: card.ordinal,
    title: card.title,
    value: detail.value,
    includes: detail.includes,
    bestFor: detail.bestFor,
    asset: detail.asset,
  };
});

export const PM_SERVICE_CTA = PM_CTA.open;

/* ---------------------------------------------------------------- projects */

export const PM_PROJECTS_COPY = {
  eyebrow: FEATURED_PORTFOLIO_COPY.overline,
  heading: FEATURED_PORTFOLIO_COPY.heading,
  lede: FEATURED_PORTFOLIO_COPY.description,
  emptyHeading: FEATURED_PORTFOLIO_COPY.emptyHeading,
  emptyBody: FEATURED_PORTFOLIO_COPY.emptyBody,
  allLabel: PM_CTA.projects,
  allHref: "/portfolio",
} as const;

/* ---------------------------------------------------------------- approach */

export const PM_APPROACH_COPY = {
  eyebrow: "Why ONEDECORE",
  heading: "One vision carried through every detail",
  lede: "Spatial decisions, materials, storage and transitions stay connected to the wider interior direction rather than being resolved in isolation.",
} as const;

/* ----------------------------------------------------------------- process */

const PROCESS_FOCUS: Record<string, readonly string[]> = {
  discover: ["The home", "Requirements", "Priorities"],
  define: ["Layouts", "Storage", "Design language"],
  detail: ["Proportion", "Finish", "Function"],
  deliver: ["Execution", "Installation", "Handover"],
};

export const PM_PROCESS_COPY = {
  eyebrow: "How it works",
  heading: "A considered path from first conversation to handover",
  lede: "Four stages carry the wider interior vision and its details through one coordinated journey. Step through them below.",
  cta: PM_CTA.open,
} as const;

export const PM_PROCESS_STAGES = PROCESS_STEPS.map((step) => ({
  id: step.id,
  ordinal: step.ordinal,
  title: step.title,
  description: step.description,
  focus: PROCESS_FOCUS[step.id] ?? [],
}));

/* --------------------------------------------------------------- materials */

export const PM_MATERIALS_COPY = {
  eyebrow: "Material story",
  heading: "Materials considered as part of the wider composition",
  lede: "Stone, timber, texture, light and shadow are considered together to shape a calm and coherent interior language.",
} as const;

export const PM_MATERIAL_PRIMARY = {
  id: "travertine-bronze",
  ordinal: "01",
  theme: "Travertine and bronze",
  caption: "Stone, light and a slim bronze reveal, held in restraint.",
  asset: PM_ASSETS.materialStone,
} as const;

export const PM_MATERIAL_SUPPORTING = [
  {
    id: "oak-joinery",
    ordinal: "02",
    theme: "Oak joinery",
    caption: "Mitred timber, aligned grain and a recessed pull.",
    asset: PM_ASSETS.materialTimber,
  },
  {
    id: "fluted-texture",
    ordinal: "03",
    theme: "Fluted texture",
    caption: "Ribbed plaster moving from warm greige into charcoal.",
    asset: PM_ASSETS.materialTexture,
  },
] as const;

/* --------------------------------------------------------------------- faq */

export const PM_FAQ_COPY = {
  eyebrow: "Questions",
  heading: "The things homeowners ask first",
} as const;

export const PM_FAQS = [
  {
    id: "services",
    question: "What services does ONEDECORE provide?",
    answer:
      "ONEDECORE focuses on three services: complete home interiors, modular kitchens, and custom wardrobes.",
  },
  {
    id: "areas",
    question: "Which areas do you currently serve?",
    answer: "ONEDECORE designs and delivers interiors for homes across Pune.",
  },
  {
    id: "design-execution",
    question: "Can ONEDECORE handle design and execution together?",
    answer:
      "Yes. The process moves from Discover and Define through Detail and Deliver — carrying the approved design through execution, installation, final detailing and handover as one coordinated journey.",
  },
  {
    id: "process-begin",
    question: "How does the design process begin?",
    answer:
      "It begins with Discover: understanding the home, everyday requirements, priorities and the direction you want the interiors to take.",
  },
  {
    id: "see-work",
    question: "Can I see completed work before deciding?",
    answer:
      "Yes. Published projects are available in the ONEDECORE portfolio, with a project detail page for each published entry.",
  },
  {
    id: "first-discussion",
    question: "What should I share for the first discussion?",
    answer:
      "Share the service you need, your property type, possession timeline and a Pune locality. Room or area priorities help shape the brief.",
  },
] as const;

/* ------------------------------------------------------------------- close */

export const PM_CLOSE = {
  eyebrow: "Your interior brief",
  heading: "Ready to continue the conversation?",
  lede: "Review your interior plan, copy the brief, or explore published projects.",
  summaryHeading: PM_PLANNER.summaryHeading,
  editLabel: "Edit plan",
  submitLabel: PM_CTA.submit,
  secondaryLabel: PM_CTA.projects,
  secondaryHref: "/portfolio",
  briefTitle: "Copy your interior brief",
  briefBody:
    "Nothing is submitted from this page. Copy your brief to share privately, or browse the portfolio. Secure lead intake will connect in a later release.",
} as const;

export const PM_STICKY = {
  plan: PM_CTA.open,
  projects: PM_CTA.projects,
  projectsHref: `#${PM_SECTION_IDS.projects}`,
} as const;

export const PM_FOOTER = {
  tagline: SITE_CONFIG.tagline,
  positioning: "Complete home interiors, modular kitchens and custom wardrobes for homes across Pune.",
  servicesHeading: "Services",
  serviceNames: [
    "Complete Home Interiors",
    "Modular Kitchens",
    "Custom Wardrobes",
  ],
  exploreHeading: "Explore",
  explore: [
    { label: "Portfolio", href: "/portfolio" },
    { label: "Services", href: `#${PM_SECTION_IDS.services}` },
    { label: "Projects", href: `#${PM_SECTION_IDS.projects}` },
    { label: "Process", href: `#${PM_SECTION_IDS.process}` },
    { label: "Materials", href: `#${PM_SECTION_IDS.materials}` },
    { label: "FAQs", href: `#${PM_SECTION_IDS.faqs}` },
  ],
  rights: "All rights reserved.",
} as const;

export type PmServiceId = (typeof PM_PLANNER.services)[number]["id"];
export type PmPropertyId = (typeof PM_PLANNER.properties)[number]["id"];
export type PmTimelineId = (typeof PM_PLANNER.timelines)[number]["id"];
export type PmRoomId = (typeof PM_PLANNER.rooms)[number]["id"];
export type PmStep = 1 | 2 | 3 | 4;
export type HomePlannerMode = "inline" | "sheet";

