/**
 * Phase 8 migration-independent — project reference contracts (ADR-0020).
 */

const PROJECT_REFERENCE_PATTERN = /^OD-P-[A-Z0-9-]{6,40}$/;

export interface ProjectRef {
  readonly projectReference: string;
  readonly leadReference: string;
  readonly acceptedQuotationReference: string;
  readonly acceptedRevisionNumber: number;
}

export function validateProjectReference(value: string): string | null {
  const trimmed = value.trim();
  if (trimmed.length < 10) {
    return "Project reference must be at least 10 characters.";
  }
  if (!PROJECT_REFERENCE_PATTERN.test(trimmed)) {
    return "Project reference must match OD-P-* pattern.";
  }
  return null;
}

export function createProjectRef(input: ProjectRef): ProjectRef {
  const referenceError = validateProjectReference(input.projectReference);
  if (referenceError) {
    throw new Error(referenceError);
  }
  if (input.acceptedRevisionNumber < 1 || input.acceptedRevisionNumber > 9999) {
    throw new Error("Accepted revision number must be between 1 and 9999.");
  }
  return input;
}
