/**
 * Execution hold / delay contract — no scheduling or ERP automation.
 */

import type { ExecutionMainPathState, ExecutionState } from "../contracts/execution-states.ts";
import { isExecutionMainPathState, isTerminalExecutionState } from "../contracts/execution-states.ts";
import { canTransitionExecutionState } from "./execution-state-machine.ts";

export const EXECUTION_HOLD_REASON_CODES = [
  "client_decision_pending",
  "site_access_blocked",
  "material_delay",
  "weather",
  "internal_capacity",
  "other",
] as const;

export type ExecutionHoldReasonCode = (typeof EXECUTION_HOLD_REASON_CODES)[number];

export interface ExecutionHoldRecord {
  readonly holdId: string;
  readonly reasonCode: ExecutionHoldReasonCode;
  readonly humanNote: string;
  readonly enteredFromState: ExecutionMainPathState;
  readonly resumeTarget: ExecutionMainPathState;
  readonly enteredAt: string;
  readonly enteredByProfileId: string;
  readonly actorCanUpdateExecution: boolean;
}

export function validateExecutionHoldRecord(record: ExecutionHoldRecord): string | null {
  if (!record.holdId.trim()) {
    return "Hold id is required.";
  }
  const holdNote = record.humanNote.trim();
  if (holdNote.length < 10 || holdNote.length > 1000) {
    return "Hold note must be between 10 and 1000 characters.";
  }
  if (record.enteredFromState !== record.resumeTarget) {
    return "Resume target must match the state entered from.";
  }
  if (!isExecutionMainPathState(record.enteredFromState)) {
    return "Hold may only be entered from an active main-path state.";
  }
  if (isTerminalExecutionState(record.enteredFromState)) {
    return "Terminal execution states cannot enter hold.";
  }
  if (!record.actorCanUpdateExecution) {
    return "Actor lacks execution update authority for hold.";
  }

  const transition = canTransitionExecutionState(record.enteredFromState, "on_hold", {
    reason: record.humanNote,
  });
  if (!transition.allowed) {
    return transition.error?.message ?? "Invalid hold transition.";
  }

  return null;
}

export function buildExecutionHoldRecord(input: {
  readonly holdId: string;
  readonly reasonCode: ExecutionHoldReasonCode;
  readonly humanNote: string;
  readonly enteredFromState: ExecutionMainPathState;
  readonly enteredAt: string;
  readonly enteredByProfileId: string;
  readonly actorCanUpdateExecution: boolean;
}): ExecutionHoldRecord {
  return {
    ...input,
    resumeTarget: input.enteredFromState,
  };
}

export function canResumeExecutionHold(
  currentState: ExecutionState,
  record: ExecutionHoldRecord
): boolean {
  if (currentState !== "on_hold") {
    return false;
  }
  const transition = canTransitionExecutionState("on_hold", record.resumeTarget, {
    resumeTarget: record.resumeTarget,
  });
  return transition.allowed;
}
