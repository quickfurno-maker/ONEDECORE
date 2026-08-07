/**
 * Phase 8 migration-independent — evidence metadata contracts (no storage).
 */

export const PROJECT_EVIDENCE_TYPES = [
  "handover_summary",
  "client_approval",
  "design_deliverable",
  "production_ready",
  "stage_transition",
  "hold_reason",
  "cancellation_reason",
  "snag_resolution",
  "handover_acknowledgement",
  "completion_acknowledgement",
] as const;

export type ProjectEvidenceType = (typeof PROJECT_EVIDENCE_TYPES)[number];

export interface ProjectEvidenceRef {
  readonly evidenceRef: string;
  readonly evidenceType: ProjectEvidenceType;
  readonly version: number;
  readonly capturedAt: string;
  readonly capturedByProfileId: string;
  readonly note: string | null;
  readonly supersedesEvidenceRef: string | null;
}

export function validateProjectEvidenceRef(
  evidence: ProjectEvidenceRef
): string | null {
  if (!evidence.evidenceRef.trim()) {
    return "Evidence reference is required.";
  }
  if (evidence.version < 1) {
    return "Evidence version must be at least 1.";
  }
  if (evidence.note && evidence.note.length > 2000) {
    return "Evidence note exceeds maximum length.";
  }
  return null;
}
