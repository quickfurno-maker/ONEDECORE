/**
 * Owner-approved commercial claims — single source of truth for R5.3.
 * Visible UI must derive from this config. No contradictory hardcoding.
 * No JSON-LD aggregateRating/Review/Warranty until evidence URLs exist.
 */
export const HOME_CLAIMS = {
  projectsDelivered: 500,
  rating: 4.9,
  reviews: 200,
  warrantyYears: 10,
  clientSatisfactionPercent: 98,
  customDesignPercent: 100,
  ownsManufacturingUnit: true,
  freeDesignConsultation: true,
} as const;

export const HOME_CLAIM_COPY = {
  projectsDelivered: `${HOME_CLAIMS.projectsDelivered}+ Projects Delivered`,
  rating: `${HOME_CLAIMS.rating}/5 Average Rating`,
  reviews: `${HOME_CLAIMS.reviews}+ Client Reviews`,
  warranty: `${HOME_CLAIMS.warrantyYears}-Year Warranty`,
  satisfaction: `${HOME_CLAIMS.clientSatisfactionPercent}% Client Satisfaction`,
  customDesigns: `${HOME_CLAIMS.customDesignPercent}% Custom Designs`,
  manufacturing: "Own Manufacturing Unit",
  freeConsultation: "Free Design Consultation",
} as const;

export const HOME_PUNE_AREAS = [
  "Kharadi",
  "Viman Nagar",
  "Baner",
  "Wakad",
  "Hinjewadi",
  "Hadapsar",
  "Koregaon Park",
  "Aundh",
  "Magarpatta",
  "Kalyani Nagar",
  "Pimple Saudagar",
  "Balewadi",
  "Undri",
  "NIBM",
  "Kothrud",
  "Wagholi",
  "Kondhwa",
  "Sus Road",
  "Pashan",
  "Wanowrie",
  "Vishrantwadi",
  "Dhanori",
  "Ambegaon",
  "Punawale",
  "Ravet",
  "Tathawade",
] as const;

export type HomePuneArea = (typeof HOME_PUNE_AREAS)[number];

/* -------------------------------------------------------------------------- */
/* What may actually be rendered                                              */
/* -------------------------------------------------------------------------- */

/**
 * The claims above are the OWNER-APPROVED WORDING. They are not, on their own,
 * permission to publish a figure.
 *
 * `publicEvidenceStatus` is `pending` for all of them — see
 * `@/features/legal/claim-evidence`. The site was rendering approved wording as
 * though it were verified evidence: "4.9/5 Average Rating" and "200+ Client
 * Reviews" while `HOME_VERIFIED_REVIEWS` is empty and `HOME_REVIEW_SOURCE_URL`
 * is null.
 *
 * So each claim now has two forms. The quantified one is used only once the
 * evidence gate opens; until then the qualitative one describes the same thing
 * without asserting a number nobody can source. Some claims have no qualitative
 * substitute at all — a rating is a number or it is nothing — and those
 * disappear rather than being softened into a vaguer version of the same
 * assertion.
 */

import {
  isClaimDisplayable,
  isClaimPubliclyEvidenced,
  type PublicClaimId,
} from "../../legal/claim-evidence.ts";

export interface PublicClaimDisplay {
  readonly claimId: PublicClaimId;
  /** True only when public evidence exists. Owner attestation does not set it. */
  readonly evidenced: boolean;
  /** True when the figure may be rendered — evidenced OR owner-attested. */
  readonly displayable: boolean;
  /** The quantified wording. Rendered ONLY when `evidenced`. */
  readonly quantified: string;
  /** Truthful wording that asserts no figure. `null` = render nothing. */
  readonly qualitative: string | null;
  /** What to render right now. `null` = render nothing. */
  readonly label: string | null;
}

const QUALITATIVE: Readonly<Record<PublicClaimId, string | null>> = {
  "projects-delivered": "Complete Homes, Delivered End To End",
  // A rating, a review count and a satisfaction percentage are figures or they
  // are nothing. There is no honest qualitative version of "4.9/5".
  "average-rating": null,
  "client-reviews": null,
  "client-satisfaction": null,
  "warranty-years": "Warranty On Approved Scopes",
  "custom-designs": "Made To Measure, Never Off The Shelf",
  // Factual statements about how the business operates, not measured figures.
  "own-manufacturing-unit": HOME_CLAIM_COPY.manufacturing,
  "free-design-consultation": HOME_CLAIM_COPY.freeConsultation,
};

const QUANTIFIED: Readonly<Record<PublicClaimId, string>> = {
  "projects-delivered": HOME_CLAIM_COPY.projectsDelivered,
  "average-rating": HOME_CLAIM_COPY.rating,
  "client-reviews": HOME_CLAIM_COPY.reviews,
  "client-satisfaction": HOME_CLAIM_COPY.satisfaction,
  "warranty-years": HOME_CLAIM_COPY.warranty,
  "custom-designs": HOME_CLAIM_COPY.customDesigns,
  "own-manufacturing-unit": HOME_CLAIM_COPY.manufacturing,
  "free-design-consultation": HOME_CLAIM_COPY.freeConsultation,
};

export function resolvePublicClaim(claimId: PublicClaimId): PublicClaimDisplay {
  const evidenced = isClaimPubliclyEvidenced(claimId);
  const displayable = isClaimDisplayable(claimId);
  const quantified = QUANTIFIED[claimId];
  const qualitative = QUALITATIVE[claimId];
  return {
    claimId,
    evidenced,
    displayable,
    quantified,
    qualitative,
    label: displayable ? quantified : qualitative,
  };
}

/** The rendered label, or `null` when this claim must not be shown at all. */
export function publicClaimLabel(claimId: PublicClaimId): string | null {
  return resolvePublicClaim(claimId).label;
}

/**
 * `true` when the figure itself may be printed.
 *
 * Evidenced, or owner-attested. Ask `isClaimPubliclyEvidenced` instead when the
 * question is whether anybody can point at a source — the register does, and a
 * structured-data emitter would have to.
 */
export function canQuotePublicClaim(claimId: PublicClaimId): boolean {
  return resolvePublicClaim(claimId).displayable;
}
