"use client";

import { useEffect, useId, useRef, useState } from "react";
import {
  PM_PLANNER,
  type PmServiceId,
  type PmStep,
  type PmTimelineId,
} from "./content";
import { usePlan } from "./PlanContext";
import { homeStepComplete } from "./plan-state";
import {
  budgetRangesForProjectScope,
  LEAD_PROJECT_SCOPE_CODES,
  PROJECT_SCOPE_LABELS,
  SERVICE_BY_PROJECT_SCOPE,
  type LeadProjectScopeCode,
} from "../../lead-intake/project-scope";
import { v4RequiresScope } from "../../lead-intake/contracts";
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

function CheckIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      width="14"
      height="14"
      aria-hidden="true"
      focusable="false"
    >
      <path
        d="M5 12.5l4.2 4.2L19 7"
        fill="none"
        stroke="currentColor"
        strokeWidth="2.4"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function ArrowIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      width="16"
      height="16"
      aria-hidden="true"
      focusable="false"
    >
      <path
        d="M4 12h14m0 0l-5.5-5.5M18 12l-5.5 5.5"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.9"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

/** Animated progress rail plus per-step status dots. */
function PlanProgress({ compact = false }: { readonly compact?: boolean }) {
  const plan = usePlan();
  const { step, progress, setStep, service, timeline } = plan;

  /*
   * V4 FACTS ONLY.
   *
   * This used to ask whether `property` was set -- a `home-r4-v1` field that
   * step 2 no longer collects. Under v4 the Home step is a project scope plus a
   * budget band from that scope's ladder, and `custom-wardrobes` skips it
   * entirely. Reading the old field meant the rail's step buttons stayed
   * disabled for every visitor: the form worked forwards and was frozen
   * backwards, so nobody could return to an answered step.
   *
   * `homeStepComplete` is the same predicate the Continue button and the
   * request adapter use, so the rail cannot disagree with either.
   */
  const homeDone = homeStepComplete(plan);

  const reached = (target: PmStep): boolean => {
    if (target === 1) return true;
    if (target === 2) return Boolean(service);
    if (target === 3) return Boolean(service) && homeDone;
    return Boolean(service) && homeDone && Boolean(timeline);
  };

  return (
    <div className="pm-progress" data-compact={compact ? "" : undefined}>
      <div
        className="pm-progress__rail"
        role="progressbar"
        aria-label={PM_PLANNER.progressLabel}
        aria-valuenow={progress}
        aria-valuemin={0}
        aria-valuemax={100}
      >
        <span
          className="pm-progress__fill"
          style={{ transform: `scaleX(${progress / 100})` }}
        />
      </div>
      <ol className="pm-progress__steps">
        {PM_PLANNER.steps.map((entry) => {
          const id = entry.id as PmStep;
          const isCurrent = id === step;
          const isDone = reached(id) && id < step;
          return (
            <li key={entry.id}>
              <button
                type="button"
                className="pm-progress__step"
                data-current={isCurrent ? "" : undefined}
                data-done={isDone ? "" : undefined}
                aria-current={isCurrent ? "step" : undefined}
                disabled={!reached(id)}
                onClick={() => setStep(id)}
              >
                <span className="pm-progress__dot" aria-hidden="true">
                  {isDone ? <CheckIcon /> : entry.id}
                </span>
                <span className="pm-progress__label">{entry.short}</span>
              </button>
            </li>
          );
        })}
      </ol>
    </div>
  );
}

interface OptionListProps {
  readonly name: string;
  readonly legend: string;
  readonly options: readonly { readonly id: string; readonly label: string }[];
  readonly selected: string | null;
  readonly onSelect: (id: string) => void;
  readonly columns?: "auto" | "two";
}

