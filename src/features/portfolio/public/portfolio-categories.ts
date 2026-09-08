/**
 * The project-level room facet — compatibility, not public navigation.
 *
 * WHAT THIS IS NOW
 *
 * Public browsing moved to `portfolio-rooms.ts`: `Projects | Living Room |
 * Bedroom | Kitchen`, where the three room views list PHOTOGRAPHS tagged with
 * `portfolio_media.room_category_code`. A visitor who clicks "Bedroom" wants to
 * look at bedrooms, and a project-level facet answers a different question.
 *
 * These ids remain as the `portfolio_project_categories` vocabulary — a
 * reasonable project-level facet, still stored, still constrained by the
 * database — and as the `?category=` values old links may carry. They are NOT
 * the authority for room-photo galleries and no longer drive the homepage
 * navigation.
 *
 * HALL IS GONE
 *
 * It was "Hall / Living Room", which asked a visitor to decide which word
 * described their own room. Living Room is the single public term. Migration
 * 20260908160000 translated stored `hall` values and removed it from both
 * database allowlists, so it cannot return through the CMS either.
 */

export type PortfolioCategoryId =
  | "complete-interiors"
  | "kitchen"
  | "living-room"
  | "bedroom";

export interface PortfolioCategory {
  /** Also the stored `portfolio_category_code` and the `?category=` value. */
  readonly id: PortfolioCategoryId;
  readonly label: string;
  /** Asset key retained for any surface that still renders a facet tile. */
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
    id: "living-room",
    label: "Living Room",
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

/** The facet the project listing means when nothing is requested. */
export const DEFAULT_PORTFOLIO_CATEGORY: PortfolioCategoryId = "complete-interiors";

/**
 * The portfolio URL for a facet.
 *
 * Emits the CANONICAL `?view=` form. `?category=` still parses for links that
 * already exist in the wild, but nothing should be minting new ones — two
 * addresses for one listing is how a duplicate-content problem starts.
 */
export function portfolioCategoryHref(category: PortfolioCategory): string {
  return category.id === "complete-interiors"
    ? "/portfolio"
    : `/portfolio?view=${category.id}`;
}
