/**
 * Kriti assist panel UI state — human-controlled, no auto-send.
 */

import type { KritiError } from "../contracts/errors.ts";
import type { KritiResult } from "../contracts/result.ts";
import type { KritiTaskType } from "../contracts/task-types.ts";

export type KritiPanelStatus =
  | "disabled"
  | "idle"
  | "loading"
  | "success"
  | "warning"
  | "failure"
  | "rate_limited"
  | "invalid_output";

export interface KritiPanelState {
  readonly status: KritiPanelStatus;
  readonly selectedTask: KritiTaskType | null;
  readonly result: KritiResult | null;
  readonly error: KritiError | null;
}

export const INITIAL_KRITI_PANEL_STATE: KritiPanelState = {
  status: "disabled",
  selectedTask: null,
  result: null,
  error: null,
};

export function deriveKritiPanelStatus(input: {
  readonly providerDisabled: boolean;
  readonly loading: boolean;
  readonly result: KritiResult | null;
}): KritiPanelStatus {
  if (input.providerDisabled) return "disabled";
  if (input.loading) return "loading";
  if (!input.result) return "idle";
  if (input.result.ok) return "success";
  switch (input.result.error.code) {
    case "KRITI_RATE_LIMITED":
      return "rate_limited";
    case "KRITI_INVALID_OUTPUT":
      return "invalid_output";
    case "KRITI_SAFETY_REFUSAL":
      return "warning";
    default:
      return "failure";
  }
}
