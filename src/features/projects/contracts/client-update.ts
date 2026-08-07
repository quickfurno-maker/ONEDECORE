/**
 * Phase 8 migration-independent — client update draft contracts.
 * Kriti may assist with wording only; no mutation.
 */

export interface ProjectClientUpdateDraft {
  readonly draftText: string;
  readonly factsUsed: readonly string[];
  readonly missingFacts: readonly string[];
  readonly warnings: readonly string[];
  readonly humanReviewRequired: true;
}

export function validateProjectClientUpdateDraft(
  draft: ProjectClientUpdateDraft
): string | null {
  if (!draft.draftText.trim()) {
    return "Client update draft text is required.";
  }
  if (draft.humanReviewRequired !== true) {
    return "Human review is required for client updates.";
  }
  return null;
}
