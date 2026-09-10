/**
 * THE CONFIRMATION MUST SURVIVE THE SUBMISSION.
 *
 * THE INCIDENT
 *
 * The backend repair worked: readiness said available, the browser posted, the
 * server answered `201` and wrote the lead. And the visitor saw the entire
 * sheet disappear. `markSubmitted()` recorded the acceptance AND closed the
 * sheet, `HomePlannerSheet` renders null while closed, and the confirmation
 * lived inside the form component being unmounted. Success and its submission
 * reference were created and destroyed in the same tick.
 *
 * From the visitor's side that is indistinguishable from the bug we had just
 * finished fixing. A vanished form is how a lost lead looks.
 *
 * WHAT THIS SUITE PINS
 *
 * Two halves, because the bug had two halves:
 *
 *   1. THE TRANSITIONS. `lead-sheet-lifecycle.ts` is a plain module precisely
 *      so the state change can be asserted directly rather than clicked at.
 *      `acceptSubmission` leaving `open` true is the single fact whose absence
 *      caused the incident, and it is asserted first.
 *
 *   2. THE WIRING. Pure transitions are worth nothing if the components do
 *      not use them, so the sources are read to prove that nothing closes the
 *      sheet on acceptance any more, that the confirmation is rendered from
 *      context rather than from the form's own state, and that the panel it
 *      renders contains no editable field.
 *
 * WHY THE SECOND HALF IS READ RATHER THAN RENDERED
 *
 * This repo has no DOM harness, and Node's type stripping cannot compile JSX,
 * so a `.tsx` component cannot be imported by these tests at all. That is why
 * every UI suite here asserts against source text. The honest consequence is
 * recorded at the bottom of this file: a real browser click-through is still
 * an owner step, and these tests do not replace it.
 */

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, test } from "node:test";

import {
  acceptSubmission,
  CLOSED_LEAD_SHEET,
  closeSheet,
  finishSubmission,
  openSheet,
  resetSheet,
  type LeadSheetState,
} from "../../public-site/home-r4/lead-sheet-lifecycle.ts";
import {
  LEAD_FORM_DONE_LABEL,
  LEAD_FORM_DUPLICATE_TITLE,
  LEAD_FORM_SUCCESS_TITLE,
  getLeadFormStatusMessage,
} from "../public/lead-form-errors.ts";

const root = process.cwd();

/** Source with comments stripped: assertions must not match our own prose. */
function readCode(relative: string): string {
  return readFileSync(join(root, relative), "utf8")
    .replace(/\r\n/g, "\n")
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/(^|[^:])\/\/.*$/gm, "$1");
}

const OPEN_SHEET: LeadSheetState = {
  open: true,
  submitted: false,
  reference: null,
  duplicate: false,
};

const ACCEPTED = "0d1ee6a8-db10-4c72-9b95-82abace841b1";

describe("an accepted lead keeps the sheet open", () => {
  test("acceptSubmission does NOT close the sheet", () => {
    /*
     * THE REGRESSION, STATED AS ONE ASSERTION.
     *
     * The old `markSubmitted()` set `submitted` and `isOpen=false` together.
     * Anything that closes here puts the confirmation back inside the same
     * tick it was born in.
     */
    const next = acceptSubmission(OPEN_SHEET, {
      reference: ACCEPTED,
      duplicate: false,
    });

    assert.equal(next.state.open, true, "the sheet must stay open");
    assert.equal(next.state.submitted, true);
    assert.equal(next.state.reference, ACCEPTED);
    assert.equal(next.state.duplicate, false);
  });

  test("acceptance never discards the answers", () => {
    // Resetting on acceptance would blank the reference before it is read.
    const created = acceptSubmission(OPEN_SHEET, {
      reference: ACCEPTED,
      duplicate: false,
    });
    const duplicate = acceptSubmission(OPEN_SHEET, {
      reference: ACCEPTED,
      duplicate: true,
    });

    assert.equal(created.resetAnswers, false);
    assert.equal(duplicate.resetAnswers, false);
  });

  test("a replay is carried as a duplicate, with the same reference", () => {
    const next = acceptSubmission(OPEN_SHEET, {
      reference: ACCEPTED,
      duplicate: true,
    });

    assert.equal(next.state.open, true, "a replay must not close the sheet");
    assert.equal(next.state.submitted, true);
    assert.equal(next.state.duplicate, true);
    assert.equal(next.state.reference, ACCEPTED);
  });

  test("an acceptance re-opens a sheet closed while the request was flying", () => {
    /*
     * Escape or the scrim between the POST leaving and the 201 arriving. The
     * lead exists either way, so the confirmation has to come back: a created
     * lead whose sender was never told is the original defect wearing a
     * different hat.
     */
    const next = acceptSubmission(CLOSED_LEAD_SHEET, {
      reference: ACCEPTED,
      duplicate: false,
    });
    assert.equal(next.state.open, true);
    assert.equal(next.state.submitted, true);
    assert.equal(next.state.reference, ACCEPTED);
  });

  test("an acceptance without a reference is still an acceptance", () => {
    const next = acceptSubmission(OPEN_SHEET, {
      reference: null,
      duplicate: false,
    });
    assert.equal(next.state.open, true);
    assert.equal(next.state.submitted, true);
    assert.equal(next.state.reference, null);
  });
});

