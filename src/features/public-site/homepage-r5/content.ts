import { PM_ASSETS } from "@/features/public-site/home-r4/content";
import {
  BUDGET_RANGES_BY_PROJECT_SCOPE,
  PROJECT_SCOPE_LABELS,
  type LeadProjectScopeCode,
} from "@/features/lead-intake/project-scope";

/**
 * Copy and data for the interactive homepage.
 *
 * ONE PLACE, BECAUSE THE RULE IS A DENSITY RULE
 *
 * The homepage this replaced grew paragraph by paragraph, each one reasonable
 * on its own: a service section that explained the service, then a kitchen
 * section that explained kitchens, then a wardrobe section that explained
 * wardrobes in the same words. Nobody added a wall of text; it accumulated.
 *
 * Keeping every string in one file makes the total visible. The budget is
 * explicit and asserted by test: supporting sentences under 18 words, card
 * descriptions under 16. If a future section needs more room than that, the
 * right move is usually a different section.
 *
 * WHAT IS NOT INVENTED HERE
 *
 * Every factual claim traces to already-approved content. Budget bands are the
 * owner-locked ranges. Warranty and manufacturing wording comes from the
 * existing FAQ and claims model. There are no client names, no localities
 * attached to quotes, no project titles and no completion timelines, because
 * none of those exist in an approved form — see `reviews.ts`, which is empty on
 * purpose.
 */

/* ========================================================================== */
/* Imagery provenance                                                         */
/* ========================================================================== */

/**
 * EVERY IMAGE ON THIS PAGE IS CATEGORY C.
 *
 * `PmAsset.provenanceCategory` is documented as "ONEDECORE marketing artwork.
 * Never presented as project photography", and every asset in the repository
 * carries `depictsCompletedProject: false`.
 *
 * That is a constraint on COPY, not just on alt text. A section captioned "our
 * work" over a category-C image is a false claim no matter how carefully the
 * alt attribute is worded, so the interactive sections describe what is being
 * PLANNED rather than what was built, and the one place a visitor is invited to
 * look at real projects sends them to `/portfolio`, where approved photography
 * actually lives.
 *
 * This string is rendered as a small caption wherever an image could be
 * mistaken for a finished ONEDECORE project.
 */
export const REFERENCE_IMAGERY_NOTE =
  "Reference visual. Approved project photography lives on the portfolio.";

/* ========================================================================== */
/* 1. Interactive Services                                                    */
/* ========================================================================== */

export interface ServiceCard {
  readonly id: string;
  readonly title: string;
  readonly description: string;
  readonly tags: readonly string[];
  readonly image: string | null;
  readonly imageAlt: string;
  /** Only where a real route exists. No invented destinations. */
  readonly href: string | null;
}

export const R5_SERVICES_COPY = {
  eyebrow: "What we do",
  heading: "Everything your home needs, under one roof",
  supporting: "One coordinated team for the spaces that matter most.",
} as const;

/**
 * Four cards, four photographs, one visual family.
 *
 * Renovation was a typographic card until the owner's final image pack landed:
 * the repository held nine images and not one showed civil work, and inventing
 * a site photograph is the failure the provenance model exists to prevent. The
 * pack supplies a real renovation scene — ladder, pails, rolled drawings,
 * part-finished plaster — so the card now says what it sells.
 *
 * All four are category C artwork, and the section's reference-imagery note
 * says so once beneath the rail rather than four times inside it.
 */
export const R5_SERVICES: readonly ServiceCard[] = [
  {
    id: "complete-home-interiors",
    title: "Complete Home Interiors",
    description: "One coordinated team for design, manufacturing and installation.",
    tags: ["Design", "Manufacturing", "Installation"],
    image: PM_ASSETS.interiorCompleteHome.path,
    imageAlt: PM_ASSETS.interiorCompleteHome.alt,
    href: null,
  },
  {
    id: "modular-kitchens",
    title: "Modular Kitchens",
    description: "Storage, workflow and finishes planned around how you cook.",
    tags: ["Smart storage", "Easy workflow", "Factory finish"],
    image: PM_ASSETS.interiorModularKitchen.path,
    imageAlt: PM_ASSETS.interiorModularKitchen.alt,
    href: null,
  },
  {
    id: "wardrobes",
    title: "Wardrobes",
    description: "Made-to-fit storage planned around your room and daily routine.",
    tags: ["Internal zoning", "Lofts", "Premium hardware"],
    image: PM_ASSETS.interiorWardrobes.path,
    imageAlt: PM_ASSETS.interiorWardrobes.alt,
    href: null,
  },
  {
    id: "renovation",
    title: "Renovation & Civil Work",
    description: "Layout changes, ceilings, electrical and civil work managed together.",
    tags: ["Civil work", "False ceiling", "Electrical"],
    image: PM_ASSETS.interiorRenovation.path,
    imageAlt: PM_ASSETS.interiorRenovation.alt,
    href: null,
  },
];

