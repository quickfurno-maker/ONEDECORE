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
import { HOME_CLAIMS, HOME_PUNE_AREAS, canQuotePublicClaim } from "./claims.ts";
import { canShowAggregateReviewSummary } from "./reviews.ts";
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

/**
 * The section at `#reviews` is only a reviews section when it can show reviews.
 *
 * While the rating, the review count and the satisfaction figure are
 * unevidenced and there is no source URL to cite, that section renders process
 * copy instead — so labelling the anchor "Reviews" would promise something the
 * page does not deliver. The anchor id is deliberately unchanged: renaming it
 * would break existing links and scroll-spy for no gain.
 */
export const PM_REVIEWS_NAV_LABEL = canShowAggregateReviewSummary()
  ? "Reviews"
  : "How We Work";

export const PM_NAV_ITEMS = [
  { label: "Services", href: `#${PM_SECTION_IDS.services}` },
  { label: "Estimate", href: `#${PM_SECTION_IDS.estimate}` },
  { label: "Why ONEDECORE", href: `#${PM_SECTION_IDS.why}` },
  { label: "Process", href: `#${PM_SECTION_IDS.process}` },
  { label: PM_REVIEWS_NAV_LABEL, href: `#${PM_SECTION_IDS.reviews}` },
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
  /* --------------------------------------------- final launch image pack --

   * Added by the owner's ONEDECORE_FINAL_WEBSITE_IMAGE_PACK. Category C like
   * everything above: ONEDECORE marketing artwork, never presented as a
   * photograph of a completed project.
   *
   * These are ADDITIONS, not replacements. The entries above still serve the
   * discovery pages, the Open Graph card and `InteriorsServiceBlocks`, and
   * repointing them would have changed pictures on surfaces this task was not
   * asked to touch.
   */

  /*
   * The hero is art-directed: two different crops, not one image at two sizes.
   * `HomeHero` feeds both through `getImageProps` into a native <picture>, so
   * the browser downloads exactly the one its media query selects.
   */
  heroHomeDesktop: {
    path: "/assets/onedecore/home/hero-home-desktop.webp",
    width: 1600,
    height: 900,
    alt: "",
    /*
     * Focal points were chosen after measuring text contrast at every approved
     * viewport, not by eye. The seating and the kitchen sit right of centre;
     * pulling the frame right keeps them out from under the headline while the
     * quieter plaster wall carries the copy.
     */
    focalPoint: "62% 52%",
    mobileFocalPoint: "62% 52%",
    bytes: 221362,
    provenanceCategory: "C",
    depictsCompletedProject: false,
  },
  heroHomeMobile: {
    path: "/assets/onedecore/home/hero-home-mobile.webp",
    width: 900,
    height: 1600,
    alt: "",
    /*
     * Biased downward. The top third of this crop is an empty cream ceiling —
     * the brightest part of the frame and exactly where the headline sits, so
     * the frame is pulled down to put the sofa and the kitchen behind the
     * counter row instead.
     */
    focalPoint: "50% 68%",
    mobileFocalPoint: "50% 68%",
    bytes: 158578,
    provenanceCategory: "C",
    depictsCompletedProject: false,
  },

  /*
   * Service and room artwork.
   *
   * `interiorModularKitchen` and `interiorWardrobes` each back TWO surfaces —
   * a service card and a room panel. That is not an oversight: the supplied
   * pack ships those pairs as byte-identical files (verified by sha256), so
   * storing them once and referencing them twice ships the owner's intent
   * without 277KB of duplicate bytes.
   */
  interiorCompleteHome: {
    path: "/assets/onedecore/home/interior-complete-home.webp",
    width: 1200,
    height: 900,
    alt: "Open-plan living and dining space with boucle seating, a round travertine table, a curved mirror and a timber-lined kitchen beyond",
    focalPoint: "50% 50%",
    mobileFocalPoint: "50% 48%",
    bytes: 219438,
    provenanceCategory: "C",
    depictsCompletedProject: false,
  },
  interiorModularKitchen: {
    path: "/assets/onedecore/home/interior-modular-kitchen.webp",
    width: 1200,
    height: 900,
    alt: "Modular kitchen with timber cabinetry, a veined stone island and breakfast stools, lit by three stone pendant lights",
    focalPoint: "50% 52%",
    mobileFocalPoint: "52% 50%",
    bytes: 134522,
    provenanceCategory: "C",
    depictsCompletedProject: false,
  },
  interiorWardrobes: {
    path: "/assets/onedecore/home/interior-wardrobes.webp",
    width: 1200,
    height: 900,
    alt: "Floor-to-ceiling wardrobe run with glazed centre doors, internal lighting, folded storage and an adjoining dresser",
    focalPoint: "52% 50%",
    mobileFocalPoint: "54% 48%",
    bytes: 142796,
    provenanceCategory: "C",
    depictsCompletedProject: false,
  },
  interiorRenovation: {
    path: "/assets/onedecore/home/interior-renovation-civil-work.webp",
    width: 1200,
    height: 900,
    alt: "Apartment mid-renovation with a stepladder, paint pails, rolled drawings and a toolbox in front of part-finished plaster and a cove-lit ceiling",
    focalPoint: "48% 54%",
    mobileFocalPoint: "46% 54%",
    bytes: 118548,
    provenanceCategory: "C",
    depictsCompletedProject: false,
  },
  interiorLivingRoom: {
    path: "/assets/onedecore/home/interior-living-room.webp",
    width: 1200,
    height: 900,
    alt: "Living room with a curved boucle sofa, round travertine coffee table and stone pendant lights, opening onto a terrace",
    focalPoint: "54% 54%",
    mobileFocalPoint: "56% 52%",
    bytes: 174550,
    provenanceCategory: "C",
    depictsCompletedProject: false,
  },
  interiorBedroom: {
    path: "/assets/onedecore/home/interior-bedroom.webp",
    width: 1200,
    height: 900,
    alt: "Bedroom with an upholstered bed, timber-panelled headboard wall, cove lighting and a boucle bench at the foot",
    focalPoint: "52% 50%",
    mobileFocalPoint: "54% 48%",
    bytes: 207266,
    provenanceCategory: "C",
    depictsCompletedProject: false,
  },

  /*
   * REPRESENTATIVE, AND THE CODE SAYS SO IN TWO PLACES.
   *
   * This is not a photograph of ONEDECORE's facility and must never be
   * presented as one. The alt text says "representative" and the section
   * renders `FACTORY_IMAGERY_NOTE` beneath it. Replace this file with
   * authentic factory photography and both statements have to be revisited
   * together — that is deliberate friction.
   */
  manufacturingReference: {
    path: "/assets/onedecore/home/manufacturing-reference.webp",
    width: 1600,
    height: 900,
    alt: "Representative joinery workshop: a panel saw, stacked sheet material on pallets and finish samples laid out on a stone-topped bench",
    focalPoint: "48% 54%",
    mobileFocalPoint: "46% 56%",
    bytes: 229826,
    provenanceCategory: "C",
    depictsCompletedProject: false,
  },

  /*
   * The homepage's way in to /portfolio, and nothing more. It carries no
   * project name, locality, client or date, because it is not a project.
   */
  portfolioEntry: {
    path: "/assets/onedecore/home/portfolio-entry.webp",
    width: 1600,
    height: 900,
    alt: "Open-plan living room and kitchen in warm neutrals, with boucle seating, a travertine table and a city view beyond the terrace",
    focalPoint: "52% 54%",
    mobileFocalPoint: "54% 52%",
    bytes: 238292,
    provenanceCategory: "C",
    depictsCompletedProject: false,
  },
} as const satisfies Record<string, PmAsset>;

