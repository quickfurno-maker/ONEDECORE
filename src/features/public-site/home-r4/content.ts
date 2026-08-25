/**
 * Production homepage content — R5.3 conversion master.
 *
 * Owner-approved commercial claims derive from claims.ts.
 * Indicative planning prices derive from budget-config.ts.
 * Project media remains truth-gated via HOME_PROJECT_PROOF_MODE.
 * Do not invent customer quotes, contact routes, or project proof.
 * Do not add unsupported structured data (aggregateRating / Review / Warranty)
 * until public evidence URLs exist.
 */
import { BUDGET_COMFORT_OPTIONS, type BudgetComfortId } from "./budget-config.ts";
import { HOME_CLAIMS } from "./claims.ts";
import {
  FEATURED_PORTFOLIO_COPY,
  PROCESS_STEPS,
  SERVICE_CARDS,
  SITE_CONFIG,
  TRUST_PILLARS,
} from "./shared-content.ts";

export type { BudgetComfortId };

export { FEATURED_PORTFOLIO_COPY, PROCESS_STEPS, SITE_CONFIG, TRUST_PILLARS };

export const PM_HREF = "/" as const;
export const PM_SECTION_IDS = {
  services: "services",
  estimate: "estimate",
  why: "why",
  factory: "factory",
  process: "process",
  reviews: "reviews",
  faqs: "faqs",
  plan: "plan",
} as const;

export const PM_NAV_ITEMS = [
  { label: "Services", href: `#${PM_SECTION_IDS.services}` },
  { label: "Estimate", href: `#${PM_SECTION_IDS.estimate}` },
  { label: "Why ONEDECORE", href: `#${PM_SECTION_IDS.why}` },
  { label: "Process", href: `#${PM_SECTION_IDS.process}` },
  { label: "Reviews", href: `#${PM_SECTION_IDS.reviews}` },
  { label: "FAQs", href: `#${PM_SECTION_IDS.faqs}` },
] as const;

export const PM_TRACKED_SECTIONS = [
  PM_SECTION_IDS.services,
  PM_SECTION_IDS.estimate,
  PM_SECTION_IDS.why,
  PM_SECTION_IDS.process,
  PM_SECTION_IDS.reviews,
  PM_SECTION_IDS.faqs,
] as const;

/** R5.3 conversion CTA system. */
export const PM_CTA = {
  open: "Get Free Consultation",
  openShort: "Free Consultation",
  continuePlan: "Continue My Plan",
  estimate: "Get Price Estimate",
  estimateScope: "Estimate My Interior Scope",
  refinePlan: "Refine My Interior Plan",
  submit: "Copy My Interior Brief",
  projects: "View Portfolio",
  editDetails: "Edit My Plan",
  buildBrief: "Build My Interior Brief",
  reviewBrief: "Review My Interior Brief",
  addArea: "Add this area to my plan",
  exploreScope: "Explore My Interior Scope",
  planCompleteHome: "Plan My Complete Home",
  planKitchen: "Plan My Kitchen",
  planWardrobes: "Plan My Wardrobes",
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
    width: 1440,
    height: 900,
    alt: "Premium living room with a marble feature wall, wall-mounted television, fluted white media console and warm gold accents",
    focalPoint: "52% 42%",
    mobileFocalPoint: "54% 48%",
    bytes: 115242,
    provenanceCategory: "C",
    depictsCompletedProject: false,
  },
  completeHomeInteriors: {
    path: "/assets/onedecore/home/service-complete-home-interiors.webp",
    width: 1200,
    height: 1500,
    alt: "Complete-home living interior with marble and timber TV wall, built-in shelving and a marble coffee table",
    focalPoint: "52% 40%",
    mobileFocalPoint: "50% 38%",
    bytes: 183650,
    provenanceCategory: "C",
    depictsCompletedProject: false,
  },
  modularKitchens: {
    path: "/assets/onedecore/home/service-modular-kitchens.webp",
    width: 1200,
    height: 1500,
    alt: "Modular kitchen with mauve handleless cabinetry, curved breakfast bar, black glass upper units and cream stone counters",
    focalPoint: "48% 46%",
    mobileFocalPoint: "50% 42%",
    bytes: 115712,
    provenanceCategory: "C",
    depictsCompletedProject: false,
  },
  customWardrobes: {
    path: "/assets/onedecore/home/service-custom-wardrobes.webp",
    width: 1200,
    height: 1500,
    alt: "Floor-to-ceiling custom wardrobe with arched patterned panels, teal base band and open styling niche",
    focalPoint: "48% 38%",
    mobileFocalPoint: "50% 36%",
    bytes: 323002,
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
  heroConsultant: {
    path: "/assets/onedecore/home/hero-consultant-indian-woman.webp",
    width: 1200,
    height: 1600,
    alt: "Indian interior design consultant in a warm, premium living-room setting",
    focalPoint: "48% 28%",
    mobileFocalPoint: "50% 22%",
    bytes: 80388,
    provenanceCategory: "C",
    depictsCompletedProject: false,
  },
} as const satisfies Record<string, PmAsset>;