/* ========================================================================== */
/* 2. Room Explorer                                                           */
/* ========================================================================== */

export interface RoomOption {
  readonly id: string;
  readonly label: string;
  readonly title: string;
  readonly priorities: readonly [string, string, string];
  readonly image: string | null;
  readonly imageAlt: string;
}

export const R5_ROOMS_COPY = {
  eyebrow: "Room by room",
  heading: "Explore your home, room by room",
  supporting: "Tap a space to see what matters most in planning it.",
} as const;

/**
 * Exactly three priorities per room, by contract.
 *
 * Three is what fits on a phone beside a picture without becoming a list to
 * read. It is also what stops this section drifting back into the "room
 * priorities" paragraphs it replaced.
 *
 * Every room now has its own photograph, Bedroom included — it was typographic
 * only because no bedroom asset existed, never as a design choice. The panel's
 * image-less branch stays in `R5RoomExplorer` and stays tested: the rule it
 * enforces is that a room without an approved picture shows type rather than
 * borrowing another room's, and that rule has to outlive this particular set
 * of files.
 *
 * Kitchen and Wardrobes share their file with the matching service card. The
 * supplied pack ships those pairs as byte-identical images, so this is the
 * owner's mapping rendered faithfully, not an accident.
 */
export const R5_ROOMS: readonly RoomOption[] = [
  {
    id: "living-room",
    label: "Living Room",
    title: "Living Room",
    priorities: ["Comfortable layout flow", "TV and storage planning", "Layered lighting"],
    image: PM_ASSETS.interiorLivingRoom.path,
    imageAlt: PM_ASSETS.interiorLivingRoom.alt,
  },
  {
    id: "kitchen",
    label: "Kitchen",
    title: "Kitchen",
    priorities: ["Efficient work flow", "Storage zones", "Durable finishes"],
    image: PM_ASSETS.interiorModularKitchen.path,
    imageAlt: PM_ASSETS.interiorModularKitchen.alt,
  },
  {
    id: "bedroom",
    label: "Bedroom",
    title: "Bedroom",
    priorities: ["Restful layout", "Wardrobe planning", "Practical lighting"],
    image: PM_ASSETS.interiorBedroom.path,
    imageAlt: PM_ASSETS.interiorBedroom.alt,
  },
  {
    id: "wardrobes",
    label: "Wardrobes",
    title: "Wardrobes",
    priorities: ["Internal storage zoning", "Loft and accessory options", "Reliable hardware"],
    image: PM_ASSETS.interiorWardrobes.path,
    imageAlt: PM_ASSETS.interiorWardrobes.alt,
  },
];

/* ========================================================================== */
/* 3. Why ONEDECORE                                                           */
/* ========================================================================== */

export interface ProofCard {
  readonly id: string;
  readonly title: string;
  readonly description: string;
}

export const R5_WHY_COPY = {
  eyebrow: "Why ONEDECORE",
  heading: "More control. Fewer handoffs.",
  supporting:
    "Design, manufacturing and execution stay connected from planning to handover.",
} as const;

export const R5_WHY: readonly ProofCard[] = [
  {
    id: "own-manufacturing",
    title: "Own manufacturing",
    description: "Better control over finish, fit and timelines.",
  },
  {
    id: "one-team",
    title: "One team",
    description: "Design, manufacturing and installation under one roof.",
  },
  {
    id: "warranty",
    title: "10-year warranty",
    description: "Long-term confidence beyond handover.",
  },
  {
    id: "made-for-your-home",
    title: "Made for your home",
    description: "Planned around your space instead of forcing catalogue sizes.",
  },
];

/* ========================================================================== */
/* 4. How It Works                                                            */
/* ========================================================================== */

export interface ProcessStage {
  readonly id: string;
  readonly number: string;
  readonly title: string;
  readonly description: string;
}

export const R5_PROCESS_COPY = {
  eyebrow: "How it works",
  heading: "A clear path from idea to handover",
  supporting: "Four connected stages, managed by one team.",
} as const;

export const R5_PROCESS: readonly ProcessStage[] = [
  {
    id: "consultation",
    number: "01",
    title: "Consultation",
    description: "Understand your home, priorities, budget and timeline.",
  },
  {
    id: "design",
    number: "02",
    title: "Design",
    description: "Plan layouts, finishes and practical details before execution.",
  },
  {
    id: "manufacturing",
    number: "03",
    title: "Manufacturing",
    description: "Produce key elements with controlled factory quality checks.",
  },
  {
    id: "installation",
    number: "04",
    title: "Installation",
    description: "Coordinate site execution, finishing and final handover.",
  },
];

/* ========================================================================== */
/* 5. Own Factory                                                             */
/* ========================================================================== */

