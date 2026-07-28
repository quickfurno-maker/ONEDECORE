"use client";

import { useEffect, useId, useRef, useState, type FormEvent } from "react";
import {
  CM_PLANNER,
  type CmPlannerStep,
  type CmPropertyId,
  type CmServiceId,
  type CmTimelineId,
} from "./content";
import { useLead } from "./LeadContext";

const INDIAN_MOBILE = /^[6-9]\d{9}$/;

function OptionGrid({
  legend,
  name,
  options,
  value,
  onChange,
  errorId,
}: {
  legend: string;
  name: string;
  options: readonly { id: string; label: string }[];
  value: string | null;
  onChange: (id: string) => void;
  errorId?: string;
}) {
  return (
    <fieldset className="cm-fieldset" aria-describedby={errorId}>
      <legend className="cm-legend">{legend}</legend>
      <div className="cm-options" role="presentation">
        {options.map((option) => {
          const selected = value === option.id;
          return (
            <label
              key={option.id}
              className="cm-option"
              data-selected={selected ? "" : undefined}
            >
              <input
                type="radio"
                name={name}
                value={option.id}
                checked={selected}
                onChange={() => onChange(option.id)}
              />
              <span>{option.label}</span>
            </label>
          );
        })}
      </div>
    </fieldset>
  );
}