/* -------------------------------------------------------------------- hero */

export const PM_HERO = {
  eyebrow: "Pune's Complete Interior Design & Build Company",
  serviceLine:
    "Complete Home Interiors · Modular Kitchens · Custom Wardrobes",
  titleLines: [
    { text: "Beautiful Homes.", emphasize: false },
    { text: "Designed, Built", emphasize: true },
    { text: "& Delivered by", emphasize: false },
    { text: "One Team.", emphasize: false },
  ],
  titlePlain: "Beautiful Homes. Designed, Built & Delivered by One Team.",
  lede: "From modular kitchens and custom wardrobes to complete home interiors, ONEDECORE manages design, manufacturing, installation and handover — so your entire home comes together with less stress.",
  primaryCta: PM_CTA.open,
  secondaryCta: PM_CTA.estimate,
  secondaryHref: `#${PM_SECTION_IDS.estimate}`,
  reassurance: "Free initial consultation · No obligation · Edit your plan anytime",
  areasLabel: "Serving homeowners across Pune",
  areasExpandLabel: "View all 26 areas",
  areasExpandMobileLabel: "View all 26 Pune areas",
  areasCollapseLabel: "Show fewer areas",
} as const;

export const PM_CREDIBILITY = [
  {
    id: "projects",
    stat: `${HOME_CLAIMS.projectsDelivered}+`,
    label: "Projects Delivered",
  },
  {
    id: "rating",
    stat: `${HOME_CLAIMS.rating}/5`,
    label: "Average Rating",
  },
  {
    id: "manufacturing",
    stat: "Own",
    label: "Manufacturing Unit",
  },
  {
    id: "warranty",
    stat: `${HOME_CLAIMS.warrantyYears}-Year`,
    label: "Warranty",
  },
] as const;

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
    { id: "apartment-1bhk", label: "1 BHK apartment" },
    { id: "apartment-2bhk", label: "2 BHK apartment" },
    { id: "apartment-3bhk", label: "3 BHK apartment" },
    { id: "apartment-4bhk-plus", label: "4 BHK or larger" },
    { id: "villa-rowhouse", label: "Villa or row house" },
    { id: "single-room", label: "Single room or area" },
  ],
  timelines: [
    { id: "immediate", label: "Immediate" },
    { id: "within-1-month", label: "Within 1 month" },
    { id: "within-2-months", label: "Within 2 months" },
    { id: "after-2-months", label: "After 2 months" },
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
  budgetComfortLegend: "Budget comfort range (optional)",
  budgetComfortOptions: BUDGET_COMFORT_OPTIONS,
  reassurance:
    "Free initial consultation · Nothing is submitted · Edit anytime",
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
    readonly includes: readonly string[];
    readonly cta: string;
    readonly asset: PmAsset;
  }
> = {
  "complete-home-interiors": {
    value:
      "A complete design-and-build solution for your home — layouts, storage, finishes, furniture, installation and final detailing coordinated by one team.",
    includes: [
      "space and room planning",
      "kitchen and wardrobe integration",
      "material and finish selection",
      "execution and installation",
      "handover coordination",
    ],
    cta: PM_CTA.planCompleteHome,
    asset: PM_ASSETS.completeHomeInteriors,
  },
  "modular-kitchens": {
    value:
      "A kitchen designed around how you cook, store and move — manufactured for accuracy and installed as part of your wider interior plan.",
    includes: [
      "layout and work-zone planning",
      "storage configuration",
      "appliance integration",
      "shutters, hardware and countertop coordination",
      "installation",
    ],
    cta: PM_CTA.planKitchen,
    asset: PM_ASSETS.modularKitchens,
  },
  "custom-wardrobes": {
    value:
      "Made-to-fit wardrobes planned around your room, clothing, storage habits and finish preferences.",
    includes: [
      "internal storage planning",
      "sliding or hinged configuration",
      "loft and accessory options",
      "finish and hardware selection",
      "installation",
    ],
    cta: PM_CTA.planWardrobes,
    asset: PM_ASSETS.customWardrobes,
  },
};