/**
 * The factory caption, and why it is not REFERENCE_IMAGERY_NOTE.
 *
 * The generic note says approved project photography lives on the portfolio.
 * That is the right sentence for a service card and the wrong one here: the
 * question a visitor has under the heading "Built in our own manufacturing
 * unit" is not "is this a finished project" but "is this YOUR factory".
 *
 * It is not. The supplied file is representative workshop artwork, and the
 * asset pack is explicit that it must never be presented as documentary
 * photography of the facility. So the caption answers the question that is
 * actually being asked, in the sentence directly beneath the picture.
 *
 * Replace the file with authentic ONEDECORE factory photography and this
 * constant has to change with it.
 */
export const FACTORY_IMAGERY_NOTE =
  "Representative manufacturing visual, not a photograph of ONEDECORE’s facility.";

export const R5_FACTORY_COPY = {
  eyebrow: "Our manufacturing",
  heading: "Built in our own manufacturing unit",
  supporting: "More control over precision, finish quality and production consistency.",
} as const;

/**
 * Three capability cards and NO factory photograph.
 *
 * There is no approved factory media in the repository — not one image of a
 * machine, a bench or a floor. The brief is explicit that stock factory
 * photography must not be labelled as ONEDECORE's, so this section is built
 * from type and interaction instead of from a picture of somebody else's
 * workshop.
 *
 * The claims are capability statements that already appear in approved content
 * ("its own manufacturing capability", quality checks before dispatch). None of
 * them names a machine, a tolerance or a certification, because none of those
 * is approved anywhere.
 */
export const R5_FACTORY: readonly ProofCard[] = [
  {
    id: "precision-cutting",
    title: "Precision cutting",
    description: "Accurate dimensions for cleaner installation.",
  },
  {
    id: "edge-finishing",
    title: "Edge finishing",
    description: "Consistent edges and durable detailing.",
  },
  {
    id: "quality-checks",
    title: "Quality checks",
    description: "Key components checked before dispatch and installation.",
  },
];

/* ========================================================================== */
/* 6. Budget Explorer                                                         */
/* ========================================================================== */

export interface BudgetHomeType {
  readonly id: LeadProjectScopeCode;
  readonly label: string;
  readonly bands: readonly string[];
}

export const R5_BUDGET_COPY = {
  eyebrow: "Plan your budget",
  heading: "See where your project could begin",
  supporting:
    "Choose your home type to explore the planning ranges ONEDECORE already uses.",
  cta: "Explore Your Options",
  /*
   * The one qualifier that must survive every edit. These are planning bands,
   * not quotations, and the existing FAQ makes the same distinction — a range
   * presented as a price is the fastest way to a dispute at handover.
   */
  disclaimer:
    "Indicative planning ranges. Final scope, materials and site conditions decide the quotation.",
} as const;

/**
 * The four home types shown on the homepage, in the owner's order.
 *
 * DERIVED, NOT RETYPED.
 *
 * The owner-locked bands in the brief turned out to be, digit for digit, the
 * ladder the lead form already uses — `BUDGET_RANGES_BY_PROJECT_SCOPE`. So this
 * reads them rather than repeating them. Typing "₹9–13L" into a second file
 * would have created two sources for one commercial fact, and the copy that
 * eventually drifts is always the one on the marketing page.
 *
 * It also means the explorer can never offer a band the form would refuse.
 *
 * VILLA IS EXCLUDED ON PURPOSE. The scope model has five entries and the form
 * still offers all five; the homepage shows four because the brief locks it to
 * four. That is a presentation decision, not a data one.
 */
export const R5_BUDGET_SCOPES: readonly LeadProjectScopeCode[] = [
  "kitchen",
  "1-bhk",
  "2-bhk",
  "3-bhk",
];

export const R5_BUDGET: readonly BudgetHomeType[] = R5_BUDGET_SCOPES.map((scope) => ({
  id: scope,
  label: PROJECT_SCOPE_LABELS[scope],
  bands: BUDGET_RANGES_BY_PROJECT_SCOPE[scope].map((option) => option.label),
}));

/* ========================================================================== */
/* 7. Portfolio                                                               */
/* ========================================================================== */

export const R5_PORTFOLIO_COPY = {
  eyebrow: "Our work",
  heading: "See how ONEDECORE homes come together",
  supporting: "Explore kitchens, bedrooms, living spaces and complete interior projects.",
  cta: "Explore Our Portfolio",
  href: "/portfolio",
} as const;

/* ========================================================================== */
/* 8. FAQ                                                                     */
/* ========================================================================== */

/**
 * Five questions, selected from the approved set rather than written here.
 *
 * `PM_FAQS` holds ten, each with wording that has already been through claim
 * review. This section shows the five that remove the most doubt, and the
 * answers are the approved ones verbatim — the component reads them from
 * `PM_FAQS` by id so the two can never drift.
 *
 * `areas` is one of the five on purpose. It is the only remaining place the
 * homepage answers "do you serve my part of Pune", now that the standalone
 * locality section has left the flow.
 */
export const R5_FAQ_COPY = {
  eyebrow: "Good to know",
  heading: "Questions homeowners usually ask",
} as const;

export const R5_FAQ_IDS = ["services", "cost", "factory", "warranty", "areas"] as const;