/* -------------------------------------------------------------------- hero */

/**
 * The hero says four things and stops.
 *
 * WHAT WAS REMOVED, AND WHY IT IS NOT COMING BACK AS SHORTER COPY
 *
 * This object used to carry a `serviceLine`, a `lede` and a `reassurance`
 * strip, and the hero rendered all three between the headline and the CTA. On
 * a phone that was four stacked paragraphs before the button — the page spent
 * its first screen explaining itself instead of asking for the enquiry, and
 * everything below the hero started a scroll and a half down.
 *
 * None of it was replaced with a tighter version. A one-line summary under a
 * headline is still a line of text competing with the headline, and the three
 * removed blocks were each saying what the eyebrow and the four credibility
 * cells already say: what ONEDECORE does, where, and on what terms. The
 * argument is not lost, it is made once.
 *
 * The services themselves are the `HomeServicesRooms` section directly below,
 * which lists them with links rather than as a middot-separated line nobody
 * can click, and the Pune coverage is `InteriorsServiceAreas` further down,
 * which carries all 26 localities instead of the hero's six-plus-a-toggle.
 *
 * So the hero is: headline, one button, the credibility row. Adding a fourth
 * element here means taking the same decision again.
 *
 * THE EYEBROW IS GONE, ON PURPOSE.
 *
 * It read "Pune's Complete Interior Design & Build Company" — a second,
 * smaller, all-caps restatement of what the headline underneath it already
 * says, sitting between the visitor and the one sentence the hero exists to
 * deliver. Removed rather than reworded: the headline does not need an
 * introduction, and replacing it with a different badge would reintroduce the
 * same layer under a new name.
 */
