/**
 * Phase 2F-R3.1 Conversion Master — frozen conversion copy.
 * Factual language only; no invented timelines, warranties, prices, or contact details.
 */
import {
  ARTWORK_PROVENANCE_NOTE,
  FEATURED_PORTFOLIO_COPY,
  HOMEPAGE_HERO_ASSET,
  MATERIAL_CARDS,
  MATERIAL_PRIMARY,
  MATERIAL_STORY_SECTION_COPY,
  MATERIAL_SUPPORTING,
  PROCESS_SECTION_COPY,
  PROCESS_STEPS,
  SERVICE_CARDS,
  SERVICES_SECTION_COPY,
  SITE_CONFIG,
  TRUST_PILLARS,
  TRUST_SECTION_COPY,
} from "../content/shared-content";

export {
  ARTWORK_PROVENANCE_NOTE,
  FEATURED_PORTFOLIO_COPY,
  HOMEPAGE_HERO_ASSET,
  MATERIAL_CARDS,
  MATERIAL_PRIMARY,
  MATERIAL_STORY_SECTION_COPY,
  MATERIAL_SUPPORTING,
  PROCESS_SECTION_COPY,
  PROCESS_STEPS,
  SERVICE_CARDS,
  SERVICES_SECTION_COPY,
  SITE_CONFIG,
  TRUST_PILLARS,
  TRUST_SECTION_COPY,
};

export const CM_HREF = "/design-concepts/conversion-master" as const;

export const CM_SECTION_IDS = {
  proposition: "proposition",
  services: "services",
  projects: "projects",
  story: "project-story",
  why: "why-onedecore",
  process: "process",
  materials: "materials",
  scope: "scope-planner",
  faqs: "faqs",
  consult: "consultation",
} as const;

export const CM_NAV_ITEMS = [
  { label: "Home", href: CM_HREF, kind: "route" as const },
  { label: "Services", href: `#${CM_SECTION_IDS.services}`, kind: "anchor" as const },
  { label: "Projects", href: `#${CM_SECTION_IDS.projects}`, kind: "anchor" as const },
  { label: "Process", href: `#${CM_SECTION_IDS.process}`, kind: "anchor" as const },
  { label: "Materials", href: `#${CM_SECTION_IDS.materials}`, kind: "anchor" as const },
  { label: "FAQs", href: `#${CM_SECTION_IDS.faqs}`, kind: "anchor" as const },
] as const;

export const CM_TRACKED_SECTIONS = [
  CM_SECTION_IDS.services,
  CM_SECTION_IDS.projects,
  CM_SECTION_IDS.process,
  CM_SECTION_IDS.materials,
  CM_SECTION_IDS.faqs,
] as const;

/** Frozen CTA system — do not invent alternate phrases. */
export const CM_CTA = {
  open: "Start My Interior Plan",
  continuePlan: "Continue My Interior Plan",
  submit: "Request a Design Call",
  projects: "View Projects",
  editDetails: "Review or edit my details",
} as const;

export const CM_HERO = {
  h1: "Beautiful interiors. One team from design to handover.",
  supporting:
    "Complete home interiors, modular kitchens and custom wardrobes designed and delivered across Pune.",
  brandLine: SITE_CONFIG.tagline,
  primaryCta: CM_CTA.open,
  secondaryCta: CM_CTA.projects,
  secondaryHref: "/portfolio",
} as const;

export const CM_PLANNER = {
  title: "Tell us about your home",
  entryHint: "Choose a service to begin — takes about a minute.",
  steps: [
    { id: 1, legend: "What are you planning?" },
    { id: 2, legend: "Property type" },
    { id: 3, legend: "When do you need it?" },
    { id: 4, legend: "How can we reach you?" },
  ],
  services: [
    { id: "complete-home-interiors", label: "Complete Home Interiors" },
    { id: "modular-kitchens", label: "Modular Kitchen" },
    { id: "custom-wardrobes", label: "Custom Wardrobe" },
  ],
  properties: [
    { id: "1bhk", label: "1 BHK" },
    { id: "2bhk", label: "2 BHK" },
    { id: "3bhk", label: "3 BHK" },
    { id: "4bhk-villa", label: "4 BHK / Villa" },
    { id: "other", label: "Other" },
  ],
  timelines: [
    { id: "ready-now", label: "Ready now" },
    { id: "within-3-months", label: "Within 3 months" },
    { id: "3-6-months", label: "3–6 months" },
    { id: "more-than-6-months", label: "More than 6 months" },
    { id: "exploring", label: "Just exploring" },
  ],
  submitLabel: CM_CTA.submit,
  privacyMicrocopy:
    "We will use these details only to respond to your interior enquiry.",
  whatsappConsentLabel: "Send updates about this enquiry on WhatsApp.",
  privacyConsentLabel:
    "I agree that ONEDECORE may use these details to respond to my interior enquiry.",
  /** Future privacy route — do not link until the route exists. */
  privacyUrl: null as string | null,
  successTitle: "Thank you — your enquiry preview is ready.",
  successBody:
    "This review prototype does not submit data. In production, your enquiry will be stored securely before the ONEDECORE team is notified.",
  editLabel: CM_CTA.editDetails,
  backLabel: "Back",
  continueLabel: "Continue",
} as const;

export const CM_PROPOSITION = {
  heading: "One vision, carried through every room.",
  body: "ONEDECORE brings complete home interiors, modular kitchens, and custom wardrobes into one coherent direction — from design through execution, installation, and handover — for homes across Pune.",
} as const;

