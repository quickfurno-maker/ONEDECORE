/**
 * Quotation lifecycle contracts — aligned with docs/07 and ADR-0022 (no internal approval).
 */

export const QUOTATION_LIFECYCLE_STATES = [
  "draft",
  "finalized",
  "sent",
  "viewed",
  "accepted",
  "rejected",
  "revision_requested",
  "expired",
  "superseded",
] as const;

export type QuotationLifecycleState = (typeof QUOTATION_LIFECYCLE_STATES)[number];

export const QUOTATION_TERMINAL_CLIENT_OUTCOMES = [
  "accepted",
  "rejected",
  "expired",
] as const;

export type QuotationTerminalClientOutcome =
  (typeof QUOTATION_TERMINAL_CLIENT_OUTCOMES)[number];

export const QUOTATION_READ_ONLY_STATES = [
  "finalized",
  "sent",
  "viewed",
  "accepted",
  "rejected",
  "revision_requested",
  "expired",
  "superseded",
] as const;

export function isQuotationReadOnlyState(state: QuotationLifecycleState): boolean {
  return (QUOTATION_READ_ONLY_STATES as readonly string[]).includes(state);
}

export function isTerminalClientOutcome(
  state: QuotationLifecycleState
): state is QuotationTerminalClientOutcome {
  return (QUOTATION_TERMINAL_CLIENT_OUTCOMES as readonly string[]).includes(state);
}