export const PM_SERVICES_COPY = {
  eyebrow: "What we do",
  heading: "Everything your home needs, under one roof",
  lede: "Choose a complete-home solution or start with the space that matters most. Every service is planned around your home, storage needs, style and daily routine.",
} as const;

export const PM_SERVICES = SERVICE_CARDS.map((card) => {
  const detail = SERVICE_DETAIL[card.id]!;
  return {
    id: card.id,
    ordinal: card.ordinal,
    title: card.title,
    value: detail.value,
    includes: detail.includes,
    cta: detail.cta,
    asset: detail.asset,
  };
});

export const PM_SERVICE_CTA = PM_CTA.open;

/* ----------------------------------------------------------- proof strip */

export const PM_PROOF_METRICS = [
  {
    id: "projects",
    value: HOME_CLAIMS.projectsDelivered,
    suffix: "+",
    label: "Projects Delivered",
  },
  {
    id: "custom",
    value: HOME_CLAIMS.customDesignPercent,
    suffix: "%",
    label: "Custom Designs",
  },
  {
    id: "services",
    value: 3,
    suffix: "",
    label: "Focused Interior Services",
  },
  {
    id: "stages",
    value: 4,
    suffix: "",
    label: "Stages to Handover",
  },
] as const;

export const PM_PROOF_COPY = {
  ariaLabel: "ONEDECORE proof metrics",
} as const;

/* ---------------------------------------------------------- room explorer */

export const PM_ROOMS_COPY = {
  eyebrow: "Room priorities",
  heading: "Explore your home, room by room",
  lede: "See how planning priorities change from one space to another while staying connected to one complete interior direction.",
  compactNote:
    "Inspiration artwork — not completed ONEDECORE project photography.",
  addLabel: PM_CTA.addArea,
  addedLabel: "Added to your plan",
} as const;

