"use client";

import {
  useCallback,
  useEffect,
  useId,
  useRef,
  useState,
  type FormEvent,
} from "react";
import {
  PM_PLANNER,
  type PmPropertyId,
  type PmServiceId,
  type PmStep,
  type PmTimelineId,
} from "./content";
import { usePlan } from "./PlanContext";
import { validateContact } from "./plan-state";

/* ------------------------------------------------------------------ atoms */

function CloseIcon() {
  return (
    <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true" focusable="false">
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
    <svg viewBox="0 0 24 24" width="14" height="14" aria-hidden="true" focusable="false">
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
    <svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true" focusable="false">
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
  const { step, progress, setStep, service, property, timeline } = usePlan();

  const reached = (target: PmStep): boolean => {
    if (target === 1) return true;
    if (target === 2) return Boolean(service);
    if (target === 3) return Boolean(service && property);
    return Boolean(service && property && timeline);
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

/** Shared step flow. Rendered inline in the hero and inside the mobile sheet. */
function PlannerBody({ idPrefix, onClose, compactHeader }: PlannerBodyProps) {
  const plan = usePlan();
  const [errors, setErrors] = useState<readonly string[]>([]);
  const errorRef = useRef<HTMLDivElement | null>(null);

  const handleContinue = () => {
    if (plan.step === 1 && !plan.service) {
      setErrors(["Choose a service to continue."]);
      return;
    }
    if (plan.step === 2 && !plan.property) {
      setErrors(["Choose a property type to continue."]);
      return;
    }
    if (plan.step === 3 && !plan.timeline) {
      setErrors(["Choose a timeline to continue."]);
      return;
    }
    setErrors([]);
    plan.goNext();
  };

  const onSubmit = (event: FormEvent) => {
    event.preventDefault();
    const next = validateContact(plan);
    setErrors(next);
    if (next.length > 0) {
      queueMicrotask(() => errorRef.current?.focus());
      return;
    }
    plan.markSubmitted();
  };

  if (plan.submitted) {
    return (
      <div className="pm-planner__success" role="status">
        <span className="pm-planner__successMark" aria-hidden="true">
          <CheckIcon />
        </span>
        <h3 className="pm-planner__successTitle">{PM_PLANNER.successTitle}</h3>
        <p className="pm-planner__successBody">{PM_PLANNER.successBody}</p>
        <button
          type="button"
          className="dc-btn dc-btn--ghost"
          onClick={() => plan.editSubmission()}
        >
          {PM_PLANNER.editDetailsLabel}
        </button>
      </div>
    );
  }

  const legend = PM_PLANNER.steps[plan.step - 1]!.legend;

  return (
    <form className="pm-planner__form" onSubmit={onSubmit} noValidate>
      <header className="pm-planner__head" data-compact={compactHeader ? "" : undefined}>
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
        <div
          ref={errorRef}
          className="pm-errors"
          role="alert"
          tabIndex={-1}
        >
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
          <OptionList
            name={`${idPrefix}-property`}
            legend={PM_PLANNER.steps[1]!.legend}
            options={PM_PLANNER.properties}
            selected={plan.property}
            columns="two"
            onSelect={(id) => {
              plan.setProperty(id as PmPropertyId);
              setErrors([]);
            }}
          />
        ) : null}

        {plan.step === 3 ? (
          <>
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
            <fieldset className="pm-fieldset">
              <legend className="pm-legend">{PM_PLANNER.roomsLegend}</legend>
              <div className="pm-options" data-columns="two">
                {PM_PLANNER.rooms.map((room, index) => (
                  <label
                    key={room.id}
                    className="pm-option"
                    data-selected={plan.rooms.includes(room.id) ? "" : undefined}
                    style={{ "--pm-option-index": index } as React.CSSProperties}
                  >
                    <input
                      type="checkbox"
                      name={`${idPrefix}-rooms`}
                      value={room.id}
                      checked={plan.rooms.includes(room.id)}
                      onChange={() => plan.toggleRoom(room.id)}
                    />
                    <span className="pm-option__tick" aria-hidden="true">
                      <CheckIcon />
                    </span>
                    <span className="pm-option__label">{room.label}</span>
                  </label>
                ))}
              </div>
            </fieldset>
          </>
        ) : null}

        {plan.step === 4 ? (
          <fieldset className="pm-fieldset">
            <legend className="pm-legend">{PM_PLANNER.steps[3]!.legend}</legend>

            <div className="pm-field">
              <label htmlFor={`${idPrefix}-name`}>
                {PM_PLANNER.nameLabel} <span className="pm-req">required</span>
              </label>
              <input
                id={`${idPrefix}-name`}
                name="name"
                type="text"
                autoComplete="name"
                value={plan.name}
                onChange={(event) => plan.setContact({ name: event.target.value })}
                required
              />
            </div>

            <div className="pm-field">
              <label htmlFor={`${idPrefix}-mobile`}>
                {PM_PLANNER.mobileLabel} <span className="pm-req">required</span>
              </label>
              <input
                id={`${idPrefix}-mobile`}
                name="mobile"
                type="tel"
                inputMode="numeric"
                autoComplete="tel-national"
                maxLength={10}
                value={plan.mobile}
                onChange={(event) =>
                  plan.setContact({
                    mobile: event.target.value.replace(/\D/g, "").slice(0, 10),
                  })
                }
                required
              />
            </div>

            <div className="pm-field">
              <label htmlFor={`${idPrefix}-locality`}>
                {PM_PLANNER.localityLabel}{" "}
                <span className="pm-req">required</span>
              </label>
              <input
                id={`${idPrefix}-locality`}
                name="locality"
                type="text"
                autoComplete="address-level2"
                value={plan.locality}
                onChange={(event) =>
                  plan.setContact({ locality: event.target.value })
                }
                required
              />
            </div>

            <div className="pm-field">
              <label htmlFor={`${idPrefix}-message`}>
                {PM_PLANNER.messageLabel}{" "}
                <span className="pm-opt">optional</span>
              </label>
              <textarea
                id={`${idPrefix}-message`}
                name="message"
                rows={3}
                value={plan.message}
                onChange={(event) => plan.setMessage(event.target.value)}
              />
            </div>

            <label className="pm-check">
              <input
                type="checkbox"
                name="privacyConsent"
                checked={plan.privacyConsent}
                onChange={(event) =>
                  plan.setContact({ privacyConsent: event.target.checked })
                }
                required
              />
              <span>
                {PM_PLANNER.privacyConsentLabel}{" "}
                <span className="pm-req">required</span>
              </span>
            </label>

            <label className="pm-check">
              <input
                type="checkbox"
                name="whatsappConsent"
                checked={plan.whatsappConsent}
                onChange={(event) =>
                  plan.setContact({ whatsappConsent: event.target.checked })
                }
              />
              <span>
                {PM_PLANNER.whatsappConsentLabel}{" "}
                <span className="pm-opt">optional</span>
              </span>
            </label>
          </fieldset>
        ) : null}
      </div>

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
          <button type="submit" className="dc-btn dc-btn--primary pm-btn--sheen">
            {PM_PLANNER.submitLabel}
            <ArrowIcon />
          </button>
        )}
      </div>
    </form>
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
        "input:not([disabled]), button:not([disabled]), textarea, select, [href]"
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
          'input:not([disabled]), button:not([disabled]), textarea:not([disabled]), select:not([disabled]), [href], [tabindex]:not([tabindex="-1"])'
        )
      ).filter((node) => node.offsetParent !== null || node === document.activeElement);

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

