import {
  getAllowedLeadTransitions,
  isLeadTransitionAllowed,
  isTerminalLeadStage,
  LEAD_STAGE_CODES,
  PHASE_5B_BLOCKED_TARGET_STAGES,
  type LeadStageCode,
} from "./lead-stages.ts";

export interface LifecycleFieldError {
  readonly field: string;
  readonly message: string;
}

export interface LifecycleActionState {
  readonly success: boolean;
  readonly message: string;
  readonly code?: string;
  readonly fieldErrors?: Readonly<Record<string, string>>;
}

export interface LeadStatusTransitionInput {
  readonly leadId: string;
  readonly newStatus: LeadStageCode;
  readonly reason?: string | null;
  readonly closureReasonCode?: string | null;
}

export interface LeadNoteInput {
  readonly leadId: string;
  readonly body: string;
}

export interface LeadFollowUpCreateInput {
  readonly leadId: string;
  readonly dueAt: string;
  readonly ownerId?: string | null;
}

export interface LeadFollowUpOutcomeInput {
  readonly followUpId: string;
  readonly outcome?: string | null;
}

export interface CrmLeadClosureReasonOption {
  readonly code: string;
  readonly displayName: string;
}

const NOTE_MIN = 1;
const NOTE_MAX = 4000;
const ON_HOLD_REASON_MIN = 3;
const ON_HOLD_REASON_MAX = 500;
const CLOSED_LOST_NOTE_MIN = 3;
const CLOSED_LOST_NOTE_MAX = 1000;
const FOLLOW_UP_OUTCOME_MAX = 1000;

function isLeadStageCode(value: string): value is LeadStageCode {
  return (LEAD_STAGE_CODES as readonly string[]).includes(value);
}

function fieldErrorsToRecord(
  errors: readonly LifecycleFieldError[]
): Record<string, string> {
  return Object.fromEntries(errors.map((entry) => [entry.field, entry.message]));
}

export function resolveOnHoldResumeStage(
  previousStatus: string | null | undefined,
  assignedTo: string | null | undefined
): LeadStageCode | null {
  if (!previousStatus || !isLeadStageCode(previousStatus)) {
    return null;
  }

  if (previousStatus === "new" || previousStatus === "assigned") {
    return assignedTo ? "assigned" : "new";
  }

  return previousStatus;
}

export function validateLeadStatusTransitionInput(
  input: LeadStatusTransitionInput,
  currentStatus: LeadStageCode
): readonly LifecycleFieldError[] {
  const errors: LifecycleFieldError[] = [];
  const leadId = input.leadId.trim();

  if (!leadId) {
    errors.push({ field: "leadId", message: "Lead is required." });
  }

  if (!isLeadStageCode(input.newStatus)) {
    errors.push({ field: "newStatus", message: "Invalid status." });
    return errors;
  }

  if ((PHASE_5B_BLOCKED_TARGET_STAGES as readonly string[]).includes(input.newStatus)) {
    errors.push({
      field: "newStatus",
      message: "This status cannot be selected directly.",
    });
  }

  if (input.newStatus === "closed_won") {
    errors.push({
      field: "newStatus",
      message: "Closed-Won requires quotation acceptance (Phase 7B).",
    });
  }

  if (isTerminalLeadStage(currentStatus)) {
    errors.push({
      field: "newStatus",
      message: "Terminal leads cannot be transitioned.",
    });
    return errors;
  }

  if (currentStatus === "on_hold") {
    return errors;
  }

  if (input.newStatus === "on_hold") {
    const reason = (input.reason ?? "").trim();
    if (reason.length < ON_HOLD_REASON_MIN || reason.length > ON_HOLD_REASON_MAX) {
      errors.push({
        field: "reason",
        message: `On-hold reason must be ${ON_HOLD_REASON_MIN}–${ON_HOLD_REASON_MAX} characters.`,
      });
    }
    return errors;
  }

  if (input.newStatus === "closed_lost") {
    const note = (input.reason ?? "").trim();
    if (note.length < CLOSED_LOST_NOTE_MIN || note.length > CLOSED_LOST_NOTE_MAX) {
      errors.push({
        field: "reason",
        message: `Closure note must be ${CLOSED_LOST_NOTE_MIN}–${CLOSED_LOST_NOTE_MAX} characters.`,
      });
    }
    const code = (input.closureReasonCode ?? "").trim();
    if (!code) {
      errors.push({
        field: "closureReasonCode",
        message: "Closure reason is required.",
      });
    }
    return errors;
  }

  if (!isLeadTransitionAllowed(currentStatus, input.newStatus)) {
    errors.push({
      field: "newStatus",
      message: "Invalid lead status transition.",
    });
  }

  return errors;
}

export function validateLeadNoteInput(input: LeadNoteInput): readonly LifecycleFieldError[] {
  const errors: LifecycleFieldError[] = [];
  const body = input.body.trim();

  if (!input.leadId.trim()) {
    errors.push({ field: "leadId", message: "Lead is required." });
  }

  if (body.length < NOTE_MIN || body.length > NOTE_MAX) {
    errors.push({
      field: "body",
      message: `Note must be ${NOTE_MIN}–${NOTE_MAX} characters.`,
    });
  }

  return errors;
}

export function validateLeadFollowUpCreateInput(
  input: LeadFollowUpCreateInput
): readonly LifecycleFieldError[] {
  const errors: LifecycleFieldError[] = [];

  if (!input.leadId.trim()) {
    errors.push({ field: "leadId", message: "Lead is required." });
  }

  const dueAt = new Date(input.dueAt);
  if (Number.isNaN(dueAt.getTime())) {
    errors.push({ field: "dueAt", message: "Due date and time are invalid." });
    return errors;
  }

  if (dueAt.getTime() <= Date.now()) {
    errors.push({
      field: "dueAt",
      message: "Follow-up due time must be in the future.",
    });
  }

  return errors;
}

export function normalizeFollowUpOutcome(
  outcome: string | null | undefined
): string | null {
  if (outcome == null) {
    return null;
  }
  const trimmed = outcome.trim();
  if (trimmed.length === 0) {
    return null;
  }
  return trimmed.slice(0, FOLLOW_UP_OUTCOME_MAX);
}

export function validateFollowUpOutcomeInput(
  input: LeadFollowUpOutcomeInput
): readonly LifecycleFieldError[] {
  const errors: LifecycleFieldError[] = [];

  if (!input.followUpId.trim()) {
    errors.push({ field: "followUpId", message: "Follow-up is required." });
  }

  const outcome = input.outcome?.trim() ?? "";
  if (outcome.length > FOLLOW_UP_OUTCOME_MAX) {
    errors.push({
      field: "outcome",
      message: `Outcome must be at most ${FOLLOW_UP_OUTCOME_MAX} characters.`,
    });
  }

  return errors;
}

export function lifecycleFieldErrorsToRecord(
  errors: readonly LifecycleFieldError[]
): Record<string, string> {
  return fieldErrorsToRecord(errors);
}

export function getForwardTransitionOptions(
  currentStatus: LeadStageCode
): readonly LeadStageCode[] {
  return getAllowedLeadTransitions(currentStatus).filter(
    (status) =>
      status !== "on_hold" &&
      status !== "closed_lost" &&
      !(PHASE_5B_BLOCKED_TARGET_STAGES as readonly string[]).includes(status)
  );
}
