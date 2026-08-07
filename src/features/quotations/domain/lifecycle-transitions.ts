/**
 * Pure lifecycle transition validation (no persistence).
 */

import {
  QUOTATION_LIFECYCLE_STATES,
  type QuotationLifecycleState,
} from "../contracts/lifecycle.ts";

const ALLOWED_TRANSITIONS: Readonly<Record<QuotationLifecycleState, readonly QuotationLifecycleState[]>> = {
  draft: ["finalized"],
  finalized: ["sent", "superseded"],
  sent: ["viewed", "accepted", "rejected", "revision_requested", "expired", "superseded"],
  viewed: ["accepted", "rejected", "revision_requested", "expired", "superseded"],
  revision_requested: ["draft", "superseded"],
  accepted: [],
  rejected: ["draft", "superseded"],
  expired: ["draft", "superseded"],
  superseded: [],
};

export function canTransitionQuotationLifecycle(
  from: QuotationLifecycleState,
  to: QuotationLifecycleState
): boolean {
  if (from === to) {
    return true;
  }
  return (ALLOWED_TRANSITIONS[from] as readonly string[]).includes(to);
}

export function assertQuotationLifecycleState(value: string): QuotationLifecycleState {
  if (!(QUOTATION_LIFECYCLE_STATES as readonly string[]).includes(value)) {
    throw new Error(`Unknown quotation lifecycle state: ${value}`);
  }
  return value as QuotationLifecycleState;
}
