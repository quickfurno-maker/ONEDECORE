# Business truth registry — Phase 3A1

Code mirror: `src/features/legal/business-truth-registry.ts`.

Tracks how public marketing claims map to canonical sources. **No JSON schema or structured-data publication.**

## Canonical source modules

| Module | Role |
| --- | --- |
| `src/features/public-site/home-r4/claims.ts` | Owner-approved numeric and boolean claims (`HOME_CLAIMS`, `HOME_CLAIM_COPY`) |
| `src/features/public-site/home-r4/reviews.ts` | Review display mode (`HOME_REVIEW_MODE`) — aggregate only |
| `src/features/public-site/home-r4/budget-config.ts` | Indicative estimator ranges (not quotations) |
| `src/features/public-site/home-r4/project-proof.ts` | Homepage featured project proof mode (`HOME_PROJECT_PROOF_MODE`) |

## Registered claims

Each `BusinessTruthEntry` records:

- `claimId`, `sourceModule`, `displayCopy`, `displayLocations`
- `ownerApprovalDisplayCopy: true` (display copy owner-approved; evidence URLs pending)
- `publicEvidenceStatus: "pending"`
- `legalTermsStatus: "pending"`
- **`structuredDataPermission: false`** for every entry
- **`namedReviewPermission: false`** for every entry

Claims tracked: projects delivered, average rating, client reviews, warranty years, client satisfaction, custom designs, own manufacturing unit, free design consultation.

## Hard rules (registry notes)

- Free Design Consultation does **not** mean the website books or submits a consultation.
- Pricing and estimator outputs are indicative planning guidance, not quotations.
- No `aggregateRating`, `Review` or `Warranty` schema.org until evidence URLs and legal terms exist.
- No named testimonials; review mode is aggregate-only.
- No fake factory address or unverified business location.

## Structured data

`allClaimsUseStructuredDataDenied()` must remain `true`. No schema publication permitted in Phase 3A1.
