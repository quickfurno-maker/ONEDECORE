import type { PublicPortfolioCard } from "@/features/portfolio/public/types";

/**
 * Homepage project-proof gate.
 *
 * Default remains `pending` so CMS / seed cards never appear as authentic
 * ONEDECORE completed work on `/` without an explicit owner decision.
 *
 * Change to `"published"` only after authentic completed-project media and
 * metadata receive owner approval.
 */
export const HOME_PROJECT_PROOF_MODE = "pending" as const;

export type HomeProjectProofMode = "pending" | "published";

export function selectHomepageProjectProof(
  featured: readonly PublicPortfolioCard[]
): readonly PublicPortfolioCard[] {
  if (HOME_PROJECT_PROOF_MODE === "pending") {
    return [];
  }

  return featured.filter((card) => Boolean(card.cover?.url));
}
