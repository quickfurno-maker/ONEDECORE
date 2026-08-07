/**
 * Handover and completion acknowledgement contracts — no live client routes.
 */

import type { ExecutionMainPathState } from "../contracts/execution-states.ts";
import { canTransitionExecutionState } from "./execution-state-machine.ts";
import type { SnagSummaryView } from "./snag-contract.ts";

export interface HandoverChecklistItem {
  readonly itemId: string;
  readonly label: string;
  readonly required: boolean;
  readonly completed: boolean;
  readonly evidenceRef: string | null;
}

export interface HandoverAcknowledgementContract {
  readonly acknowledgementRef: string;
  readonly capturedAt: string;
  readonly capturedByProfileId: string;
  readonly note: string | null;
  readonly checklist: readonly HandoverChecklistItem[];
}

export interface CompletionAcknowledgementContract {
  readonly acknowledgementRef: string;
  readonly capturedAt: string;
  readonly capturedByProfileId: string;
  readonly note: string | null;
  readonly snagSummary: SnagSummaryView;
}

export function validateHandoverAcknowledgement(
  contract: HandoverAcknowledgementContract
): string | null {
  if (!contract.acknowledgementRef.trim()) {
    return "Handover acknowledgement reference is required.";
  }
  const requiredIncomplete = contract.checklist.filter(
    (item) => item.required && !item.completed
  );
  if (requiredIncomplete.length > 0) {
    return "All required handover checklist items must be completed.";
  }
  const missingEvidence = contract.checklist.filter(
    (item) => item.required && item.completed && !item.evidenceRef?.trim()
  );
  if (missingEvidence.length > 0) {
    return "Required handover items require evidence references.";
  }
  return null;
}

export function validateCompletionAcknowledgement(
  contract: CompletionAcknowledgementContract
): string | null {
  if (!contract.acknowledgementRef.trim()) {
    return "Completion acknowledgement reference is required.";
  }
  if (contract.snagSummary.blockingHandover) {
    return "Open snags block completion acknowledgement.";
  }
  return null;
}

export function canTransitionToHandover(
  fromState: ExecutionMainPathState,
  snagSummary: SnagSummaryView,
  evidenceRefs: readonly string[]
): { allowed: boolean; message: string | null } {
  const transition = canTransitionExecutionState(fromState, "handover", {
    evidenceRefs,
  });
  if (!transition.allowed) {
    return { allowed: false, message: transition.error?.message ?? "Invalid transition." };
  }
  if (snagSummary.blockingHandover) {
    return { allowed: false, message: "Resolve open snags before handover." };
  }
  return { allowed: true, message: null };
}

export function canTransitionToCompleted(
  fromState: ExecutionMainPathState,
  acknowledgement: CompletionAcknowledgementContract,
  evidenceRefs: readonly string[]
): { allowed: boolean; message: string | null } {
  const ackError = validateCompletionAcknowledgement(acknowledgement);
  if (ackError) {
    return { allowed: false, message: ackError };
  }
  const transition = canTransitionExecutionState(fromState, "completed", {
    evidenceRefs,
  });
  if (!transition.allowed) {
    return { allowed: false, message: transition.error?.message ?? "Invalid transition." };
  }
  return { allowed: true, message: null };
}

export const DEFAULT_HANDOVER_CHECKLIST: readonly HandoverChecklistItem[] = [
  {
    itemId: "site-walkthrough",
    label: "Final site walkthrough completed",
    required: true,
    completed: false,
    evidenceRef: null,
  },
  {
    itemId: "client-signoff",
    label: "Client handover acknowledgement captured",
    required: true,
    completed: false,
    evidenceRef: null,
  },
  {
    itemId: "warranty-pack",
    label: "Warranty and care pack shared (contract-only)",
    required: false,
    completed: false,
    evidenceRef: null,
  },
];
