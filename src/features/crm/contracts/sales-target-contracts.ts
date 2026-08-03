/**
 * Phase 5E-B — sales target configuration contracts.
 * Targets store configuration only; commercial achievement is Phase 7B gated.
 */

export const SALES_TARGET_SCOPES = ["executive_personal", "sales_team"] as const;
export type SalesTargetScope = (typeof SALES_TARGET_SCOPES)[number];

export const SALES_TARGET_STATUSES = ["open", "locked"] as const;
export type SalesTargetStatus = (typeof SALES_TARGET_STATUSES)[number];

export const SALES_TARGET_EVENT_TYPES = [
  "target.created",
  "target.revised",
  "target.locked",
  "target.reopened",
] as const;
export type SalesTargetEventType = (typeof SALES_TARGET_EVENT_TYPES)[number];

export const SALES_TARGET_CURRENCY = "INR" as const;

export const SALES_TARGET_REVENUE_MIN_PAISE = 1;
export const SALES_TARGET_REVENUE_MAX_PAISE = 100_000_000_000;
export const SALES_TARGET_CLOSED_WON_MIN = 1;
export const SALES_TARGET_CLOSED_WON_MAX = 10_000;
export const SALES_TARGET_REASON_MIN = 10;
export const SALES_TARGET_REASON_MAX = 500;

export const ACHIEVEMENT_INACTIVE_COPY =
  "Not activated until quotation acceptance (Phase 7B)";

export interface SalesTargetSummary {
  readonly id: string;
  readonly targetScope: SalesTargetScope;
  readonly targetMonth: string;
  readonly targetUserId: string | null;
  readonly targetDisplayName: string | null;
  readonly revenueTargetPaise: number;
  readonly closedWonCountTarget: number;
  readonly currency: typeof SALES_TARGET_CURRENCY;
  readonly status: SalesTargetStatus;
  readonly revision: number;
  readonly lastReason: string;
  readonly createdAt: string;
  readonly updatedAt: string;
}

export interface SalesTargetEventSummary {
  readonly id: string;
  readonly targetId: string;
  readonly eventType: SalesTargetEventType;
  readonly revision: number;
  readonly actorId: string;
  readonly actorDisplayName: string | null;
  readonly reason: string;
  readonly occurredAt: string;
}

export interface CreateSalesTargetInput {
  readonly targetScope: SalesTargetScope;
  readonly targetMonth: string;
  readonly targetUserId: string | null;
  readonly revenueTargetPaise: number;
  readonly closedWonCountTarget: number;
  readonly reason: string;
}

export interface ReviseSalesTargetInput {
  readonly targetId: string;
  readonly expectedRevision: number;
  readonly revenueTargetPaise: number;
  readonly closedWonCountTarget: number;
  readonly reason: string;
}

export interface LockSalesTargetInput {
  readonly targetId: string;
  readonly expectedRevision: number;
  readonly reason: string;
}

export interface ReopenSalesTargetInput {
  readonly targetId: string;
  readonly expectedRevision: number;
  readonly reason: string;
}

export type SalesTargetActionState =
  | { readonly success: true; readonly message: string }
  | {
      readonly success: false;
      readonly message: string;
      readonly code?: string;
      readonly fieldErrors?: Readonly<Record<string, string>>;
    };

function isScope(value: string): value is SalesTargetScope {
  return (SALES_TARGET_SCOPES as readonly string[]).includes(value);
}

export function validateSalesTargetReason(reason: string): string | null {
  const trimmed = reason.trim();
  if (trimmed.length < SALES_TARGET_REASON_MIN) {
    return `Reason must be at least ${SALES_TARGET_REASON_MIN} characters.`;
  }
  if (trimmed.length > SALES_TARGET_REASON_MAX) {
    return `Reason must be at most ${SALES_TARGET_REASON_MAX} characters.`;
  }
  return null;
}

export function validateTargetMonth(month: string): string | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(month)) {
    return "Target month must be YYYY-MM-DD.";
  }
  const [, , day] = month.split("-").map(Number);
  if (day !== 1) {
    return "Target month must be the first day of the month.";
  }
  return null;
}

export function validateCreateSalesTargetInput(
  input: CreateSalesTargetInput
): Readonly<Record<string, string>> {
  const errors: Record<string, string> = {};
  if (!isScope(input.targetScope)) {
    errors.targetScope = "Invalid target scope.";
  }
  const monthError = validateTargetMonth(input.targetMonth);
  if (monthError) {
    errors.targetMonth = monthError;
  }
  if (input.targetScope === "executive_personal" && !input.targetUserId) {
    errors.targetUserId = "Executive is required for personal targets.";
  }
  if (input.targetScope === "sales_team" && input.targetUserId) {
    errors.targetUserId = "Team targets cannot specify an executive.";
  }
  if (
    input.revenueTargetPaise < SALES_TARGET_REVENUE_MIN_PAISE ||
    input.revenueTargetPaise > SALES_TARGET_REVENUE_MAX_PAISE
  ) {
    errors.revenueTargetPaise = "Revenue target is out of allowed bounds.";
  }
  if (
    input.closedWonCountTarget < SALES_TARGET_CLOSED_WON_MIN ||
    input.closedWonCountTarget > SALES_TARGET_CLOSED_WON_MAX
  ) {
    errors.closedWonCountTarget = "Closed-Won count target is out of allowed bounds.";
  }
  const reasonError = validateSalesTargetReason(input.reason);
  if (reasonError) {
    errors.reason = reasonError;
  }
  return errors;
}

export function formatInrFromPaise(paise: number): string {
  const rupees = paise / 100;
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(rupees);
}

export function parseInrToPaise(input: string): number | null {
  const normalised = input.replace(/[,\s₹]/g, "");
  if (!/^\d+(\.\d{1,2})?$/.test(normalised)) {
    return null;
  }
  const rupees = Number.parseFloat(normalised);
  if (!Number.isFinite(rupees) || rupees <= 0) {
    return null;
  }
  return Math.round(rupees * 100);
}