/** Dense service modules: title, value, Includes, Best for. */
export const CM_SERVICE_MODULES = SERVICE_CARDS.map((card) => {
  const extensions: Record<
    string,
    { includes: string; bestFor: string; value: string }
  > = {
    "complete-home-interiors": {
      includes:
        "Space planning, finishes, storage, and installation as one journey.",
      bestFor: "Homes shaping a full interior across rooms.",
      value:
        "A coordinated direction so rooms, storage, and finishes stay connected.",
    },
    "modular-kitchens": {
      includes:
        "Kitchen systems planned around movement, storage, and a calm palette.",
      bestFor: "Homes that need an organised kitchen in daily life.",
      value:
        "A kitchen that supports how you cook, held within the wider interior language.",
    },
    "custom-wardrobes": {
      includes:
        "Made-to-fit wardrobes balancing storage, proportion, and material detail.",
      bestFor: "Rooms that need storage fitted to the architecture.",
      value: "Wardrobes resolved as part of the interior, not an afterthought.",
    },
  };

  const extra = extensions[card.id]!;
  return {
    ...card,
    includes: extra.includes,
    bestFor: extra.bestFor,
    value: extra.value,
  };
});

export const CM_SERVICE_CTA = CM_CTA.open;

export const CM_STORY = {
  overline: "Project detail",
  heading: "Spaces told through material and craft",
  body: "Verified before-and-after pairs are not yet available in the portfolio CMS. Until then, this section presents restrained storytelling with approved marketing artwork.",
  futureNote:
    "Real before-and-after photography will be a future CMS-driven enhancement when verified pairs exist.",
} as const;

export const CM_PROCESS_CTA = CM_CTA.open;

export const CM_SCOPE = {
  overline: "Scope planner",
  heading: "Build your interior brief",
  introduction:
    "Describe what you need — without prices. Selections update your shared interior plan.",
  roomsLegend: "Rooms or areas",
  rooms: [
    { id: "living", label: "Living" },
    { id: "kitchen", label: "Kitchen" },
    { id: "bedrooms", label: "Bedrooms" },
    { id: "wardrobes", label: "Wardrobes" },
    { id: "dining", label: "Dining" },
    { id: "other", label: "Other" },
  ],
  localityLabel: "Pune locality",
  budgetNote:
    "Budget bands require owner approval — omitted in this prototype.",
  summaryHeading: "Your brief so far",
  continueLabel: CM_CTA.continuePlan,
  emptySummary: "Select a service and property type to begin your brief.",
} as const;

export const CM_FAQS = [
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
      "Yes. The process moves from Discover and Define through Detail and Deliver — carrying the approved design through execution, installation, final detailing, and handover as one coordinated journey.",
  },
  {
    id: "process-begin",
    question: "How does the design process begin?",
    answer:
      "It begins with Discover: understanding the home, everyday requirements, priorities, and the direction you want the interiors to take.",
  },
  {
    id: "see-work",
    question: "Can I see completed work before deciding?",
    answer:
      "Yes. Published projects are available in the ONEDECORE portfolio, with project detail pages for each published entry.",
  },
  {
    id: "first-discussion",
    question: "What information should I share for the first discussion?",
    answer:
      "Share the service you need, your property type, possession timeline, and a Pune locality — along with how we can reach you. Room or area priorities help shape the brief.",
  },
] as const;

export const CM_FINAL = {
  overline: "Begin the conversation",
  heading: "Ready to discuss your home?",
  lede: "Review your interior plan, then complete how we can reach you.",
  summaryHeading: "Your interior plan",
  editLabel: "Edit plan",
  submitLabel: CM_CTA.submit,
  secondaryLabel: CM_CTA.projects,
  secondaryHref: "/portfolio",
  successTitle: CM_PLANNER.successTitle,
  successBody: CM_PLANNER.successBody,
  editDetailsLabel: CM_CTA.editDetails,
  whatsappConsentLabel: CM_PLANNER.whatsappConsentLabel,
  privacyConsentLabel: CM_PLANNER.privacyConsentLabel,
  messageLabel: "Message (optional)",
  nameLabel: "Name",
  mobileLabel: "Mobile number",
  localityLabel: "Pune locality",
} as const;

/** @deprecated Use CM_FINAL — kept briefly for migration safety in imports. */
export const CM_FINAL_FORM = CM_FINAL;

export const CM_STICKY = {
  plan: CM_CTA.open,
  projects: CM_CTA.projects,
  projectsHref: `#${CM_SECTION_IDS.projects}`,
} as const;

export const CM_FOOTER = {
  tagline: SITE_CONFIG.tagline,
  positioning: "Complete home interiors across Pune.",
  explore: [
    { label: "Portfolio", href: "/portfolio" },
    { label: "Services", href: `#${CM_SECTION_IDS.services}` },
    { label: "Projects", href: `#${CM_SECTION_IDS.projects}` },
    { label: "Process", href: `#${CM_SECTION_IDS.process}` },
    { label: "Materials", href: `#${CM_SECTION_IDS.materials}` },
    { label: "FAQs", href: `#${CM_SECTION_IDS.faqs}` },
  ],
  rights: "All rights reserved.",
} as const;

export const CM_REVIEW = {
  tag: "CONVERSION MASTER",
  notice: "Phase 2F-R3.1 internal review — not a public ONEDECORE page.",
  backLabel: "Back to concepts",
  backHref: "/design-concepts",
} as const;

export type CmServiceId = (typeof CM_PLANNER.services)[number]["id"];
export type CmPropertyId = (typeof CM_PLANNER.properties)[number]["id"];
export type CmTimelineId = (typeof CM_PLANNER.timelines)[number]["id"];
export type CmRoomId = (typeof CM_SCOPE.rooms)[number]["id"];
export type CmPlannerStep = 1 | 2 | 3 | 4;
