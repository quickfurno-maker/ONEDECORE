/**
 * Homepage review presentation — aggregate claims from claims.ts only.
 * No Review / rating JSON-LD until public evidence URLs exist.
 */
import { HOME_CLAIMS } from "./claims.ts";

export type HomeReviewMode = "aggregate-only" | "verified-excerpts";

export interface VerifiedHomeReview {
  readonly id: string;
  readonly rating: 1 | 2 | 3 | 4 | 5;
  readonly quote: string;
  readonly reviewerName: string;
  readonly locality?: string;
  readonly service?: string;
  readonly sourceName: string;
  readonly sourceUrl: string;
  readonly publishedDate?: string;
}

export const HOME_REVIEW_MODE: HomeReviewMode = "aggregate-only";

export const HOME_REVIEW_SUMMARY = {
  rating: HOME_CLAIMS.rating,
  count: HOME_CLAIMS.reviews,
  satisfactionPercent: HOME_CLAIMS.clientSatisfactionPercent,
} as const;

export const HOME_VERIFIED_REVIEWS: readonly VerifiedHomeReview[] = [];

export const HOME_REVIEW_SOURCE_URL: string | null = null;

export function canShowVerifiedExcerpts(
  mode: HomeReviewMode = HOME_REVIEW_MODE,
  reviews: readonly VerifiedHomeReview[] = HOME_VERIFIED_REVIEWS
): boolean {
  if (mode !== "verified-excerpts") return false;
  if (reviews.length === 0) return false;
  return reviews.every(
    (review) =>
      Boolean(review.id) &&
      Boolean(review.quote) &&
      Boolean(review.reviewerName) &&
      Boolean(review.sourceName) &&
      /^https:\/\//i.test(review.sourceUrl)
  );
}
