import {
  PORTFOLIO_SERVICE_LABELS,
  type PortfolioServiceKey,
} from "./constants.ts";

/**
 * The four public portfolio categories — one definition, three consumers.
 *
 * The homepage category cards, the portfolio page chips and the URL mapping all
 * read this file. Duplicating the labels across those three is how a chip ends
 * up linking to a filter nobody implemented.
 *
 * WHY EACH CATEGORY CARRIES A `service`, AND WHY TWO SHARE ONE
 *
 * The portfolio is filtered by `?service=`, and `portfolio_projects.service_code`
 * is constrained by the database to exactly three values:
 *
 *   complete_home_interiors · modular_kitchens · custom_wardrobes
 *
 * "Complete Interiors" and "Kitchen" map onto that taxonomy exactly. "Hall /
 * Living Room" and "Bedroom" do NOT: they are ROOMS, and the schema records the
 * service a project was sold as, not the rooms it contains. A complete-home
 * project contains a hall and bedrooms; a "bedroom service code" does not exist.
 *
 * So both room categories point at the complete-home listing, which is the set
 * of projects that genuinely contain those rooms — and `narrowsListing: false`
 * records that the chip navigates rather than narrows. Two chips returning the
 * same projects is a known limitation, not an accident, and it is marked here so
 * the next person reads it in the config instead of discovering it in the UI.
 *
 * Giving these rooms a real filter needs a room-level taxonomy on the project
 * record. That is a schema change, and it is deliberately not smuggled into a
 * UI task.
 */

export type PortfolioCategoryId =
  | "complete-interiors"
  | "kitchen"
  | "hall"
  | "bedroom";

export interface PortfolioCategory {
  readonly id: PortfolioCategoryId;
  readonly label: string;
  /** The service listing this category opens. */
  readonly service: PortfolioServiceKey;
  /**
   * Whether the chip actually narrows the listing to something the other
   * categories do not show. False for the two room categories — see above.
   */
  readonly narrowsListing: boolean;
  /** Asset key on the homepage card. Real ONEDECORE photography only. */
  readonly assetKey: "completeHomeInteriors" | "modularKitchens" | "hero" | "oakJoinery";
  /**
   * Whether that photograph honestly depicts this category. When false the card
   * marks its image decorative and lets the visible title do the describing.
   */
  readonly depictsCategory: boolean;
}

export const PORTFOLIO_CATEGORIES: readonly PortfolioCategory[] = [
  {
    id: "complete-interiors",
    label: "Complete Interiors",
    service: "complete_home_interiors",
    narrowsListing: true,
    assetKey: "completeHomeInteriors",
    depictsCategory: true,
  },
  {
    id: "kitchen",
    label: "Kitchen",
    service: "modular_kitchens",
    narrowsListing: true,
    assetKey: "modularKitchens",
    depictsCategory: true,
  },
  {
    id: "hall",
    label: "Hall / Living Room",
    service: "complete_home_interiors",
    narrowsListing: false,
    // A living room with a media wall — the closest honest depiction available.
    assetKey: "hero",
    depictsCategory: true,
  },
  {
    id: "bedroom",
    label: "Bedroom",
    service: "complete_home_interiors",
    narrowsListing: false,
    // No bedroom photograph exists in the asset library. A material study is
    // used rather than a kitchen or living room standing in for a bedroom.
    assetKey: "oakJoinery",
    depictsCategory: false,
  },
];

/** The category the portfolio page selects when nothing is requested. */
export const DEFAULT_PORTFOLIO_CATEGORY: PortfolioCategoryId = "complete-interiors";

/**
 * The portfolio URL for a category.
 *
 * Uses the EXISTING `?service=` convention rather than inventing a second
 * filter parameter — `parseListingParams` already validates it and 404s on
 * anything unknown, and a parallel `?category=` would be a second routing model
 * for the same idea.
 */
export function portfolioCategoryHref(category: PortfolioCategory): string {
  return `/portfolio?service=${category.service}`;
}

/** The category a `?service=` listing should show as selected. */
export function portfolioCategoryForService(
  service: PortfolioServiceKey | null
): PortfolioCategoryId | null {
  if (service === null) {
    return null;
  }
  const match = PORTFOLIO_CATEGORIES.find(
    (category) => category.narrowsListing && category.service === service
  );
  return match ? match.id : null;
}

/*
 * A cheap invariant, checked at import rather than trusted: every category must
 * name a service the database actually allows.
 */
for (const category of PORTFOLIO_CATEGORIES) {
  if (!Object.hasOwn(PORTFOLIO_SERVICE_LABELS, category.service)) {
    throw new Error(
      `[ONEDECORE portfolio] Category "${category.id}" names unknown service "${category.service}".`
    );
  }
}
