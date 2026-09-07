/**
 * Whether a public business claim may be STATED as a number.
 *
 * TWO DIFFERENT THINGS THAT WERE BEING TREATED AS ONE
 *
 * `ownerApprovalDisplayCopy` means the owner approved the wording. It has
 * always been `true` for these claims and it is not in dispute.
 *
 * `publicEvidenceStatus` means somebody can point at the thing the number came
 * from — a review profile, a project register, a signed warranty schedule. It
 * is `pending` for every claim below, and has been since the registry was
 * written.
 *
 * The site was rendering the first as though it were the second. "4.9/5
 * Average Rating" and "200+ Client Reviews" appeared on the homepage and on
 * `/interiors` while `HOME_VERIFIED_REVIEWS` is empty and
 * `HOME_REVIEW_SOURCE_URL` is `null` — a rating with no reviews behind it and
 * no source to cite. Google Ads and Meta both restrict unsubstantiated
 * performance and review claims, so this is not only a truthfulness question;
 * it is a plausible cause of ad disapproval at launch.
 *
 * WHAT THIS MODULE DOES
 *
 * It records the status, and nothing else decides. `business-truth-registry`
 * derives its per-claim statuses from here so the register and the rendered
 * page cannot disagree, and the public copy asks `isClaimPubliclyEvidenced()`
 * before quoting a figure.
 *
 * THE NARROW EXCEPTION
 *
 * `ownerAttestedDisplay` is a THIRD state, and it is deliberately not a way of
 * saying "verified". It means the owner has taken personal responsibility for
 * publishing a specific figure while its public evidence is still pending.
 *
 * OWNER-ATTESTED DISPLAY IS NOT PUBLIC EVIDENCE VERIFIED. `evidence` stays
 * `pending`, the business-truth register still reports it as pending, and
 * `structuredDataPermission` stays false — no `aggregateRating`, no `Review`,
 * no schema.org claim a search engine could index as a fact. The exception
 * changes exactly one thing: whether the figure may appear as visible copy.
 *
 * It is granted per claim, never in bulk, and each grant records who asked for
 * it and when.
 *
 * TO TURN A CLAIM ON
 *
 * Record the evidence — the source URL, the register, the signed terms — and
 * set `evidence: "verified"` here. For a claim that also needs effective legal
 * terms, `legalTerms` must be `approved` as well. Editing this file to make a
 * test pass is the one thing it exists to prevent.
 *
 * This module imports nothing. That is deliberate: the registry imports the
 * claim copy, and the claim copy imports this, so a dependency here would close
 * a cycle.
 */

export const PUBLIC_CLAIM_IDS = [
  "projects-delivered",
  "average-rating",
  "client-reviews",
  "warranty-years",
  "client-satisfaction",
  "custom-designs",
  "own-manufacturing-unit",
  "free-design-consultation",
] as const;

export type PublicClaimId = (typeof PUBLIC_CLAIM_IDS)[number];

export type PublicEvidenceStatus = "pending" | "verified" | "withdrawn";
export type LegalTermsStatus = "pending" | "approved" | "not-applicable";

export interface ClaimEvidenceRecord {
  readonly evidence: PublicEvidenceStatus;
  readonly legalTerms: LegalTermsStatus;
  /**
   * The owner has authorised publishing this figure while evidence is pending.
   * NOT a claim of verification — see the note above. Defaults to absent.
   */
  readonly ownerAttestedDisplay?: {
    readonly attestedOn: string;
    readonly note: string;
  };
  /**
   * `true` when the claim promises something contractual — a warranty period —
   * so approved wording and a verified number are not enough on their own.
   */
  readonly requiresEffectiveLegalTerms: boolean;
  /** Why it is where it is. Read by humans, not by code. */
  readonly note: string;
}

const PENDING = {
  evidence: "pending",
  legalTerms: "pending",
} as const;

export const PUBLIC_CLAIM_EVIDENCE: Readonly<
  Record<PublicClaimId, ClaimEvidenceRecord>
