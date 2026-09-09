"use client";

/**
 * What the visitor sees after the server accepts their enquiry.
 *
 * WHY THIS IS ITS OWN COMPONENT, AND WHY IT READS FROM CONTEXT
 *
 * It used to be a line of text inside the form component, and the form
 * component was unmounted the instant a lead was accepted — `markSubmitted()`
 * both recorded the acceptance and closed the sheet, and the sheet returns
 * null while closed. So the confirmation and the submission reference existed
 * for no observable time at all: a visitor filled in the form, pressed the
 * button, and watched the whole sheet vanish with nothing to tell them whether
 * their enquiry had been received or lost.
 *
 * The confirmation therefore does not belong to the form. It outlives it. It
 * reads the result from `PlanContext`, so it survives the fields unmounting,
 * and it stays on screen until the visitor closes it themselves.
 *
 * IT RENDERS NO FORM AND NO INPUT
 *
 * There is nothing left to submit. The only control is Done, which closes the
 * sheet and clears the finished enquiry so the next CTA opens a blank one.
 */

import { useEffect, useRef } from "react";

import { usePlan } from "../../public-site/home-r4/PlanContext";
import {
  LEAD_FORM_DONE_LABEL,
  LEAD_FORM_DUPLICATE_TITLE,
  LEAD_FORM_SUCCESS_TITLE,
} from "./lead-form-errors.ts";

export function LeadSubmissionSuccess() {
  const { submissionReference, submissionDuplicate, finishSubmission } =
    usePlan();
  const headingRef = useRef<HTMLParagraphElement>(null);

  /*
   * Move focus to the confirmation.
   *
   * The control the visitor last touched — the submit button — went away with
   * the form it belonged to. Without this, focus falls back to the document
   * and a keyboard or screen-reader user is left somewhere nothing was
   * announced. `role="status"` reads the message out; this makes it the place
   * they are actually standing.
   */
  useEffect(() => {
    headingRef.current?.focus();
  }, []);

  /*
   * A REPLAY IS NOT A SECOND LEAD.
   *
   * A 200 means the server recognised an enquiry it already holds. Repeating
   * "received" would tell the visitor a second request had been raised.
   */
  const title = submissionDuplicate
    ? LEAD_FORM_DUPLICATE_TITLE
    : LEAD_FORM_SUCCESS_TITLE;

  return (
    <div
      className="pm-brief pm-brief--done"
      data-od-lead-result={submissionDuplicate ? "duplicate" : "created"}
    >
      <p
        ref={headingRef}
        className="pm-brief__success-title"
        role="status"
        aria-live="polite"
        tabIndex={-1}
      >
        {title}
      </p>

      {submissionReference ? (
        <p className="pm-brief__reference">
          Reference:{" "}
          {/*
            Its own element, allowed to break anywhere. A reference has no
            spaces, and an unbreakable one on a narrow phone would either
            overflow the panel or push the whole sheet sideways.
          */}
          <span
            className="pm-brief__reference-value"
            data-od-lead-reference={submissionReference}
          >
            {submissionReference}
          </span>
        </p>
      ) : null}

      <div className="pm-brief__done-actions">
        <button
          type="button"
          className="dc-btn dc-btn--primary pm-btn--sheen"
          data-od-lead-done=""
          onClick={finishSubmission}
        >
          {LEAD_FORM_DONE_LABEL}
        </button>
      </div>
    </div>
  );
}