function PlannerFormBody({
  formId,
  onClose,
  showClose,
}: {
  formId: string;
  onClose?: () => void;
  showClose?: boolean;
}) {
  const lead = useLead();
  const errorSummaryId = useId();
  const [errors, setErrors] = useState<string[]>([]);
  const errorRef = useRef<HTMLDivElement | null>(null);

  const progressLabel = `Step ${lead.step} of 4`;

  const validateStep = (step: CmPlannerStep): string[] => {
    if (step === 1 && !lead.service) {
      return ["Select a service to continue."];
    }
    if (step === 2 && !lead.property) {
      return ["Select a property type to continue."];
    }
    if (step === 3 && !lead.timeline) {
      return ["Select a timeline to continue."];
    }
    if (step === 4) {
      const next: string[] = [];
      if (!lead.name.trim()) next.push("Name is required.");
      if (!INDIAN_MOBILE.test(lead.mobile.trim())) {
        next.push("Enter a valid 10-digit Indian mobile number.");
      }
      if (!lead.locality.trim()) next.push("Pune locality is required.");
      if (!lead.privacyConsent) next.push("Privacy consent is required.");
      return next;
    }
    return [];
  };

  const handleContinue = () => {
    const nextErrors = validateStep(lead.step);
    setErrors(nextErrors);
    if (nextErrors.length > 0) {
      queueMicrotask(() => errorRef.current?.focus());
      return;
    }
    setErrors([]);
    lead.goNext();
  };

  const handleSubmit = (event: FormEvent) => {
    event.preventDefault();
    const nextErrors = validateStep(4);
    setErrors(nextErrors);
    if (nextErrors.length > 0) {
      queueMicrotask(() => errorRef.current?.focus());
      return;
    }
    lead.markSubmitted();
  };

  if (lead.submitted) {
    return (
      <div className="cm-planner__success" role="status">
        <h3 className="cm-planner__successTitle">{CM_PLANNER.successTitle}</h3>
        <p className="cm-planner__successBody">{CM_PLANNER.successBody}</p>
        {showClose && onClose ? (
          <button type="button" className="dc-btn dc-btn--ghost" onClick={onClose}>
            Close
          </button>
        ) : null}
      </div>
    );
  }

  return (
    <form
      id={formId}
      className="cm-planner__form"
      onSubmit={handleSubmit}
      noValidate
      data-step={lead.step}
    >
      <div className="cm-planner__progress" aria-live="polite">
        <span className="cm-planner__progressLabel">{progressLabel}</span>
        <div
          className="cm-planner__track"
          role="progressbar"
          aria-valuemin={1}
          aria-valuemax={4}
          aria-valuenow={lead.step}
          aria-label={progressLabel}
        >
          <span style={{ width: `${(lead.step / 4) * 100}%` }} />
        </div>
      </div>

      {errors.length > 0 ? (
        <div
          ref={errorRef}
          id={errorSummaryId}
          className="cm-error-summary"
          role="alert"
          tabIndex={-1}
        >
          <p className="cm-error-summary__title">Please fix the following:</p>
          <ul>
            {errors.map((error) => (
              <li key={error}>{error}</li>
            ))}
          </ul>
        </div>
      ) : null}

      {lead.step === 1 ? (
        <OptionGrid
          legend={CM_PLANNER.steps[0].legend}
          name="cm-service"
          options={CM_PLANNER.services}
          value={lead.service}
          onChange={(id) => lead.setService(id as CmServiceId)}
          errorId={errors.length ? errorSummaryId : undefined}
        />
      ) : null}

      {lead.step === 2 ? (
        <OptionGrid
          legend={CM_PLANNER.steps[1].legend}
          name="cm-property"
          options={CM_PLANNER.properties}
          value={lead.property}
          onChange={(id) => lead.setProperty(id as CmPropertyId)}
          errorId={errors.length ? errorSummaryId : undefined}
        />
      ) : null}

      {lead.step === 3 ? (
        <OptionGrid
          legend={CM_PLANNER.steps[2].legend}
          name="cm-timeline"
          options={CM_PLANNER.timelines}
          value={lead.timeline}
          onChange={(id) => lead.setTimeline(id as CmTimelineId)}
          errorId={errors.length ? errorSummaryId : undefined}
        />
      ) : null}

      {lead.step === 4 ? (
        <fieldset className="cm-fieldset">
          <legend className="cm-legend">{CM_PLANNER.steps[3].legend}</legend>

          <div className="cm-field">
            <label htmlFor={`${formId}-name`}>
              Name <span className="cm-req">required</span>
            </label>
            <input
              id={`${formId}-name`}
              name="name"
              type="text"
              autoComplete="name"
              value={lead.name}
              onChange={(event) => lead.setContact({ name: event.target.value })}
              required
            />
          </div>

          <div className="cm-field">
            <label htmlFor={`${formId}-mobile`}>
              Indian mobile number <span className="cm-req">required</span>
            </label>
            <input
              id={`${formId}-mobile`}
              name="mobile"
              type="tel"
              inputMode="numeric"
              autoComplete="tel-national"
              maxLength={10}
              value={lead.mobile}
              onChange={(event) =>
                lead.setContact({
                  mobile: event.target.value.replace(/\D/g, "").slice(0, 10),
                })
              }
              required
              aria-describedby={`${formId}-mobile-hint`}
            />
            <p id={`${formId}-mobile-hint`} className="cm-hint">
              10 digits, starting with 6–9. No country code.
            </p>
          </div>

          <div className="cm-field">
            <label htmlFor={`${formId}-locality`}>
              Pune locality <span className="cm-req">required</span>
            </label>
            <input
              id={`${formId}-locality`}
              name="locality"
              type="text"
              autoComplete="address-level2"
              value={lead.locality}
              onChange={(event) =>
                lead.setContact({ locality: event.target.value })
              }
              required
            />
          </div>

          <p className="cm-privacy">{CM_PLANNER.privacyMicrocopy}</p>

          <label className="cm-check">
            <input
              type="checkbox"
              checked={lead.whatsappConsent}
              onChange={(event) =>
                lead.setContact({ whatsappConsent: event.target.checked })
              }
            />
            <span>
              {CM_PLANNER.whatsappConsentLabel}{" "}
              <span className="cm-opt">optional</span>
            </span>
          </label>

          <label className="cm-check">
            <input
              type="checkbox"
              checked={lead.privacyConsent}
              onChange={(event) =>
                lead.setContact({ privacyConsent: event.target.checked })
              }
              required
            />
            <span>
              {CM_PLANNER.privacyConsentLabel}{" "}
              <span className="cm-req">required</span>
            </span>
          </label>
        </fieldset>
      ) : null}

      <div className="cm-planner__actions">
        {lead.step > 1 ? (
          <button
            type="button"
            className="dc-btn dc-btn--ghost"
            onClick={() => {
              setErrors([]);
              lead.goBack();
            }}
          >
            {CM_PLANNER.backLabel}
          </button>
        ) : showClose && onClose ? (
          <button type="button" className="dc-btn dc-btn--ghost" onClick={onClose}>
            Close
          </button>
        ) : (
          <span />
        )}

        {lead.step < 4 ? (
          <button type="button" className="dc-btn dc-btn--primary" onClick={handleContinue}>
            {CM_PLANNER.continueLabel}
          </button>
        ) : (
          <button type="submit" className="dc-btn dc-btn--primary">
            {CM_PLANNER.submitLabel}
          </button>
        )}
      </div>
    </form>
  );
}

