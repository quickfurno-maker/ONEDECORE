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
  rooms: "rooms",
  included: "included",
  projects: "projects",
  approach: "approach",
  process: "process",
  materials: "materials",
  readiness: "readiness",
  faqs: "faqs",
  plan: "plan",
} as const;

export const PM_NAV_ITEMS = [
  { label: "Services", href: `#${PM_SECTION_IDS.services}` },
  { label: "Rooms", href: `#${PM_SECTION_IDS.rooms}` },
  { label: "What's Included", href: `#${PM_SECTION_IDS.included}` },
  { label: "Process", href: `#${PM_SECTION_IDS.process}` },
  { label: "Materials", href: `#${PM_SECTION_IDS.materials}` },
  { label: "FAQs", href: `#${PM_SECTION_IDS.faqs}` },
] as const;

export const PM_TRACKED_SECTIONS = [
  PM_SECTION_IDS.services,
  PM_SECTION_IDS.rooms,
  PM_SECTION_IDS.included,
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
  buildBrief: "Build My Interior Brief",
  reviewBrief: "Review My Interior Brief",
  addArea: "Add this area to my plan",
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
  eyebrow: "Philosophy",
  heading: "Complete interiors, held as one direction.",
  body: "ONEDECORE plans complete home interiors, modular kitchens and custom wardrobes for homes across Pune — so rooms, storage and finishes stay aligned from the first brief through handover.",
  pull: "Planning, detailing and delivery stay in one conversation.",
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

/** Frozen homepage pending-proof copy — do not soften or invent project claims. */
export const PM_PROJECTS_COPY = {
  eyebrow: "Selected work",
  heading: "Project photography is being prepared.",
  lede: "The portfolio layout is ready for published ONEDECORE projects. Authentic completed-project media will replace this state before launch.",
  emptyHeading: "Project photography is being prepared.",
  emptyBody:
    "The portfolio layout is ready for published ONEDECORE projects. Authentic completed-project media will replace this state before launch.",
  allLabel: "View Portfolio",
  allHref: "/portfolio",
  planLabel: "Start My Interior Plan",
} as const;

/* ----------------------------------------------------------- truth metrics */

export const PM_METRICS = [
  {
    id: "services",
    value: 3,
    label: "Focused Interior Services",
  },
  {
    id: "stages",
    value: 4,
    label: "Stages from Discovery to Handover",
  },
  {
    id: "team",
    value: 1,
    label: "Coordinated Design and Delivery Team",
  },
] as const;

export const PM_METRICS_COPY = {
  eyebrow: "Operating model",
  ariaLabel: "ONEDECORE operating model",
} as const;

/* ---------------------------------------------------------- room explorer */

export const PM_ROOMS_COPY = {
  eyebrow: "Room priorities",
  heading: "Explore your home, room by room",
  lede: "See how planning priorities change from one space to another while staying connected to one complete interior direction.",
  inspirationNote:
    "Inspiration artwork — not completed ONEDECORE project photography.",
  addLabel: PM_CTA.addArea,
  addedLabel: "Added to your plan",
} as const;

export const PM_ROOM_CATEGORIES = [
  {
    id: "living",
    title: "Living",
    goal: "Create a comfortable shared space that connects seating, movement, storage and lighting.",
    priorities: [
      "circulation and furniture planning",
      "media, display and concealed storage",
      "lighting, material transitions and visual balance",
    ],
    serviceId: "complete-home-interiors" as const,
    serviceLabel: "Complete Home Interiors",
    rooms: ["living"] as const,
    asset: PM_ASSETS.hero,
  },
  {
    id: "kitchen",
    title: "Kitchen",
    goal: "Plan everyday movement, storage and appliance needs as one working system.",
    priorities: [
      "work zones and movement",
      "storage and appliance integration",
      "material, lighting and maintenance decisions",
    ],
    serviceId: "modular-kitchens" as const,
    serviceLabel: "Modular Kitchens",
    rooms: ["kitchen"] as const,
    asset: PM_ASSETS.modularKitchens,
  },
  {
    id: "bedroom-storage",
    title: "Bedroom storage",
    goal: "Resolve wardrobes and storage around the room’s dimensions and everyday routine.",
    priorities: [
      "internal storage requirements",
      "wardrobe proportion and access",
      "material and lighting integration",
    ],
    serviceId: "custom-wardrobes" as const,
    serviceLabel: "Custom Wardrobes",
    rooms: ["bedrooms", "wardrobes"] as const,
    asset: PM_ASSETS.customWardrobes,
  },
  {
    id: "dining",
    title: "Dining and shared spaces",
    goal: "Keep dining and connecting areas visually and functionally aligned with the wider home.",
    priorities: [
      "movement between adjoining rooms",
      "lighting and focal composition",
      "storage, display and material continuity",
    ],
    serviceId: "complete-home-interiors" as const,
    serviceLabel: "Complete Home Interiors",
    rooms: ["dining"] as const,
    asset: PM_ASSETS.completeHomeInteriors,
  },
] as const;

/* -------------------------------------------------------- scope included */

export const PM_SCOPE_COPY = {
  eyebrow: "Project scope",
  heading: "Everything your interior project needs, coordinated in one place",
  lede: "The exact scope depends on the home and approved brief, but these are the decisions ONEDECORE brings into one connected interior journey.",
  cta: PM_CTA.buildBrief,
} as const;

export const PM_SCOPE_AREAS = [
  {
    id: "space",
    title: "Space and room planning",
    body: "Layouts, movement and room priorities are considered against how the home will be used.",
  },
  {
    id: "storage",
    title: "Storage and functional planning",
    body: "Wardrobes, kitchen storage and room-specific requirements are planned around daily routines.",
  },
  {
    id: "materials",
    title: "Material and finish selection",
    body: "Materials, colours, finishes and transitions are considered as part of one wider composition.",
  },
  {
    id: "detail",
    title: "Detailed design coordination",
    body: "Approved decisions are carried into the details needed to keep design and execution aligned.",
  },
  {
    id: "execution",
    title: "Execution and installation",
    body: "The approved interior direction is carried through coordinated execution and installation.",
  },
  {
    id: "handover",
    title: "Final detailing and handover",
    body: "The completed work is reviewed, refined and prepared for handover against the approved scope.",
  },
] as const;

/* ---------------------------------------------------------------- approach */

export const PM_APPROACH_COPY = {
  eyebrow: "What to expect",
  heading: "What you can expect from ONEDECORE",
  lede: "Clear expectations for how planning, materials and delivery stay connected — without unverified promises.",
} as const;

export const PM_APPROACH_USPS = [
  {
    id: "team",
    title: "One coordinated team",
    body: "One interior direction is carried from planning through execution, installation and handover.",
  },
  {
    id: "materials",
    title: "Materials decided with you",
    body: "Materials, finishes and room priorities are developed with you before they are carried into execution.",
  },
  {
    id: "rooms",
    title: "Room-by-room planning",
    body: "Each space is considered individually while remaining connected to the wider interior direction.",
  },
  {
    id: "connected",
    title: "Design and delivery stay connected",
    body: "The approved brief continues to guide the project as it moves from design into execution.",
  },
] as const;

export const PM_APPROACH_DIAGRAM = [
  "YOUR HOME",
  "DESIGN DIRECTION",
  "SPACE + STORAGE",
  "MATERIALS + DETAILS",
  "EXECUTION + INSTALLATION",
  "HANDOVER",
] as const;

/* ----------------------------------------------------------------- process */

const PROCESS_SUBSTEPS: Record<string, readonly string[]> = {
  discover: [
    "understand the home",
    "clarify everyday requirements",
    "identify priorities and rooms in scope",
  ],
  define: [
    "organise layouts and storage",
    "establish the wider design direction",
    "align the project brief",
  ],
  detail: [
    "develop materials and finishes",
    "refine proportion and functionality",
    "carry approved decisions into coordinated details",
  ],
  deliver: [
    "coordinate execution and installation",
    "review final detailing",
    "prepare the project for handover",
  ],
};

export const PM_PROCESS_COPY = {
  eyebrow: "How it works",
  heading: "Four stages from first conversation to handover",
  lede: "Move through each stage to see the concrete planning work that happens before execution begins.",
  cta: PM_CTA.open,
} as const;

export const PM_PROCESS_STAGES = PROCESS_STEPS.map((step) => ({
  id: step.id,
  ordinal: step.ordinal,
  title: step.title,
  description: step.description,
  focus: PROCESS_SUBSTEPS[step.id] ?? [],
}));

/* --------------------------------------------------------------- materials */

export const PM_MATERIALS_COPY = {
  eyebrow: "Materials",
  heading: "Materials considered within the wider home",
  lede: "Stone, timber, texture and light are studied together so finishes support atmosphere and everyday use.",
  decisionHeading: "How material decisions are made",
} as const;

export const PM_MATERIAL_DECISION_STEPS = [
  {
    id: "look",
    title: "Look and feel",
    body: "Define the atmosphere, colour direction and relationship between surfaces.",
  },
  {
    id: "function",
    title: "Functional requirement",
    body: "Consider where the material is used, how it is touched and how the space works.",
  },
  {
    id: "shortlist",
    title: "Material shortlist",
    body: "Compare suitable material and finish directions for the approved design.",
  },
  {
    id: "approval",
    title: "Finish approval",
    body: "Record the selected direction before it moves into execution.",
  },
  {
    id: "reference",
    title: "Execution reference",
    body: "Keep the approved material direction connected to the wider interior details.",
  },
] as const;

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

/* -------------------------------------------------------------- readiness */

export const PM_READINESS_COPY = {
  eyebrow: "Next step",
  heading: "Is your home ready to begin?",
  lede: "You do not need every answer today. Start with what you know and build a clearer brief step by step.",
  checklist: [
    { id: "service", label: "Service needed" },
    { id: "property", label: "Property type" },
    { id: "timeline", label: "Possession / timeline" },
    { id: "rooms", label: "Rooms in scope" },
    { id: "locality", label: "Pune locality" },
  ],
  states: {
    exploring: {
      label: "Exploring",
      body: "Start with the service or room that matters most. Your plan can stay flexible.",
      cta: PM_CTA.open,
    },
    planning: {
      label: "Planning",
      body: "You have enough direction to continue shaping the project brief.",
      cta: PM_CTA.continuePlan,
    },
    "brief-ready": {
      label: "Brief ready",
      body: "Your core project direction is ready to review and copy.",
      cta: PM_CTA.reviewBrief,
    },
  },
} as const;

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
    question: "Which areas does ONEDECORE currently serve?",
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
    question: "How does the process begin?",
    answer:
      "It begins with Discover: understanding the home, everyday requirements, priorities and the direction you want the interiors to take. You can start that brief on this page.",
  },
  {
    id: "first-discussion",
    question: "What should I share for the first discussion?",
    answer:
      "Share the service you need, your property type, possession timeline and a Pune locality. Room or area priorities and optional notes help shape the brief.",
  },
  {
    id: "materials",
    question: "How are material decisions handled?",
    answer:
      "Material decisions move from look and feel and functional requirements to a shortlist, finish approval and an execution reference that stays connected to the wider interior details.",
  },
  {
    id: "see-work",
    question: "Can I see completed projects?",
    answer:
      "Published project pages will appear in the ONEDECORE portfolio as authentic completed-project media is approved.",
  },
  {
    id: "submitted",
    question: "Is anything submitted from this page?",
    answer:
      "No. Nothing is submitted from this page. You can review your plan and copy your interior brief to share privately. Secure lead intake will connect in a later release.",
  },
  {
    id: "after-copy",
    question: "What happens after I copy my interior brief?",
    answer:
      "You keep a written summary of your selected service, property, timeline, rooms and notes. Explore the portfolio, edit the plan anytime, and share the brief when you are ready — no booking is created here.",
  },
  {
    id: "change-plan",
    question: "Can I change my plan later?",
    answer:
      "Yes. Open the planner again, edit any step, and copy an updated brief whenever your priorities change.",
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
    { label: "Rooms", href: `#${PM_SECTION_IDS.rooms}` },
    { label: "What's Included", href: `#${PM_SECTION_IDS.included}` },
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