export const PM_HERO = {
  titleLines: [
    { text: "Beautiful Homes.", emphasize: false },
    { text: "Designed, Built", emphasize: true },
    { text: "& Delivered by", emphasize: false },
    { text: "One Team.", emphasize: false },
  ],
  titlePlain: "Beautiful Homes. Designed, Built & Delivered by One Team.",
  primaryCta: PM_CTA.open,
  secondaryCta: PM_CTA.estimate,
  secondaryHref: `#${PM_SECTION_IDS.estimate}`,
} as const;

/**
 * Hero credibility cells, with unevidenced figures withheld.
 *
 * The projects count and the rating are dropped rather than softened — a cell
 * reading "Many" where "500+" used to be is the same unsourced claim with worse
 * copy. What remains states how ONEDECORE works, which needs no measurement.
 */
/**
 * A cell is either a counted number or a word, and it says which.
 *
 * WHY THE NUMBER IS A FIELD AND NOT A SUBSTRING
 *
 * These cells used to be display strings — "1000+", "10-Year", "Own", "End To
 * End". Animating them meant a regex fishing digits out of marketing copy, and
 * that regex would have counted the 10 in "10-Year", the nothing in "Own", and
 * eventually something wrong in whatever cell got added next. Worse, it would
 * have failed silently: a mis-parsed cell still renders, just with the wrong
 * number climbing in it.
 *
 * So the numeric cells carry `value` with its `prefix`/`suffix` beside it, and
 * `kind` says which sort of cell this is. `stat` is derived for the static ones
 * and composed for the counted ones, and nothing has to guess.
 *
 * The claim gates are untouched. A cell that `canQuotePublicClaim` rejects is
 * still absent, not softened, and giving the survivors a typed number does not
 * make any new figure quotable.
 */
export type PmCredibilityItem =
  | {
      readonly kind: "static";
      readonly id: string;
      readonly stat: string;
      readonly label: string;
    }
  | {
      readonly kind: "count";
      readonly id: string;
      readonly value: number;
      readonly prefix?: string;
      readonly suffix?: string;
      readonly label: string;
    };

/** The full text of a cell, counted or not. Never assembled at a call site. */
export function pmCredibilityText(item: PmCredibilityItem): string {
  return item.kind === "static"
    ? item.stat
    : `${item.prefix ?? ""}${item.value}${item.suffix ?? ""}`;
}

export const PM_CREDIBILITY: readonly PmCredibilityItem[] = [
  ...(canQuotePublicClaim("projects-delivered")
    ? [
        {
          kind: "count" as const,
          id: "projects",
          value: HOME_CLAIMS.projectsDelivered,
          suffix: "+",
          label: "Projects Delivered",
        },
      ]
    : []),
  /*
   * The rating stays a static cell even when it becomes quotable.
   *
   * It is 4.9, and `useCountUp` floors its intermediate values — counting it
   * would show 0, 1, 2, 3, 4 and land on 4 unless the hook grew decimal
   * support. A rating that animates to the wrong number is worse than one that
   * simply appears, so this cell is typed static on purpose rather than by
   * omission.
   */
  ...(canQuotePublicClaim("average-rating")
    ? [
        {
          kind: "static" as const,
          id: "rating",
          stat: `${HOME_CLAIMS.rating}/5`,
          label: "Average Rating",
        },
      ]
    : []),
  {
    kind: "static",
    id: "manufacturing",
    stat: "Own",
    label: "Manufacturing Unit",
  },
  canQuotePublicClaim("warranty-years")
    ? {
        kind: "count" as const,
        id: "warranty",
        value: HOME_CLAIMS.warrantyYears,
        suffix: "-Year",
        label: "Warranty",
      }
    : {
        kind: "static" as const,
        id: "warranty",
        stat: "Covered",
        label: "Approved Scopes",
      },
  {
    kind: "static",
    id: "process",
    stat: "End To End",
    label: "Design To Installation",
  },
];

/* ----------------------------------------------------------------- planner */

