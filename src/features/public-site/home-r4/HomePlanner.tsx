"use client";

import { useEffect, useId, useRef } from "react";
import { PM_PLANNER } from "./content";
import { usePlan } from "./PlanContext";
import { UnifiedLeadBrief } from "../../lead-intake/public/UnifiedLeadBrief";
import { LeadSubmissionSuccess } from "../../lead-intake/public/LeadSubmissionSuccess";
import { useLeadConsultation } from "../../lead-intake/public/LeadConsultationHost";
import { LeadIntakeUnavailable } from "../../lead-intake/public/LeadIntakeUnavailable";

/* ------------------------------------------------------------------ atoms */

function CloseIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      width="18"
      height="18"
      aria-hidden="true"
      focusable="false"
    >
      <path
        d="M6 6l12 12M18 6L6 18"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
      />
    </svg>
  );
}

/* ------------------------------------------------------------------- body */

interface PlannerBodyProps {
  readonly idPrefix: string;
  readonly onClose?: () => void;
  readonly compactHeader?: boolean;
}

/**
 * The one public lead form: Service -> Home -> Timeline -> Brief.
 *
 * Steps 1-3 ask; step 4 sends. The first three live in a plain `div` rather
 * than a `form`, because the only form on this journey is the one that submits
 * - nesting the brief inside another form would be invalid HTML and would let
 * Enter on a radio button reach the wrong submit handler.
 */
function PlannerBody({ onClose, compactHeader }: PlannerBodyProps) {
  const plan = usePlan();

  /*
   * ONCE THE LEAD IS ACCEPTED, THE STEPS ARE OVER.
   *
   * The confirmation replaces the four-step journey rather than sitting under
   * it: no progress rail counting steps that are finished, no Back offering to
   * re-open answers that are already in CRM, no submit control, no editable
   * field of any kind. The header and its close button stay, because the
   * visitor still has to be able to leave — and leaving is now THEIR decision.
   * This screen used to close itself in the same tick it appeared.
   */
  if (plan.submitted) {
    return (
      <div className="pm-planner__form" data-plan-submitted="">
        <header
          className="pm-planner__head"
          data-compact={compactHeader ? "" : undefined}
        >
          <div>
            <p className="pm-planner__title">{PM_PLANNER.title}</p>
          </div>
          {onClose ? (
            <button
              type="button"
              className="pm-iconbtn"
              onClick={onClose}
              aria-label={PM_PLANNER.closeLabel}
            >
              <CloseIcon />
            </button>
          ) : null}
        </header>

        <div className="pm-planner__panel" data-step="done">
          <LeadSubmissionSuccess />
        </div>
      </div>
    );
  }

  /*
   * ONE PANEL, NOT FOUR STEPS.
   *
   * The sheet used to walk a visitor through service -> home -> timeline ->
   * brief, with a progress rail and Back/Continue. Every one of those screens
   * asked a single question, so the flow spent four transitions collecting what
   * fits on one screen — and each transition is somewhere to abandon.
   *
   * The questions are unchanged and so is the contract behind them: the same
   * plan state, the same adapter, the same submission. What changed is that
   * they are all visible at once, in reading order, which is what a short form
   * should be. `PlanProgress`, `OptionList` and the step machinery in
   * `PlanContext` are left in place rather than ripped out — this is a UI pass,
   * and removing them is a cleanup lane of its own.
   */
  return (
    <div className="pm-planner__form od-lead">
      <header
        className="pm-planner__head"
        data-compact={compactHeader ? "" : undefined}
      >
        <div>
          <p className="pm-planner__title">{PM_PLANNER.title}</p>
          <p className="pm-planner__hint">{PM_PLANNER.entryHint}</p>
        </div>
        {onClose ? (
          <button
            type="button"
            className="pm-iconbtn"
            onClick={onClose}
            aria-label={PM_PLANNER.closeLabel}
          >
            <CloseIcon />
          </button>
        ) : null}
      </header>

      <div className="pm-planner__panel" data-step="single">
        <UnifiedLeadBrief onSubmitted={plan.markSubmitted} />
      </div>
    </div>
  );
}