function OptionList({
  name,
  legend,
  options,
  selected,
  onSelect,
  columns = "auto",
}: OptionListProps) {
  return (
    <fieldset className="pm-fieldset">
      <legend className="pm-legend">{legend}</legend>
      <div className="pm-options" data-columns={columns}>
        {options.map((option, index) => {
          const isSelected = selected === option.id;
          return (
            <label
              key={option.id}
              className="pm-option"
              data-selected={isSelected ? "" : undefined}
              style={{ "--pm-option-index": index } as React.CSSProperties}
            >
              <input
                type="radio"
                name={name}
                value={option.id}
                checked={isSelected}
                onChange={() => onSelect(option.id)}
              />
              <span className="pm-option__tick" aria-hidden="true">
                <CheckIcon />
              </span>
              <span className="pm-option__label">{option.label}</span>
            </label>
          );
        })}
      </div>
    </fieldset>
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
function PlannerBody({ idPrefix, onClose, compactHeader }: PlannerBodyProps) {
  const plan = usePlan();
  const [errors, setErrors] = useState<readonly string[]>([]);
  const errorRef = useRef<HTMLDivElement | null>(null);

  const scopeAsked = plan.service != null && v4RequiresScope(plan.service);
  const scopeOptions = plan.service
    ? LEAD_PROJECT_SCOPE_CODES.filter(
        (scope) => SERVICE_BY_PROJECT_SCOPE[scope] === plan.service,
      )
    : LEAD_PROJECT_SCOPE_CODES;
  const budgetOptions = budgetRangesForProjectScope(plan.projectScope);

  const handleContinue = () => {
    if (plan.step === 1 && !plan.service) {
      setErrors(["Choose a service to continue."]);
      return;
    }
    if (plan.step === 2 && !homeStepComplete(plan)) {
      setErrors(
        plan.projectScope
          ? ["Choose a budget range to continue."]
          : ["Choose the size of your home to continue."],
      );
      return;
    }
    if (plan.step === 3 && !plan.timeline) {
      setErrors(["Choose a timeline to continue."]);
      return;
    }
    setErrors([]);
    plan.goNext();
  };

  const legend = PM_PLANNER.steps[plan.step - 1]!.legend;

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

  return (
    <div className="pm-planner__form">
      <header
        className="pm-planner__head"
        data-compact={compactHeader ? "" : undefined}
      >
        <div>
          <p className="pm-planner__title">{PM_PLANNER.title}</p>
          <p className="pm-planner__hint">{legend}</p>
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

      <PlanProgress />

      {errors.length > 0 ? (
        <div ref={errorRef} className="pm-errors" role="alert" tabIndex={-1}>
          <p className="pm-errors__title">{PM_PLANNER.errorSummaryTitle}</p>
          <ul>
            {errors.map((error) => (
              <li key={error}>{error}</li>
            ))}
          </ul>
        </div>
      ) : null}

      {/* key forces the enter animation on every step change */}
      <div className="pm-planner__panel" key={plan.step} data-step={plan.step}>
        {plan.step === 1 ? (
          <OptionList
            name={`${idPrefix}-service`}
            legend={PM_PLANNER.steps[0]!.legend}
            options={PM_PLANNER.services}
            selected={plan.service}
            onSelect={(id) => {
              plan.setService(id as PmServiceId);
              setErrors([]);
            }}
          />
        ) : null}

        {plan.step === 2 ? (
          scopeAsked ? (
            <>
              <OptionList
                name={`${idPrefix}-scope`}
                legend={PM_PLANNER.scopeLegend}
                options={scopeOptions.map((scope) => ({
                  id: scope,
                  label: PROJECT_SCOPE_LABELS[scope],
                }))}
                selected={plan.projectScope}
                columns="two"
                onSelect={(id) => {
                  plan.setProjectScope(id as LeadProjectScopeCode);
                  setErrors([]);
                }}
              />
              {/*
                The budget ladder is per-scope, so it cannot be shown before the
                scope is chosen: there is no generic ladder to fall back to, and
                offering one scope's bands under another's heading would put a
                pairing on screen that the contract refuses.
              */}
              {plan.projectScope ? (
                <OptionList
                  name={`${idPrefix}-budget`}
                  legend={PM_PLANNER.budgetRangeLegend}
                  options={budgetOptions.map((option) => ({
                    id: option.code,
                    label: option.label,
                  }))}
                  selected={plan.budgetRange}
                  columns="two"
                  onSelect={(id) => {
                    plan.setBudgetRange(id);
                    setErrors([]);
                  }}
                />
              ) : (
                <p className="pm-planner__hint">
                  {PM_PLANNER.budgetRangeLockedHint}
                </p>
              )}
            </>
          ) : (
            /*
              CUSTOM WARDROBES ASK NOTHING HERE, AND THAT IS DELIBERATE.

              No scope on this form describes a wardrobe job, and there is no
              owner-approved wardrobe budget ladder. The honest answer is to say
              so and move on; inventing a band would put a number in CRM that
              nobody quoted and nobody chose.
            */
            <p className="pm-planner__hint">{PM_PLANNER.wardrobeScopeNote}</p>
          )
        ) : null}

        {plan.step === 3 ? (
          /*
            Rooms used to be collected here too. `public-consult-v4` forbids the
            field, so the control is gone rather than hidden: a question whose
            answer the contract refuses is a question we should not be asking.
          */
          <OptionList
            name={`${idPrefix}-timeline`}
            legend={PM_PLANNER.steps[2]!.legend}
            options={PM_PLANNER.timelines}
            selected={plan.timeline}
            columns="two"
            onSelect={(id) => {
              plan.setTimeline(id as PmTimelineId);
              setErrors([]);
            }}
          />
        ) : null}

        {plan.step === 4 ? (
          <UnifiedLeadBrief onSubmitted={plan.markSubmitted} />
        ) : null}
      </div>

      <p className="pm-planner__reassurance">{PM_PLANNER.reassurance}</p>

      {/*
        The submit control belongs to the brief's own form, so this row carries
        Back and Continue only. On step 4 there is nothing left to continue to.
      */}
      <div className="pm-planner__actions">
        {plan.step > 1 ? (
          <button
            type="button"
            className="dc-btn dc-btn--ghost"
            onClick={() => {
              setErrors([]);
              plan.goBack();
            }}
          >
            {PM_PLANNER.backLabel}
          </button>
        ) : (
          <span />
        )}

        {plan.step < 4 ? (
          <button
            type="button"
            className="dc-btn dc-btn--primary pm-btn--sheen"
            onClick={handleContinue}
          >
            {PM_PLANNER.continueLabel}
            <ArrowIcon />
          </button>
        ) : (
          <span />
        )}
      </div>
    </div>
  );
}

/* --------------------------------------------------------------- overlay */

/**
 * Sheet behaviour: scroll lock, focus trap, Escape, focus restoration.
 * Depends only on `open` and the stable `closePlanner`, so typing inside the
 * sheet never re-runs the effect and never steals focus back to the first field.
 */
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