export const PM_ROOM_CATEGORIES = [
  {
    id: "living",
    title: "Living Room",
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
    title: "Bedroom & Wardrobes",
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
    title: "Dining & Shared Spaces",
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

/* -------------------------------------------------------- budget estimator */

export const PM_ESTIMATOR = {
  eyebrow: "Planning range",
  heading: "Get an instant interior budget estimate",
  lede: "Select your home, service and preferred finish level to see an indicative planning range. Your final quotation will depend on measurements, design scope, materials, hardware and site conditions.",
  reassurance:
    "Instant planning estimate · No obligation · Final price after detailed scope",
  stepService: "Service",
  stepSize: "Property / size",
  stepFinish: "Finish level",
  resultHeading: "Your indicative budget range",
  resultSummaryLabel: "Selected scope",
  disclaimer:
    "This is a planning estimate, not a final quotation. Measurements, detailed design, material choices, hardware, civil work and site conditions can change the final cost.",
  refineCta: PM_CTA.refinePlan,
  consultCta: PM_CTA.open,
  noscriptHeading: "Indicative planning ranges",
  noscriptBody:
    "Base planning ranges by service and size. Finish levels scale Essential (base), Premium (~1.30×) and Luxury (~1.65×).",
} as const;

/* ------------------------------------------------------------- why us */

export const PM_WHY = {
  eyebrow: "Why ONEDECORE",
  heading: "Why homeowners choose ONEDECORE",
  lede: "Interior projects become simpler when design, manufacturing and execution stay connected. ONEDECORE gives you one coordinated direction from the first plan to final handover.",
  cta: PM_CTA.open,
  pillars: [
    {
      id: "team",
      title: "One Team, Complete Responsibility",
      body: "Design, manufacturing, installation and handover are coordinated through one interior direction.",
    },
    {
      id: "scope",
      title: "Transparent Scope & Pricing",
      body: "Your approved scope, materials and estimate are made clear before execution. Later changes should be documented separately.",
    },
    {
      id: "custom",
      title: "Custom Planning for Your Home",
      body: "Layouts, storage and finishes are planned around your home, lifestyle and preferences.",
    },
    {
      id: "connected",
      title: "Design, Manufacturing and Installation Stay Connected",
      body: "Approved design intent stays linked through production references, installation and final handover.",
    },
  ],
} as const;

/* ----------------------------------------------------------- factory */

export const PM_FACTORY = {
  eyebrow: "Manufacturing",
  heading: "Designed here. Built by us. Installed in your home.",
  lede: "ONEDECORE combines interior planning with its own manufacturing capability, helping design intent, dimensions, materials and finish quality stay connected through production and installation.",
  stages: [
    {
      id: "design",
      title: "Design & Measurements",
      body: "Approved layouts, storage requirements and dimensions move into detailed production planning.",
    },
    {
      id: "manufacture",
      title: "Precision Manufacturing",
      body: "Panels and components are prepared using controlled machinery and documented specifications.",
    },
    {
      id: "assembly",
      title: "Edge Finishing & Assembly",
      body: "Edges, fittings, hardware and assemblies are checked before dispatch.",
    },
    {
      id: "install",
      title: "Installation & Final Detailing",
      body: "Manufactured elements are installed, aligned and reviewed as part of the final handover.",
    },
  ],
  materialPathHeading: "How material decisions move into production",
  materialPath: [
    "look and feel",
    "functional requirement",
    "board/material selection",
    "finish and hardware approval",
    "production reference",
    "installation check",
  ],
  calloutTitle: "10-Year Warranty Support",
  calloutBody:
    "Warranty coverage applies according to ONEDECORE’s approved written terms, product categories and exclusions.",
  imageryNote:
    "Material and process imagery is illustrative unless identified as authentic ONEDECORE factory media.",
  cta: PM_CTA.exploreScope,
} as const;

/* ----------------------------------------------------------- reviews */

export const PM_REVIEWS = {
  eyebrow: "Client Reviews",
  heading: `Rated ${HOME_CLAIMS.rating}/5 by homeowners across Pune`,
  body: `More than ${HOME_CLAIMS.reviews} client reviews reflect the confidence homeowners place in ONEDECORE’s custom planning, manufacturing control and coordinated interior delivery.`,
  starLabel: `${HOME_CLAIMS.rating} out of 5 average rating`,
  ratingCaption: "Average Client Rating",
  reviewsCaption: "Client Reviews",
  satisfactionCaption: "Client Satisfaction",
  railLabel: "The ONEDECORE experience is built around",
  railItems: [
    "Clear planning before execution",
    "Designs tailored to the home",
    "Manufacturing kept connected to design",
    "Installation and handover through one team",
  ],
  primaryCta: PM_CTA.open,
  secondaryCta: PM_CTA.projects,
  secondaryHref: "/portfolio",
} as const;

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
    "home and lifestyle needs",
    "rooms and storage priorities",
    "timeline and budget direction",
  ],
  define: [
    "layouts and circulation",
    "storage planning",
    "scope and estimate alignment",
  ],
  detail: [
    "materials and finishes",
    "detailed dimensions",
    "manufacturing references",
  ],
  deliver: [
    "production",
    "installation",
    "final review and handover",
  ],
};

const PROCESS_DESCRIPTIONS: Record<string, string> = {
  discover:
    "We understand your home, rooms, requirements, style, timeline and expected investment.",
  define:
    "Layouts, scope, design direction and major material choices are organised before detailed execution planning.",
  detail:
    "Finishes, hardware, dimensions and production details are refined and approved.",
  deliver:
    "Manufacturing, installation, final detailing and handover are coordinated through one team.",
};

export const PM_PROCESS_COPY = {
  eyebrow: "How it works",
  heading: "From first idea to final handover",
  lede: "A clear four-stage journey keeps decisions, budget, manufacturing and execution aligned.",
  cta: PM_CTA.open,
} as const;