export const PM_PLANNER = {
  title: "Tell us about your home",
  entryHint: "Six quick answers — about a minute.",
  progressLabel: "Interior plan progress",
  steps: [
    { id: 1, legend: "What are you planning?", short: "Service" },
    { id: 2, legend: "What kind of home?", short: "Home" },
    { id: 3, legend: "When do you need it?", short: "Timeline" },
    { id: 4, legend: "Where should we send the plan?", short: "Brief" },
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
  scopeLegend: "How big is the home?",
  budgetRangeLegend: "Approximate budget",
  budgetRangeLockedHint:
    "Choose the size of your home and the matching budget bands appear here.",
  /*
   * Wardrobes have no size list and no approved budget ladder, so this step
   * asks nothing for them. The copy says why rather than showing an empty
   * panel, and it promises a conversation rather than a price.
   */
  wardrobeScopeNote:
    "Wardrobe projects are sized from your actual wall and storage plan, so there is no standard budget band to pick here. We will size it with you on the free consultation.",
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

/**
 * Proof metrics. The two performance figures are withheld; what remains counts
 * ONEDECORE's own service structure, which is a fact about the offer rather
 * than a claim about results.
 */
export const PM_PROOF_METRICS = [
  ...(canQuotePublicClaim("projects-delivered")
    ? [
        {
          id: "projects",
          value: HOME_CLAIMS.projectsDelivered,
          suffix: "+",
          label: "Projects Delivered",
        },
      ]
    : []),
  ...(canQuotePublicClaim("custom-designs")
    ? [
        {
          id: "custom",
          value: HOME_CLAIMS.customDesignPercent,
          suffix: "%",
          label: "Custom Designs",
        },
      ]
    : []),
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
  // The duration is what is pending, not the support itself.
  calloutTitle: canQuotePublicClaim("warranty-years")
    ? `${HOME_CLAIMS.warrantyYears}-Year Warranty Support`
    : "After-Sales Support On Approved Scopes",
  calloutBody:
    "Warranty coverage applies according to ONEDECORE’s approved written terms, product categories and exclusions.",
  imageryNote:
    "Material and process imagery is illustrative unless identified as authentic ONEDECORE factory media.",
  cta: PM_CTA.exploreScope,
} as const;

/* ----------------------------------------------------------- reviews */

/**
 * The heading and lede switch when the rating cannot be quoted.
 *
 * The section still earns its place — it carries the process rail and the two
 * conversion CTAs — but it stops calling itself "Client Reviews" and stops
 * asserting a score. `canShowAggregateReviewSummary()` decides.
 */
export const PM_REVIEWS = {
  eyebrow: canShowAggregateReviewSummary() ? "Client Reviews" : "How We Work",
  heading: canShowAggregateReviewSummary()
    ? `Rated ${HOME_CLAIMS.rating}/5 by homeowners across Pune`
    : "Built around how homeowners across Pune actually decide",
  body: canShowAggregateReviewSummary()
    ? `More than ${HOME_CLAIMS.reviews} client reviews reflect the confidence homeowners place in ONEDECORE’s custom planning, manufacturing control and coordinated interior delivery.`
    : "Custom planning, manufacturing control and coordinated delivery — the parts of an interior project that decide whether it lands on time and as drawn.",
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
    /*
     * THE FAQ IS WHERE THE DETAIL LIVES, SO IT MUST NOT OVERSTATE.
     *
     * The owner approved the hedged headline "Up to N+ Years Warranty" for the
     * proof strip on 2026-09-07, which makes `canQuotePublicClaim` true. That
     * does NOT make a flat "N-year warranty according to approved written
     * terms" true: every category period is still null, no claims contact is
     * recorded, and `WARRANTY_POLICY_STATUS` is still
     * scope-pending-owner-approval — so there are no approved written terms to
     * point at.
     *
     * The quotable branch therefore carries the SAME hedge as the headline —
     * "up to", "where applicable", eligibility rather than universality — and
     * keeps saying the detailed category terms are not yet published. The
     * headline and the FAQ may differ in precision; they may not contradict.
     */
    answer: canQuotePublicClaim("warranty-years")
      ? `Warranty support of up to ${HOME_CLAIMS.warrantyYears}+ years applies to eligible modular work, where applicable, following the written terms and exclusions agreed for the project. Detailed public category terms are not yet published.`
      : "Warranty coverage, where applicable, follows the written terms and exclusions agreed for the project. Detailed public category terms are not yet published.",
  },
  {
    id: "consultation",
    question: "Is the design consultation free?",
    answer:
      "Yes. The initial design consultation is free and helps clarify the home, rooms, timeline, budget and service scope without obligation.",
  },
  {
    /*
     * THE ANSWER HAS TO STAND ON ITS OWN NOW.
     *
     * It used to say "the listed 26 service areas", which was accurate while a
     * locality section sat lower on the same page. That section is out of the
     * homepage flow, so "the listed" pointed at nothing a reader could see —
     * and this entry became the only place the homepage answers "do you work in
     * my part of the city". So it names the count and enough localities to be
     * useful, and says what to do when a locality is not named.
     *
     * Count and names both come from `HOME_PUNE_AREAS`, the same array the old
     * section rendered. Nothing here is typed by hand, so the answer cannot
     * drift from the canonical list the way a transcribed copy would.
     */
    id: "areas",
    question: "Which areas does ONEDECORE serve?",
    answer: `ONEDECORE serves ${HOME_PUNE_AREAS.length} areas across Pune, including ${HOME_PUNE_AREAS.slice(
      0,
      6
    ).join(", ")}. If your locality is not listed, ask during the free consultation.`,
  },
  {
    /*
     * This used to say the homepage shows an aggregate rating and review count.
     * It no longer does — those figures are withheld until there is evidence
     * and a source to cite — so the answer described a section that does not
     * exist. Rather than restore the claim, the entry now answers the question
     * a homeowner actually has at this stage.
     */
    id: "reviews",
    question: canShowAggregateReviewSummary()
      ? "How are ONEDECORE’s ratings and review count presented?"
      : "How can I judge ONEDECORE’s work before committing?",
    answer: canShowAggregateReviewSummary()
      ? "The homepage shows ONEDECORE’s aggregate rating and review count. Individual review excerpts will only appear when their original source records are approved."
      : "Start with the free consultation and the published Portfolio. Scope, materials and milestones are clarified in writing before work begins, so you can judge the plan rather than a score.",
  },
  {
    id: "portfolio",
    question: "Where can I explore ONEDECORE projects?",
    answer:
      "Visit the ONEDECORE Portfolio for published project pages. Authentic completed-project photography and case studies will be added as final media is approved.",
  },
  {
    /*
     * The answer used to be "No — secure lead submission will connect in a
     * later release", which stopped being true the moment the lead form went
     * active and `/interiors` began rendering it.
     *
     * The copy carries BOTH forms and the component picks, exactly as PM_CLOSE
     * already does with its `*Active` variants. This module deliberately does
     * not import the form mode: it is a copy module, and the Phase 4A guard
     * asserts that nothing under `home-r4` reaches into the intake feature
     * outside the gated capture component.
     */
    id: "submitted",
    question: "Is anything submitted from this page?",
    questionActive: "What happens when I submit the consultation form?",
    answer:
      "No. You can create, review and copy your interior brief locally. Secure lead submission will connect in a later release.",
    answerActive:
      "Your consultation request is sent to ONEDECORE for review and follow-up. Submitting the form does not confirm an appointment or quotation.",
  },
] as const;

/**
 * The FAQ entry to render for a given lead form mode.
 *
 * An entry may carry `questionActive` / `answerActive`; when the form is live
 * those win. Everything else is unconditional.
 */
export function resolveFaqEntry(
  entry: (typeof PM_FAQS)[number],
  formActive: boolean
): { readonly id: string; readonly question: string; readonly answer: string } {
  const active = entry as {
    readonly id: string;
    readonly question: string;
    readonly answer: string;
    readonly questionActive?: string;
    readonly answerActive?: string;
  };
  return {
    id: active.id,
    question:
      formActive && active.questionActive ? active.questionActive : active.question,
    answer: formActive && active.answerActive ? active.answerActive : active.answer,
  };
}

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

/*
 * `estimate` left this bar and did not leave the page.
 *
 * The sticky is two actions wide on a phone, and the second slot was spending
 * itself on a scroll shortcut to a section the visitor reaches anyway. Calling
 * is the thing a person cannot do from the page at all, and it is the one they
 * reach for when a form is more commitment than the question deserves.
 *
 * `HomeBudgetEstimator` still renders in full — only the shortcut is gone.
 */
export const PM_STICKY = {
  plan: PM_CTA.openShort,
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
    { label: PM_REVIEWS_NAV_LABEL, href: `#${PM_SECTION_IDS.reviews}` },
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