describe("the visitor closes it, and the next enquiry is clean", () => {
  const accepted = acceptSubmission(OPEN_SHEET, {
    reference: ACCEPTED,
    duplicate: false,
  }).state;

  test("Done closes and forgets the finished enquiry", () => {
    const next = finishSubmission();
    assert.equal(next.state.open, false);
    assert.equal(next.state.submitted, false);
    assert.equal(next.state.reference, null);
    assert.equal(
      next.resetAnswers,
      true,
      "the next CTA must not open someone else's answers"
    );
  });

  test("closing a FINISHED enquiry clears it, however it was closed", () => {
    // X, scrim and Escape all funnel through closeSheet.
    const next = closeSheet(accepted);
    assert.deepEqual(next.state, CLOSED_LEAD_SHEET);
    assert.equal(next.resetAnswers, true);
  });

  test("closing a HALF-FILLED enquiry keeps the answers", () => {
    /*
     * The opposite case, and the reason close cannot simply always reset:
     * dismissing the sheet by accident must not destroy four steps of typing.
     */
    const next = closeSheet(OPEN_SHEET);
    assert.equal(next.state.open, false);
    assert.equal(next.state.submitted, false);
    assert.equal(
      next.resetAnswers,
      false,
      "an unsent enquiry must survive being closed"
    );
  });

  test("reopening after a finished enquiry starts over", () => {
    const next = openSheet(accepted);
    assert.equal(next.state.open, true);
    assert.equal(next.state.submitted, false);
    assert.equal(next.state.reference, null);
    assert.equal(next.state.duplicate, false);
    assert.equal(next.resetAnswers, true);
  });

  test("reopening an unsent enquiry resumes it", () => {
    const parked = closeSheet(OPEN_SHEET).state;
    const next = openSheet(parked);
    assert.equal(next.state.open, true);
    assert.equal(next.resetAnswers, false);
  });

  test("resetSheet discards everything", () => {
    const next = resetSheet();
    assert.deepEqual(next.state, CLOSED_LEAD_SHEET);
    assert.equal(next.resetAnswers, true);
  });

  test("no transition ever leaves a reference behind a closed sheet", () => {
    /*
     * A reference outliving its sheet is how the next visitor would be shown
     * somebody else's submission. Exhaustive over every transition.
     */
    const states: readonly LeadSheetState[] = [
      CLOSED_LEAD_SHEET,
      OPEN_SHEET,
      accepted,
    ];
    const transitions = [
      ...states.map((s) => openSheet(s)),
      ...states.map((s) => closeSheet(s)),
      ...states.map((s) =>
        acceptSubmission(s, { reference: ACCEPTED, duplicate: false })
      ),
      finishSubmission(),
      resetSheet(),
    ];

    for (const { state } of transitions) {
      if (!state.open) {
        assert.equal(
          state.reference,
          null,
          "a closed sheet must carry no submission reference"
        );
        assert.equal(state.submitted, false);
      }
    }
  });
});

describe("the confirmation says the right thing", () => {
  test("a created lead uses the owner-approved wording", () => {
    assert.equal(
      LEAD_FORM_SUCCESS_TITLE,
      "Thank you. We received your consultation request and will follow up."
    );
    const message = getLeadFormStatusMessage("success-created", {
      submissionReference: ACCEPTED,
    });
    assert.equal(message?.isError, false);
    assert.equal(message?.title, LEAD_FORM_SUCCESS_TITLE);
    assert.match(message?.body ?? "", new RegExp(ACCEPTED));
  });

  test("a replay does not claim a second lead was raised", () => {
    const message = getLeadFormStatusMessage("success-duplicate", {
      submissionReference: ACCEPTED,
    });
    assert.equal(message?.isError, false);
    assert.equal(message?.title, LEAD_FORM_DUPLICATE_TITLE);
    // "received" would tell the visitor a new request had just been created.
    assert.doesNotMatch(LEAD_FORM_DUPLICATE_TITLE, /\breceived\b/i);
    assert.match(LEAD_FORM_DUPLICATE_TITLE, /already/i);
  });
});