> = {
  "projects-delivered": {
    ...PENDING,
    requiresEffectiveLegalTerms: false,
    note: "No published project register or evidence URL. The public portfolio is currently empty.",
    /*
     * Owner-directed, L1.1 (2026-09-07): display the project count and nothing
     * else. The rating, review count, satisfaction percentage and warranty
     * duration were explicitly NOT authorised and remain withheld.
     */
    ownerAttestedDisplay: {
      attestedOn: "2026-09-07",
      note: "Owner explicitly authorised displaying the project count in L1.1. Evidence remains pending and structured data remains forbidden.",
    },
  },
  "average-rating": {
    ...PENDING,
    requiresEffectiveLegalTerms: false,
    note: "HOME_VERIFIED_REVIEWS is empty and HOME_REVIEW_SOURCE_URL is null — there is no rating source to cite.",
  },
  "client-reviews": {
    ...PENDING,
    requiresEffectiveLegalTerms: false,
    note: "Same source gap as the rating. No review platform is connected.",
  },
  "warranty-years": {
    ...PENDING,
    requiresEffectiveLegalTerms: true,
    note: "WARRANTY_POLICY_STATUS is scope-pending-owner-approval, every category period is null and no claims contact is recorded.",
  },
  "client-satisfaction": {
    ...PENDING,
    requiresEffectiveLegalTerms: false,
    note: "A satisfaction percentage implies a measured survey. None is recorded.",
  },
  "custom-designs": {
    ...PENDING,
    requiresEffectiveLegalTerms: false,
    note: "A 100% figure is a measurable claim about every project delivered.",
  },
  "own-manufacturing-unit": {
    ...PENDING,
    requiresEffectiveLegalTerms: false,
    note: "A factual statement about how the business operates rather than a measured figure. Retained deliberately as qualitative copy; no factory address or certificate is asserted.",
  },
  "free-design-consultation": {
    ...PENDING,
    requiresEffectiveLegalTerms: false,
    note: "An offer the business makes, not a measured figure. Retained.",
  },
};

/**
 * May this claim be published as a quantified statement?
 *
 * Anything short of verified evidence is a no, and a claim that also promises
 * contractual terms needs those in force too.
 */
export function isClaimPubliclyEvidenced(
  claimId: PublicClaimId,
  records: Readonly<
    Record<PublicClaimId, ClaimEvidenceRecord>
  > = PUBLIC_CLAIM_EVIDENCE
): boolean {
  const record = records[claimId];
  if (!record) {
    return false;
  }
  if (record.evidence !== "verified") {
    return false;
  }
  if (record.requiresEffectiveLegalTerms && record.legalTerms !== "approved") {
    return false;
  }
  return true;
}

/**
 * May this claim's figure be RENDERED?
 *
 * Either it is evidenced, or the owner has attested to it explicitly. This is
 * the question the public copy asks. `isClaimPubliclyEvidenced` remains the
 * question the register answers, and the two are not the same — which is the
 * whole point of keeping both.
 */
export function isClaimDisplayable(
  claimId: PublicClaimId,
  records: Readonly<
    Record<PublicClaimId, ClaimEvidenceRecord>
  > = PUBLIC_CLAIM_EVIDENCE
): boolean {
  if (isClaimPubliclyEvidenced(claimId, records)) {
    return true;
  }
  const record = records[claimId];
  if (!record?.ownerAttestedDisplay) {
    return false;
  }
  // An attested claim that also needs contractual terms still needs them.
  if (record.requiresEffectiveLegalTerms && record.legalTerms !== "approved") {
    return false;
  }
  return true;
}

/** Claims the owner has taken responsibility for without public evidence. */
export function getOwnerAttestedClaimIds(
  records: Readonly<
    Record<PublicClaimId, ClaimEvidenceRecord>
  > = PUBLIC_CLAIM_EVIDENCE
): readonly PublicClaimId[] {
  return PUBLIC_CLAIM_IDS.filter(
    (id) => !isClaimPubliclyEvidenced(id, records) && isClaimDisplayable(id, records)
  );
}

/** Every claim that is not yet safe to quote as a figure. */
export function getUnevidencedClaimIds(
  records: Readonly<
    Record<PublicClaimId, ClaimEvidenceRecord>
  > = PUBLIC_CLAIM_EVIDENCE
): readonly PublicClaimId[] {
  return PUBLIC_CLAIM_IDS.filter((id) => !isClaimPubliclyEvidenced(id, records));
}
