/**
 * Phase 8 migration-independent — commercial snapshot view boundary (Phase 7).
 * Never recalculates quotation amounts.
 */

export interface ProjectCommercialSnapshotView {
  readonly quotationReference: string;
  readonly revisionNumber: number;
  readonly acceptedAt: string;
  readonly currency: "INR";
  readonly taxableBasePaise: number;
  readonly grandTotalPaise: number;
  readonly grandTotalLabel: string;
  readonly scopeSummary: string | null;
  readonly contentHash: string;
}

export interface ProjectValueReconciliationContract {
  readonly usesAcceptedQuotationAchievement: boolean;
  readonly optionalProjectValuePaise: number | null;
  readonly preventsDoubleCounting: true;
}

export const PROJECT_COMMERCIAL_BOUNDARY_RULE =
  "Commercial snapshot is read-only. Never recalculate GST, discount, taxable base, or grand total in Phase 8 prebuild.";