function useSheetOverlay(open: boolean, closePlanner: () => void) {
  const panelRef = useRef<HTMLDivElement | null>(null);
  const restoreTo = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (!open) return;

    restoreTo.current = document.activeElement as HTMLElement | null;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    const panel = panelRef.current;
    panel
      ?.querySelector<HTMLElement>(
        "input:not([disabled]), button:not([disabled]), textarea, select, [href]",
      )
      ?.focus();

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.stopPropagation();
        closePlanner();
        return;
      }
      if (event.key !== "Tab" || !panelRef.current) return;

      const focusables = Array.from(
        panelRef.current.querySelectorAll<HTMLElement>(
          'input:not([disabled]), button:not([disabled]), textarea:not([disabled]), select:not([disabled]), [href], [tabindex]:not([tabindex="-1"])',
        ),
      ).filter(
        (node) => node.offsetParent !== null || node === document.activeElement,
      );

      if (focusables.length === 0) return;
      const first = focusables[0]!;
      const last = focusables[focusables.length - 1]!;

      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };

    document.addEventListener("keydown", onKeyDown, true);

    return () => {
      document.removeEventListener("keydown", onKeyDown, true);
      document.body.style.overflow = previousOverflow;
      restoreTo.current?.focus?.();
    };
  }, [open, closePlanner]);

  return panelRef;
}

/**
 * The brief moment between opening the sheet and hearing back from the server.
 *
 * Deliberately quiet and deliberately not a form: showing fields here and
 * taking them away a moment later would be worse than a short wait.
 */
function LeadIntakeChecking() {
  return (
    <div className="pm-planner__form" role="status" aria-live="polite">
      <p className="pm-planner__title">One moment</p>
      <p className="pm-planner__hint">Preparing your consultation…</p>
    </div>
  );
}

/** Bottom sheet used below the inline breakpoint. */
export function HomePlannerSheet() {
  const plan = usePlan();
  const { isOpen, closePlanner } = plan;
  const { readiness, checkReadiness } = useLeadConsultation();
  const panelRef = useSheetOverlay(isOpen, closePlanner);
  const idPrefix = useId();

  /*
   * ASK THE SERVER WHEN THE SHEET OPENS, NOT WHEN THE PAGE LOADS.
   *
   * The answer has to be about the backend as it is now. A page built while the
   * backend was healthy and served to somebody afterwards is precisely how a
   * real enquiry was lost, so the check is tied to the moment the visitor asks
   * for the form rather than to the moment the HTML was produced.
   */
  useEffect(() => {
    if (isOpen) void checkReadiness();
  }, [isOpen, checkReadiness]);

  if (!isOpen) return null;

  return (
    /*
      THE SHEET CARRIES ITS OWN THEME SCOPE.

      Every `pm-*` rule is written as `[data-public-home-r4] .pm-...`, and this
      component is now mounted on the homepage too, whose root carries a
      different scope attribute. Without this wrapper the sheet would render
      unstyled there. On `/interiors` it nests inside an identical scope, which
      changes nothing.
    */
    <div data-public-home-r4="" data-public-dark-theme="">
      <div
        className="pm-sheet"
        data-open=""
        data-plan-step={plan.step}
        data-plan-service={plan.service ?? ""}
        data-plan-scope={plan.projectScope ?? ""}
        data-plan-budget-range={plan.budgetRange ?? ""}
        data-plan-timeline={plan.timeline ?? ""}
        data-lead-readiness={readiness}
        data-plan-estimate={plan.estimateSummary?.rangeLabel ?? ""}
      >
        <button
          type="button"
          className="pm-sheet__scrim"
          aria-label={PM_PLANNER.closeLabel}
          onClick={closePlanner}
        />
        <div
          ref={panelRef}
          className="pm-sheet__panel"
          role="dialog"
          aria-modal="true"
          aria-label={PM_PLANNER.title}
        >
          <span className="pm-sheet__grip" aria-hidden="true" />
          {/*
            NO EDITABLE FIELDS UNTIL THE SERVER SAYS YES.

            A visitor must never be invited to answer four steps into a backend
            that cannot accept the result -- which is exactly what happened when
            a build-time public flag was allowed to answer this question.
          */}
          {readiness === "unavailable" ? (
            <LeadIntakeUnavailable onClose={closePlanner} />
          ) : readiness === "available" ? (
            <PlannerBody
              idPrefix={idPrefix}
              onClose={closePlanner}
              compactHeader
            />
          ) : (
            <LeadIntakeChecking />
          )}
        </div>
      </div>
    </div>
  );
}

/** @deprecated R5.3 — sheet-only planner; inline entry retained for compatibility. */
export function HomePlannerInline() {
  return null;
}

/** @deprecated R5.3 — sheet-only planner. */
export function HomePlannerEntry() {
  return null;
}

/** Sheet is mounted once from HomeShell — do not duplicate hosts. */