/** Desktop inline card — always in the hero composition on large screens. */
export function LeadPlannerInline() {
  const formId = useId();
  return (
    <aside
      id="cm-lead-planner"
      className="cm-planner cm-planner--inline"
      aria-labelledby="cm-planner-title"
    >
      <h2 id="cm-planner-title" className="cm-planner__title">
        {CM_PLANNER.title}
      </h2>
      <PlannerFormBody formId={formId} />
    </aside>
  );
}

/** Mobile bottom sheet — opens only on user intent. */
export function LeadPlannerSheet() {
  const lead = useLead();
  const formId = useId();
  const panelRef = useRef<HTMLDivElement | null>(null);
  const previouslyFocused = useRef<HTMLElement | null>(null);
  const titleId = useId();

  const open = lead.isOpen && lead.mode === "mobile-sheet";

  useEffect(() => {
    if (!open) return;

    previouslyFocused.current = document.activeElement as HTMLElement | null;
    const { overflow } = document.body.style;
    document.body.style.overflow = "hidden";

    const first = panelRef.current?.querySelector<HTMLElement>(
      "button, [href], input, select, textarea"
    );
    first?.focus();

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        lead.closePlanner();
        return;
      }
      if (event.key !== "Tab" || !panelRef.current) return;

      const focusables = panelRef.current.querySelectorAll<HTMLElement>(
        "a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled])"
      );
      if (focusables.length === 0) return;
      const firstEl = focusables[0];
      const lastEl = focusables[focusables.length - 1];
      if (event.shiftKey && document.activeElement === firstEl) {
        event.preventDefault();
        lastEl.focus();
      } else if (!event.shiftKey && document.activeElement === lastEl) {
        event.preventDefault();
        firstEl.focus();
      }
    };

    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.body.style.overflow = overflow;
      previouslyFocused.current?.focus();
    };
  }, [open, lead]);

  return (
    <>
      <button
        type="button"
        className="cm-sheet__scrim"
        data-open={open ? "" : undefined}
        hidden={!open}
        tabIndex={-1}
        aria-hidden="true"
        onClick={() => lead.closePlanner()}
      />
      <div
        ref={panelRef}
        className="cm-sheet"
        data-open={open ? "" : undefined}
        hidden={!open}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
      >
        <div className="cm-sheet__handle" aria-hidden="true" />
        <div className="cm-sheet__header">
          <h2 id={titleId} className="cm-planner__title">
            {CM_PLANNER.title}
          </h2>
          <button
            type="button"
            className="cm-sheet__close"
            onClick={() => lead.closePlanner()}
            aria-label="Close planner"
          >
            ×
          </button>
        </div>
        <PlannerFormBody
          formId={formId}
          showClose
          onClose={() => lead.closePlanner()}
        />
      </div>
    </>
  );
}
