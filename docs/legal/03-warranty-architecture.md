# Warranty architecture — Phase 3A1

Code mirrors: `src/features/legal/warranty-policy.ts`, `src/features/legal/warranty-matrix.ts`.

Public route: `/warranty`

## Marketing reference (homepage)

The public website displays a marketing reference derived from owner-approved homepage claims:

- Source: `HOME_CLAIMS.warrantyYears` in `src/features/public-site/home-r4/claims.ts`
- Legal re-export: `WARRANTY_MARKETING_CLAIM_YEARS` / `WARRANTY_MARKETING_CLAIM_LABEL` in `warranty-policy.ts`
- Current value: **10 years** (marketing label only)

**The marketing reference does not mean every component or service category receives the same duration or coverage.**

## Category matrix — all periods null

`WARRANTY_CATEGORIES` defines 19 categories (modular carcass, shutters, hardware, appliances, civil work, exclusions, etc.).

- Matrix status: `scope-pending-owner-approval`
- `proposedPeriod`: **null** for every category
- `ownerApprovedPeriod`: **null** for every category
- `allWarrantyPeriodsPending()` returns `true`

Detailed coverage, exclusions, evidence requirements and claim procedures remain **scope-pending**.

## Not effective

- No Warranty schema.org structured data
- No warranty claim submission endpoint on the current website
- Warranty claim contact route: pending owner input
- Final terms require owner approval and qualified Indian legal-counsel review before publication in effective mode
