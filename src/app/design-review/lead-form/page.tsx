import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { publicSiteFontVariables } from "@/features/public-site/fonts";
import { RequirementFormReview } from "@/features/lead-intake/public/RequirementFormReview";
import "@/features/lead-intake/public/requirement-form-review.css";

/**
 * Localhost-only review surface for the redesigned client requirement form.
 *
 * FAIL-CLOSED BY CONSTRUCTION
 *
 * The gate is `NODE_ENV`, not an environment variable, because an env-var gate
 * is one missing line in a deploy away from being public. `next build` sets
 * production, so this route cannot exist in a production bundle even if someone
 * links to it. `noindex` is belt-and-braces for the same reason.
 *
 * This route renders NO lead-intake call. It exists so the design and the
 * requirement -> budget interaction can be reviewed before any decision is made
 * about the live form.
 */
export const metadata: Metadata = {
  title: "Client requirement form — design review",
  robots: { index: false, follow: false },
};

export default function LeadFormDesignReviewPage() {
  if (process.env.NODE_ENV === "production") {
    notFound();
  }

  return (
    <div
      className={publicSiteFontVariables}
      data-public-dark-theme=""
      style={{ minHeight: "100dvh" }}
    >
      <RequirementFormReview />
    </div>
  );
}