describe("the components are wired to those transitions", () => {
  const planContext = readCode(
    "src/features/public-site/home-r4/PlanContext.tsx"
  );
  const planner = readCode("src/features/public-site/home-r4/HomePlanner.tsx");
  const success = readCode(
    "src/features/lead-intake/public/LeadSubmissionSuccess.tsx"
  );
  const brief = readCode("src/features/lead-intake/public/UnifiedLeadBrief.tsx");

  test("markSubmitted no longer closes the sheet", () => {
    /*
     * The original defect, asserted against the source that caused it. The
     * old body was `setSubmitted(true); setIsOpen(false);`.
     */
    const body = planContext.slice(
      planContext.indexOf("const markSubmitted"),
      planContext.indexOf("const finishSubmission")
    );
    assert.ok(body.length > 0, "markSubmitted must still exist");
    assert.match(body, /acceptSubmission/);
    assert.doesNotMatch(body, /setIsOpen\(false\)/);
    assert.doesNotMatch(body, /open:\s*false/);
  });

  test("nothing in the planner closes the sheet on success", () => {
    assert.doesNotMatch(planner, /onSubmitted=\{\(\)\s*=>\s*[^}]*close/i);
    assert.match(planner, /onSubmitted=\{plan\.markSubmitted\}/);
  });

  test("the sheet swaps to the confirmation instead of unmounting", () => {
    assert.match(planner, /if \(plan\.submitted\)/);
    assert.match(planner, /<LeadSubmissionSuccess \/>/);
  });

  test("the step chrome is gone once the enquiry is accepted", () => {
    // No progress rail, no Back, no submit control beside a confirmation.
    // The confirmation branch runs to the start of the normal return below it.
    const branch = planner.slice(
      planner.indexOf("if (plan.submitted)"),
      planner.indexOf('return (\n    <div className="pm-planner__form od-lead">')
    );
    assert.doesNotMatch(branch, /<PlanProgress/);
    assert.doesNotMatch(branch, /backLabel|continueLabel/);
    assert.doesNotMatch(branch, /<UnifiedLeadBrief/);
  });

  test("the confirmation reads the result from context, not the form", () => {
    /*
     * The reference must not live in the form component's local state: those
     * fields are unmounted the moment an enquiry is accepted, and the
     * reference would be destroyed with them.
     */
    assert.match(success, /usePlan\(\)/);
    assert.match(success, /submissionReference/);
    assert.match(success, /submissionDuplicate/);
    assert.match(planContext, /submissionReference/);
  });

  test("the confirmation offers no editable field and one way out", () => {
    assert.doesNotMatch(success, /<input/);
    assert.doesNotMatch(success, /<textarea/);
    assert.doesNotMatch(success, /<form/);
    assert.match(success, /data-od-lead-done/);
    assert.match(success, /finishSubmission/);
    assert.match(success, new RegExp(`LEAD_FORM_DONE_LABEL`));
    assert.equal(LEAD_FORM_DONE_LABEL, "Done");
  });

  test("the confirmation is announced and takes focus", () => {
    assert.match(success, /role="status"/);
    assert.match(success, /aria-live="polite"/);
    assert.match(success, /headingRef\.current\?\.focus\(\)/);
    assert.match(success, /tabIndex=\{-1\}/);
  });

  test("the reference is rendered where it can be read back", () => {
    assert.match(success, /data-od-lead-reference/);
    assert.match(success, /Reference:/);
  });

  test("the form hands its result upward rather than rendering success", () => {
    assert.match(brief, /onSubmitted\?\.\(\{/);
    assert.match(brief, /duplicate: result\.kind === "success-duplicate"/);
    // The brief must not carry a rival confirmation panel.
    assert.doesNotMatch(brief, /pm-brief--done/);
  });

  test("a failure still never closes the sheet or wipes the answers", () => {
    /*
     * The other half of the promise: 4xx/5xx must leave the visitor exactly
     * where they were, with everything they typed.
     */
    const failureBranch = brief.slice(brief.indexOf("if (!shouldReuseOnError"));
    // Stop at the end of the submit handler; past it lie the field onChanges.
    const submitTail = failureBranch.slice(
      0,
      failureBranch.indexOf("submittingRef.current = false;") +
        "submittingRef.current = false;".length
    );
    assert.doesNotMatch(submitTail, /markSubmitted|finishSubmission|close/i);
    assert.doesNotMatch(submitTail, /setName\(|setMobile\(|setConsent\(/);
  });
});

/*
 * NOT COVERED HERE, AND DELIBERATELY SAID OUT LOUD:
 *
 * no assertion above renders a component. This repo has no DOM harness and
 * Node cannot strip JSX, so the rendered result — focus actually landing on
 * the heading, the panel actually staying on screen, the Done button actually
 * being reachable on a 360px viewport — is proven by owner click-through, not
 * by this file. What is proven here is the state machine underneath it and the
 * wiring that reaches it.
 */
