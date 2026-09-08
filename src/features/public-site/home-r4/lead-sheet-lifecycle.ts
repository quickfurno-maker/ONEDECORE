/**
 * The lead sheet's state machine: open, accepted, closed.
 *
 * WHY THIS EXISTS AS A PLAIN MODULE
 *
 * A real enquiry was accepted by the server and the visitor never saw it. The
 * cause was one function doing two jobs: `markSubmitted()` recorded the
 * acceptance AND closed the sheet, and the sheet renders nothing while closed.
 * So the confirmation and the submission reference were created and destroyed
 * in the same tick — the form appeared to simply vanish under the visitor's
 * hands, indistinguishable from a lost lead.
 *
 * Three events were tangled together and are now separate:
 *
 *   A. the backend ACCEPTED a lead      -> `acceptSubmission`
 *   B. the sheet CLOSES                 -> `closeSheet`
 *   C. the finished enquiry is FORGOTTEN
 *
 * C never happens on its own. It happens when a FINISHED enquiry is closed, so
 * that the next CTA opens a blank form instead of one still holding someone
 * else's name, mobile, consent and reference. It must never happen before the
 * confirmation has been seen, which is what `acceptSubmission` guarantees by
 * leaving `open` alone.
 *
 * These are pure functions over a plain value on purpose. The bug lived in a
 * state transition, and a state transition that can only be exercised by
 * clicking through a browser is a state transition nobody tests. Every
 * transition here is asserted directly in
 * `lead-intake/__tests__/lead-success-stays-visible.test.ts`.
 *
 * It lives beside the sheet rather than under `lead-intake/public` because
 * `PlanContext` consumes it, and `PlanContext` is held to a containment rule:
 * exactly one module may reach the intake endpoint, and the planner is not it.
 */

export interface LeadSubmissionOutcome {
  /** The server's reference for the accepted enquiry, when it returned one. */
  readonly reference: string | null;
  /** True when the server recognised an enquiry it already held (HTTP 200). */
  readonly duplicate: boolean;
}

export interface LeadSheetState {
  readonly open: boolean;
  /** True once the backend has accepted a lead in this sheet. */
  readonly submitted: boolean;
  readonly reference: string | null;
  readonly duplicate: boolean;
}

export const CLOSED_LEAD_SHEET: LeadSheetState = {
  open: false,
  submitted: false,
  reference: null,
  duplicate: false,
};

/**
 * A transition, plus whether the visitor's ANSWERS should be discarded.
 *
 * The answers (service, scope, budget, timeline, contact, consent) live in the
 * wider plan rather than in this machine, so a transition cannot clear them
 * itself. It reports the intent and the caller obeys.
 */
export interface LeadSheetTransition {
  readonly state: LeadSheetState;
  readonly resetAnswers: boolean;
}

/** Open the sheet for a new enquiry. */
export function openSheet(state: LeadSheetState): LeadSheetTransition {
  /*
   * Opening on top of a FINISHED enquiry starts over.
   *
   * Reaching here with `submitted` set means the sheet was reopened without
   * passing through a close — belt and braces for a CTA that sets `open`
   * directly. The previous visitor's reference must not greet the next one.
   */
  if (state.submitted) {
    return { state: { ...CLOSED_LEAD_SHEET, open: true }, resetAnswers: true };
  }
  return { state: { ...state, open: true }, resetAnswers: false };
}

/**
 * The backend accepted a lead. THE SHEET IS OPEN AFTERWARDS. ALWAYS.
 *
 * This is the whole point of the module. The confirmation is rendered in place
 * of the fields and remains until the visitor closes it. Nothing here resets
 * anything either — resetting now would blank the reference they are about to
 * read.
 *
 * `open` is forced rather than merely preserved because of the in-flight case:
 * a visitor can press Escape, or the scrim, in the moment between the request
 * leaving and the answer arriving. The lead is created regardless. Leaving the
 * sheet closed there would recreate the original defect exactly — a lead in
 * CRM that the person who sent it was never told about — so an acceptance
 * brings the confirmation back rather than dropping it.
 */
export function acceptSubmission(
  state: LeadSheetState,
  outcome: LeadSubmissionOutcome
): LeadSheetTransition {
  return {
    state: {
      ...state,
      open: true,
      submitted: true,
      reference: outcome.reference,
      duplicate: outcome.duplicate,
    },
    resetAnswers: false,
  };
}

/**
 * Close the sheet.
 *
 * Every close path funnels through here — the header X, the scrim, Escape and
 * the confirmation's Done — so this is the single place that decides whether
 * the enquiry behind it is finished business. Closing an ACCEPTED enquiry
 * forgets it; closing a half-filled one keeps it, so that a visitor who
 * dismissed the sheet by accident does not lose their answers.
 */
export function closeSheet(state: LeadSheetState): LeadSheetTransition {
  if (state.submitted) {
    return { state: CLOSED_LEAD_SHEET, resetAnswers: true };
  }
  return { state: { ...state, open: false }, resetAnswers: false };
}

/**
 * Done on the confirmation. Identical to closing it, and deliberately so:
 * a visitor who presses Done and one who presses X have both finished.
 */
export function finishSubmission(): LeadSheetTransition {
  return { state: CLOSED_LEAD_SHEET, resetAnswers: true };
}

/** Discard everything — used by the plan's own full reset. */
export function resetSheet(): LeadSheetTransition {
  return { state: CLOSED_LEAD_SHEET, resetAnswers: true };
}
