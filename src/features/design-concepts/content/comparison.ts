/**
 * Owner comparison matrix for the three R2 homepage concepts.
 *
 * Ratings are a design-team reading of each direction, not a recommendation.
 * No concept is marked as selected; the owner decides in
 * onedecore-chatgpt/phase-2f-r2-concepts/OWNER_CONCEPT_DECISION.md.
 */

export type ComparisonRating = 1 | 2 | 3 | 4 | 5;

export interface ComparisonRow {
  readonly category: string;
  readonly note: string;
  readonly cinematic: ComparisonRating;
  readonly architectural: ComparisonRating;
  readonly designTech: ComparisonRating;
}

/** Higher is better for every category except the two flagged below. */
export const LOWER_IS_BETTER_CATEGORIES = [
  "Implementation complexity",
  "Performance risk",
] as const;

export const COMPARISON_ROWS = [
  {
    category: "Brand impact",
    note: "How strongly the first viewport establishes ONEDECORE.",
    cinematic: 5,
    architectural: 4,
    designTech: 4,
  },
  {
    category: "Luxury",
    note: "Perceived material richness and restraint.",
    cinematic: 5,
    architectural: 4,
    designTech: 4,
  },
  {
    category: "Modernity",
    note: "How current the layout language feels.",
    cinematic: 4,
    architectural: 5,
    designTech: 5,
  },
  {
    category: "Startup energy",
    note: "Sense of a well-funded, forward-moving company.",
    cinematic: 3,
    architectural: 3,
    designTech: 5,
  },
  {
    category: "Warmth",
    note: "Emotional warmth of surfaces and typography.",
    cinematic: 5,
    architectural: 3,
    designTech: 4,
  },
  {
    category: "Architectural precision",
    note: "Grid discipline and alignment rigour.",
    cinematic: 3,
    architectural: 5,
    designTech: 4,
  },
  {
    category: "Conversion clarity",
    note: "How obvious the single Explore Our Work path is.",
    cinematic: 4,
    architectural: 4,
    designTech: 5,
  },
  {
    category: "Portfolio strength",
    note: "Quality of the Selected Work presentation.",
    cinematic: 4,
    architectural: 4,
    designTech: 5,
  },
  {
    category: "Mobile quality",
    note: "Composition and rhythm at 360–390px.",
    cinematic: 4,
    architectural: 5,
    designTech: 4,
  },
  {
    category: "Motion intensity",
    note: "Amount of movement the visitor perceives.",
    cinematic: 4,
    architectural: 2,
    designTech: 3,
  },
  {
    category: "Implementation complexity",
    note: "Lower is better. Effort to carry across the full site.",
    cinematic: 4,
    architectural: 2,
    designTech: 4,
  },
  {
    category: "Performance risk",
    note: "Lower is better. Weight of imagery, layers, and effects.",
    cinematic: 4,
    architectural: 2,
    designTech: 3,
  },
  {
    category: "Long-term scalability",
    note: "How well the system absorbs services, process, and contact pages.",
    cinematic: 3,
    architectural: 5,
    designTech: 5,
  },
] as const satisfies readonly ComparisonRow[];

export const COMPARISON_INTRO =
  "Ratings are a design-team reading on a 1–5 scale, offered as a starting point for discussion. Two categories are inverted: for implementation complexity and performance risk, a lower score is the better outcome.";