export const PM_PROCESS_STAGES = PROCESS_STEPS.map((step) => ({
  id: step.id,
  ordinal: step.ordinal,
  title: step.title,
  description: PROCESS_DESCRIPTIONS[step.id] ?? step.description,
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
      "ONEDECORE provides complete home interiors, modular kitchens and custom wardrobes, including planning, manufacturing, installation and handover coordination.",
  },
  {
    id: "cost",
    question: "How much do home interiors cost in Pune?",
    answer:
      "Indicative budgets vary by home size, scope and finish. Complete 2 BHK interiors commonly begin around ₹4.5L, while 3 BHK projects commonly begin around ₹6.5L. Use the estimator for a planning range; final pricing follows measurements and detailed scope.",
  },
  {
    id: "estimate",
    question: "Is the price estimate a final quotation?",
    answer:
      "No. It is an indicative planning range. Final pricing depends on measurements, materials, hardware, design complexity, civil work and site conditions.",
  },
  {
    id: "factory",
    question: "Does ONEDECORE manufacture its own furniture?",
    answer:
      "Yes. ONEDECORE’s own manufacturing capability supports controlled production, dimensional accuracy and coordination between design and installation.",
  },
  {
    id: "warranty",
    question: "Does ONEDECORE provide a warranty?",
    answer:
      "ONEDECORE offers 10-year warranty support on eligible modular furniture and interior work according to approved written terms and exclusions.",
  },
  {
    id: "consultation",
    question: "Is the design consultation free?",
    answer:
      "Yes. The initial design consultation is free and helps clarify the home, rooms, timeline, budget and service scope without obligation.",
  },
  {
    id: "areas",
    question: "Which areas does ONEDECORE serve?",
    answer:
      "ONEDECORE serves homes across Pune, including the listed 26 service areas.",
  },
  {
    id: "reviews",
    question: "How are ONEDECORE’s ratings and review count presented?",
    answer:
      "The homepage shows ONEDECORE’s owner-approved aggregate rating and review count. Individual review excerpts will only appear when their original source records are approved.",
  },
  {
    id: "portfolio",
    question: "Where can I explore ONEDECORE projects?",
    answer:
      "Visit the ONEDECORE Portfolio for published project pages. Authentic completed-project photography and case studies will be added as final media is approved.",
  },
  {
    id: "submitted",
    question: "Is anything submitted from this page?",
    answer:
      "No. You can create, review and copy your interior brief locally. Secure lead submission will connect in a later release.",
  },
] as const;

/* ------------------------------------------------------------------- close */

export const PM_CLOSE = {
  eyebrow: "Free consultation",
  heading: "Your interior plan, ready to take forward",
  lede: "Review your selections, copy the brief and continue exploring ONEDECORE when you are ready.",
  ledeActive:
    "Share your plan and contact details for a free consultation request. We will review your enquiry and follow up.",
  summaryHeading: PM_PLANNER.summaryHeading,
  editLabel: PM_CTA.editDetails,
  submitLabel: PM_CTA.submit,
  secondaryLabel: PM_CTA.projects,
  secondaryHref: "/portfolio",
  briefTitle: "Copy your interior brief",
  briefBody:
    "Nothing is submitted from this page. Copy your brief to share privately, or browse the portfolio. Secure lead intake will connect in a later release.",
  briefTitleActive: "Request a free consultation",
  briefBodyActive:
    "This sends a consultation request — not a confirmed appointment. We review enquiries and follow up with next steps.",
  copyBriefSecondaryLabel: "Copy brief",
  reassurance:
    "Planning estimate only · Nothing is submitted from this page · Edit anytime",
  reassuranceActive:
    "Free consultation request · Accurate consent · Edit your plan anytime",
  copySuccess: "Interior brief copied.",
  copyFailure:
    "We could not copy automatically. Select and copy the brief manually.",
} as const;

export const PM_STICKY = {
  plan: PM_CTA.openShort,
  estimate: "Estimate",
  estimateHref: `#${PM_SECTION_IDS.estimate}`,
  projects: PM_CTA.projects,
  projectsHref: "/portfolio",
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
    { label: "Estimate", href: `#${PM_SECTION_IDS.estimate}` },
    { label: "Why ONEDECORE", href: `#${PM_SECTION_IDS.why}` },
    { label: "Process", href: `#${PM_SECTION_IDS.process}` },
    { label: "Reviews", href: `#${PM_SECTION_IDS.reviews}` },
    { label: "FAQs", href: `#${PM_SECTION_IDS.faqs}` },
  ],
  rights: "All rights reserved.",
} as const;

export type PmServiceId = (typeof PM_PLANNER.services)[number]["id"];
export type PmPropertyId = (typeof PM_PLANNER.properties)[number]["id"];
export type PmTimelineId = (typeof PM_PLANNER.timelines)[number]["id"];
export type PmRoomId = (typeof PM_PLANNER.rooms)[number]["id"];
export type PmStep = 1 | 2 | 3 | 4;
export type HomePlannerMode = "sheet";

