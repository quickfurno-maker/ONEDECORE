/**
 * Phase 3A1 — warranty category matrix.
 * All detailed periods and approved coverage remain pending owner and legal review.
 */

export type WarrantyCategoryStatus =
  | "scope-pending-owner-approval"
  | "owner-approved"
  | "legal-review-pending";

export type WarrantyCategoryId =
  | "modular-carcass"
  | "shutters-fronts"
  | "edge-banding"
  | "hardware"
  | "accessories"
  | "countertops"
  | "glass"
  | "electrical-plumbing"
  | "appliances"
  | "civil-work"
  | "painting-polish"
  | "installation-workmanship"
  | "moisture-water"
  | "termites-pests"
  | "misuse"
  | "unauthorised-alteration"
  | "wear-and-tear"
  | "manufacturer-products"
  | "relocation";

export interface WarrantyCategoryEntry {
  readonly category: WarrantyCategoryId;
  readonly label: string;
  readonly proposedPeriod: string | null;
  readonly ownerApprovedPeriod: string | null;
  readonly coverage: string;
  readonly exclusions: string;
  readonly evidence: string;
  readonly claimProcedure: string;
  readonly manufacturerBacked: boolean;
  readonly onedecoreBacked: boolean;
  readonly status: WarrantyCategoryStatus;
  readonly ownerNotes: string | null;
  readonly legalNotes: string | null;
}

export const WARRANTY_MATRIX_STATUS: WarrantyCategoryStatus =
  "scope-pending-owner-approval";

