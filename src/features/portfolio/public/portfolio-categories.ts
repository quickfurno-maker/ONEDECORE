

/**
 * The four public portfolio categories — one definition, four consumers.
 *
 * The homepage cards, the portfolio chips, the URL mapping and the database
 * filter all read this file. Duplicating the labels across those is how a chip
 * ends up linking to a filter nobody implemented.
 *
 * A REAL TAXONOMY, NOT AN ALIAS
 *
 * These are ROOM categories and they have their own column,
 * `portfolio_projects.portfolio_category_code`. They are deliberately NOT
 * `service_code` values: that field records the service a project was sold as
 * and is read by CRM and lead matching, and overloading it with rooms to make a
 * navigation control look right would corrupt it.
 *
 * A project may be unclassified. The column is nullable, nothing was
 * backfilled by guesswork, and an unclassified project simply does not appear
 * under a category — which is the honest behaviour, because the alternative is
 * showing somebody a "bedroom" nobody looked at.
 */

export type PortfolioCategoryId =
  | "complete-interiors"
  | "kitchen"
  | "hall"
  | "bedroom";

export interface PortfolioCategory {
  /** Also the stored `portfolio_category_code` and the `?category=` value. */
  readonly id: PortfolioCategoryId;
  readonly label: string;
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
    assetKey: "completeHomeInteriors",
    depictsCategory: true,
  },
  {
    id: "kitchen",
    label: "Kitchen",
    assetKey: "modularKitchens",
    depictsCategory: true,
  },
  {
    id: "hall",
    label: "Hall / Living Room",
    // A living room with a media wall — the closest honest depiction available.
    assetKey: "hero",
    depictsCategory: true,
  },
  {
    id: "bedroom",
    label: "Bedroom",
    // No bedroom photograph exists in the asset library. A material study is
    // used rather than a kitchen or living room standing in for a bedroom.
    assetKey: "oakJoinery",
    depictsCategory: false,
  },
];

/** Every value the column and the query parameter accept. */
export const PORTFOLIO_CATEGORY_IDS: readonly PortfolioCategoryId[] =
  PORTFOLIO_CATEGORIES.map((category) => category.id);

export function isPortfolioCategoryId(
  value: unknown
): value is PortfolioCategoryId {
  return (
    typeof value === "string" &&
    (PORTFOLIO_CATEGORY_IDS as readonly string[]).includes(value)
  );
}

/** The category the portfolio page selects when nothing is requested. */
export const DEFAULT_PORTFOLIO_CATEGORY: PortfolioCategoryId = "complete-interiors";

/** The portfolio URL for a category. */
export function portfolioCategoryHref(category: PortfolioCategory): string {
  return `/portfolio?category=${category.id}`;
}
