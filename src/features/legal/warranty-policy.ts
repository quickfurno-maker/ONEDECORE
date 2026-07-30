/**
 * Phase 3A1 — warranty policy draft content.
 * Marketing claim references HOME_CLAIMS; detailed category terms are not yet effective.
 */

import { HOME_CLAIMS } from "../public-site/home-r4/claims.ts";
import {
  allWarrantyPeriodsPending,
  WARRANTY_CATEGORIES,
  WARRANTY_MATRIX_STATUS,
  type WarrantyCategoryEntry,
} from "./warranty-matrix.ts";

export type WarrantyPolicyStatus =
  | "scope-pending-owner-approval"
  | "owner-approved"
  | "published";

export const WARRANTY_POLICY_STATUS: WarrantyPolicyStatus =
  "scope-pending-owner-approval";

export const WARRANTY_MARKETING_CLAIM_YEARS = HOME_CLAIMS.warrantyYears;

export const WARRANTY_MARKETING_CLAIM_LABEL = `${WARRANTY_MARKETING_CLAIM_YEARS}-Year Warranty`;

export const WARRANTY_DRAFT_NOTICE =
  "This warranty page is a draft for owner and Indian legal counsel review. Detailed category coverage, periods, exclusions and claim procedures are not yet effective." as const;

export const WARRANTY_NOT_EFFECTIVE_STATEMENT =
  "The marketing reference to a warranty period on the public website does not mean every component or service category receives the same duration or coverage. Category-specific terms remain pending owner approval." as const;

export interface WarrantyPolicyMeta {
  readonly status: WarrantyPolicyStatus;
  readonly marketingClaimYears: number;
  readonly marketingClaimLabel: string;
  readonly matrixStatus: typeof WARRANTY_MATRIX_STATUS;
  readonly categories: readonly WarrantyCategoryEntry[];
  readonly detailedCoverageEffective: false;
  readonly schemaPermitted: false;
}

export const WARRANTY_POLICY_META: WarrantyPolicyMeta = {
  status: WARRANTY_POLICY_STATUS,
  marketingClaimYears: WARRANTY_MARKETING_CLAIM_YEARS,
  marketingClaimLabel: WARRANTY_MARKETING_CLAIM_LABEL,
  matrixStatus: WARRANTY_MATRIX_STATUS,
  categories: WARRANTY_CATEGORIES,
  detailedCoverageEffective: false,
  schemaPermitted: false,
} as const;

export const WARRANTY_POLICY_SECTIONS: readonly {
  readonly id: string;
  readonly title: string;
  readonly body: readonly string[];
}[] = [
  {
    id: "draft-status",
    title: "Draft status",
    body: [
      WARRANTY_DRAFT_NOTICE,
      "No Warranty schema.org structured data is published.",
    ],
  },
  {
    id: "marketing-claim",
    title: "Marketing reference",
    body: [
      `The public website currently displays a marketing reference of "${WARRANTY_MARKETING_CLAIM_LABEL}" derived from owner-approved homepage claims.`,
      WARRANTY_NOT_EFFECTIVE_STATEMENT,
    ],
  },
  {
    id: "category-matrix",
    title: "Category matrix (pending)",
    body: [
      `All ${WARRANTY_CATEGORIES.length} warranty categories have null proposed and owner-approved periods.`,
      `Matrix status: ${WARRANTY_MATRIX_STATUS}.`,
      allWarrantyPeriodsPending()
        ? "Confirmed: no category-specific warranty period has been approved."
        : "Review required: unexpected approved periods detected.",
    ],
  },
  {
    id: "claim-procedure",
    title: "Claims procedure",
    body: [
      "Warranty claim contact route: pending owner input.",
      "Claim evidence requirements: pending owner approval per category.",
      "No warranty claim submission endpoint is live on the current website.",
    ],
  },
  {
    id: "legal-review",
    title: "Legal review",
    body: [
      "Final warranty terms require owner approval and qualified Indian legal-counsel review before publication.",
      "Do not treat this draft as a contractual warranty until explicitly published in effective mode.",
    ],
  },
] as const;