export const WARRANTY_CATEGORIES: readonly WarrantyCategoryEntry[] = [
  {
    category: "modular-carcass",
    label: "Modular carcass",
    proposedPeriod: null,
    ownerApprovedPeriod: null,
    coverage: "Pending owner-approved scope definition for modular carcass components.",
    exclusions: "Pending owner-approved exclusions.",
    evidence: "Pending owner-approved evidence requirements.",
    claimProcedure: "Pending owner-approved claim procedure.",
    manufacturerBacked: false,
    onedecoreBacked: false,
    status: WARRANTY_MATRIX_STATUS,
    ownerNotes: null,
    legalNotes: null,
  },
  {
    category: "shutters-fronts",
    label: "Shutters / fronts",
    proposedPeriod: null,
    ownerApprovedPeriod: null,
    coverage: "Pending owner-approved scope definition for shutters and front panels.",
    exclusions: "Pending owner-approved exclusions.",
    evidence: "Pending owner-approved evidence requirements.",
    claimProcedure: "Pending owner-approved claim procedure.",
    manufacturerBacked: false,
    onedecoreBacked: false,
    status: WARRANTY_MATRIX_STATUS,
    ownerNotes: null,
    legalNotes: null,
  },
  {
    category: "edge-banding",
    label: "Edge banding",
    proposedPeriod: null,
    ownerApprovedPeriod: null,
    coverage: "Pending owner-approved scope definition for edge banding.",
    exclusions: "Pending owner-approved exclusions.",
    evidence: "Pending owner-approved evidence requirements.",
    claimProcedure: "Pending owner-approved claim procedure.",
    manufacturerBacked: false,
    onedecoreBacked: false,
    status: WARRANTY_MATRIX_STATUS,
    ownerNotes: null,
    legalNotes: null,
  },
  {
    category: "hardware",
    label: "Hardware",
    proposedPeriod: null,
    ownerApprovedPeriod: null,
    coverage: "Pending owner-approved scope definition for hinges, channels, handles and fittings.",
    exclusions: "Pending owner-approved exclusions.",
    evidence: "Pending owner-approved evidence requirements.",
    claimProcedure: "Pending owner-approved claim procedure.",
    manufacturerBacked: false,
    onedecoreBacked: false,
    status: WARRANTY_MATRIX_STATUS,
    ownerNotes: null,
    legalNotes: null,
  },
  {
    category: "accessories",
    label: "Accessories",
    proposedPeriod: null,
    ownerApprovedPeriod: null,
    coverage: "Pending owner-approved scope definition for internal accessories and organisers.",
    exclusions: "Pending owner-approved exclusions.",
    evidence: "Pending owner-approved evidence requirements.",
    claimProcedure: "Pending owner-approved claim procedure.",
    manufacturerBacked: false,
    onedecoreBacked: false,
    status: WARRANTY_MATRIX_STATUS,
    ownerNotes: null,
    legalNotes: null,
  },
  {
    category: "countertops",
    label: "Countertops",
    proposedPeriod: null,
    ownerApprovedPeriod: null,
    coverage: "Pending owner-approved scope definition for countertop materials and installation.",
    exclusions: "Pending owner-approved exclusions.",
    evidence: "Pending owner-approved evidence requirements.",
    claimProcedure: "Pending owner-approved claim procedure.",
    manufacturerBacked: false,
    onedecoreBacked: false,
    status: WARRANTY_MATRIX_STATUS,
    ownerNotes: null,
    legalNotes: null,
  },
  {
    category: "glass",
    label: "Glass",
    proposedPeriod: null,
    ownerApprovedPeriod: null,
    coverage: "Pending owner-approved scope definition for glass elements.",
    exclusions: "Pending owner-approved exclusions.",
    evidence: "Pending owner-approved evidence requirements.",
    claimProcedure: "Pending owner-approved claim procedure.",
    manufacturerBacked: false,
    onedecoreBacked: false,
    status: WARRANTY_MATRIX_STATUS,
    ownerNotes: null,
    legalNotes: null,
  },
  {
    category: "electrical-plumbing",
    label: "Electrical / plumbing",
    proposedPeriod: null,
    ownerApprovedPeriod: null,
    coverage: "Pending owner-approved scope definition for coordinated electrical and plumbing work.",
    exclusions: "Pending owner-approved exclusions.",
    evidence: "Pending owner-approved evidence requirements.",
    claimProcedure: "Pending owner-approved claim procedure.",
    manufacturerBacked: false,
    onedecoreBacked: false,
    status: WARRANTY_MATRIX_STATUS,
    ownerNotes: null,
    legalNotes: null,
  },
  {
    category: "appliances",
    label: "Appliances",
    proposedPeriod: null,
    ownerApprovedPeriod: null,
    coverage: "Pending owner-approved scope definition for supplied or integrated appliances.",
    exclusions: "Pending owner-approved exclusions; manufacturer warranty may apply separately.",
    evidence: "Pending owner-approved evidence requirements.",
    claimProcedure: "Pending owner-approved claim procedure.",
    manufacturerBacked: true,
    onedecoreBacked: false,
    status: WARRANTY_MATRIX_STATUS,
    ownerNotes: null,
    legalNotes: null,
  },
  {
    category: "civil-work",
    label: "Civil work",
    proposedPeriod: null,
    ownerApprovedPeriod: null,
    coverage: "Pending owner-approved scope definition for civil and structural coordination.",
    exclusions: "Pending owner-approved exclusions.",
    evidence: "Pending owner-approved evidence requirements.",
    claimProcedure: "Pending owner-approved claim procedure.",
    manufacturerBacked: false,
    onedecoreBacked: false,
    status: WARRANTY_MATRIX_STATUS,
    ownerNotes: null,
    legalNotes: null,
  },
  {
    category: "painting-polish",
    label: "Painting / polish",
    proposedPeriod: null,
    ownerApprovedPeriod: null,
    coverage: "Pending owner-approved scope definition for painting, polish and surface finishes.",
    exclusions: "Pending owner-approved exclusions.",
    evidence: "Pending owner-approved evidence requirements.",
    claimProcedure: "Pending owner-approved claim procedure.",
    manufacturerBacked: false,
    onedecoreBacked: false,
    status: WARRANTY_MATRIX_STATUS,
    ownerNotes: null,
    legalNotes: null,
  },
  {
    category: "installation-workmanship",
    label: "Installation workmanship",
    proposedPeriod: null,
    ownerApprovedPeriod: null,
    coverage: "Pending owner-approved scope definition for installation quality and workmanship.",
    exclusions: "Pending owner-approved exclusions.",
    evidence: "Pending owner-approved evidence requirements.",
    claimProcedure: "Pending owner-approved claim procedure.",
    manufacturerBacked: false,
    onedecoreBacked: false,
    status: WARRANTY_MATRIX_STATUS,
    ownerNotes: null,
    legalNotes: null,
  },
  {
    category: "moisture-water",
    label: "Moisture / water damage",
    proposedPeriod: null,
    ownerApprovedPeriod: null,
    coverage: "Pending owner-approved scope definition for moisture and water-related defects.",
    exclusions: "Pending owner-approved exclusions; misuse and maintenance exclusions likely.",
    evidence: "Pending owner-approved evidence requirements.",
    claimProcedure: "Pending owner-approved claim procedure.",
    manufacturerBacked: false,
    onedecoreBacked: false,
    status: WARRANTY_MATRIX_STATUS,
    ownerNotes: null,
    legalNotes: null,
  },
  {
    category: "termites-pests",
    label: "Termites / pests",
    proposedPeriod: null,
    ownerApprovedPeriod: null,
    coverage: "Pending owner-approved scope definition for termite and pest-related coverage.",
    exclusions: "Pending owner-approved exclusions.",
    evidence: "Pending owner-approved evidence requirements.",
    claimProcedure: "Pending owner-approved claim procedure.",
    manufacturerBacked: false,
    onedecoreBacked: false,
    status: WARRANTY_MATRIX_STATUS,
    ownerNotes: null,
    legalNotes: null,
  },
  {
    category: "misuse",
    label: "Misuse",
    proposedPeriod: null,
    ownerApprovedPeriod: null,
    coverage: "Not covered — category documents misuse exclusions pending owner approval.",
    exclusions: "Damage arising from misuse, neglect or improper use — pending owner-approved wording.",
    evidence: "Not applicable.",
    claimProcedure: "Not applicable.",
    manufacturerBacked: false,
    onedecoreBacked: false,
    status: WARRANTY_MATRIX_STATUS,
    ownerNotes: null,
    legalNotes: null,
  },
  {
    category: "unauthorised-alteration",
    label: "Unauthorised alteration",
    proposedPeriod: null,
    ownerApprovedPeriod: null,
    coverage: "Not covered — category documents unauthorised alteration exclusions pending owner approval.",
    exclusions: "Damage or defects following unauthorised modification — pending owner-approved wording.",
    evidence: "Not applicable.",
    claimProcedure: "Not applicable.",
    manufacturerBacked: false,
    onedecoreBacked: false,
    status: WARRANTY_MATRIX_STATUS,
    ownerNotes: null,
    legalNotes: null,
  },
  {
    category: "wear-and-tear",
    label: "Wear and tear",
    proposedPeriod: null,
    ownerApprovedPeriod: null,
    coverage: "Not covered — normal wear and tear exclusions pending owner approval.",
    exclusions: "Normal wear, fading and cosmetic ageing — pending owner-approved wording.",
    evidence: "Not applicable.",
    claimProcedure: "Not applicable.",
    manufacturerBacked: false,
    onedecoreBacked: false,
    status: WARRANTY_MATRIX_STATUS,
    ownerNotes: null,
    legalNotes: null,
  },
  {
    category: "manufacturer-products",
    label: "Manufacturer products",
    proposedPeriod: null,
    ownerApprovedPeriod: null,
    coverage: "Pending owner-approved scope for third-party manufacturer-backed products.",
    exclusions: "Manufacturer terms may apply; pending owner-approved coordination wording.",
    evidence: "Pending owner-approved evidence requirements.",
    claimProcedure: "Pending owner-approved claim procedure.",
    manufacturerBacked: true,
    onedecoreBacked: false,
    status: WARRANTY_MATRIX_STATUS,
    ownerNotes: null,
    legalNotes: null,
  },
  {
    category: "relocation",
    label: "Relocation",
    proposedPeriod: null,
    ownerApprovedPeriod: null,
    coverage: "Pending owner-approved scope definition for relocation-related coverage, if any.",
    exclusions: "Pending owner-approved exclusions.",
    evidence: "Pending owner-approved evidence requirements.",
    claimProcedure: "Pending owner-approved claim procedure.",
    manufacturerBacked: false,
    onedecoreBacked: false,
    status: WARRANTY_MATRIX_STATUS,
    ownerNotes: null,
    legalNotes: null,
  },
] as const;

export function allWarrantyPeriodsPending(
  entries: readonly WarrantyCategoryEntry[] = WARRANTY_CATEGORIES
): boolean {
  return entries.every(
    (entry) =>
      entry.proposedPeriod == null && entry.ownerApprovedPeriod == null
  );
}