/** Bottom sheet used below the inline breakpoint. */
export function PmPlannerSheet() {
  const { isOpen, mode, closePlanner } = usePlan();
  const open = isOpen && mode === "sheet";
  const panelRef = useSheetOverlay(open, closePlanner);
  const idPrefix = useId();

  if (!open) return null;

  return (
    <div className="pm-sheet" data-open="">
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
        <PlannerBody idPrefix={idPrefix} onClose={closePlanner} compactHeader />
      </div>
    </div>
  );
}

/**
 * Inline hero card. Collapsed it shows only the service choice; picking a
 * service expands the same shared flow in place.
 */
export function PmPlannerInline() {
  const plan = usePlan();
  const idPrefix = useId();
  const expanded = plan.isOpen && plan.mode === "inline";

  const chooseService = useCallback(
    (id: PmServiceId) => {
      plan.setService(id);
      plan.openPlanner(2);
    },
    [plan]
  );

  return (
    <div className="pm-card pm-planner" data-expanded={expanded ? "" : undefined}>
      <span className="pm-card__glow" aria-hidden="true" />
      {expanded || plan.submitted ? (
        <PlannerBody idPrefix={idPrefix} onClose={plan.closePlanner} />
      ) : (
        <div className="pm-planner__entry">
          <p className="pm-planner__title">{PM_PLANNER.title}</p>
          <p className="pm-planner__hint">{PM_PLANNER.entryHint}</p>
          <PlanProgress compact />
          <div className="pm-options" data-columns="auto">
            {PM_PLANNER.services.map((option, index) => (
              <button
                key={option.id}
                type="button"
                className="pm-option pm-option--button"
                data-selected={plan.service === option.id ? "" : undefined}
                style={{ "--pm-option-index": index } as React.CSSProperties}
                onClick={() => chooseService(option.id as PmServiceId)}
              >
                <span className="pm-option__tick" aria-hidden="true">
                  <CheckIcon />
                </span>
                <span className="pm-option__label">{option.label}</span>
              </button>
            ))}
          </div>
          <button
            type="button"
            className="dc-btn dc-btn--primary pm-btn--sheen pm-planner__entryCta"
            onClick={() => plan.openPlanner()}
          >
            {plan.service || plan.property || plan.timeline
              ? PM_PLANNER.resumeLabel
              : PM_PLANNER.continueLabel}
            <ArrowIcon />
          </button>
        </div>
      )}
    </div>
  );
}

/** Compact entry block shown where the inline card is not available. */
export function PmPlannerEntry() {
  const { openPlanner, progress, service, property, timeline } = usePlan();
  const hasProgress = Boolean(service || property || timeline);

  return (
    <button type="button" className="pm-entry" onClick={() => openPlanner()}>
      <span className="pm-entry__body">
        <span className="pm-entry__title">{PM_PLANNER.title}</span>
        <span className="pm-entry__hint">{PM_PLANNER.entryHint}</span>
      </span>
      <span className="pm-entry__meta" aria-hidden="true">
        {progress}%
      </span>
      <span className="pm-entry__ctaLabel">
        {hasProgress ? PM_PLANNER.resumeLabel : PM_PLANNER.continueLabel}
      </span>
      <span className="pm-entry__go" aria-hidden="true">
        <ArrowIcon />
      </span>
    </button>
  );
}

/** Sheet is mounted once from PmShell — do not duplicate hosts. */
