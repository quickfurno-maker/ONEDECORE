"use client";

import Link from "next/link";
import { useId, useMemo, useRef, useState, type FormEvent } from "react";
import { PM_CLOSE, PM_PLANNER, PM_SECTION_IDS } from "./content";
import { usePlan } from "./PlanContext";
import { validateContact } from "./plan-state";

function labelOf(
  options: readonly { readonly id: string; readonly label: string }[],
  id: string | null
): string | null {
  if (!id) return null;
  return options.find((option) => option.id === id)?.label ?? null;
}

/**
 * Final conversion — summary + contact completion on the shared plan state.
 * No option grids; prototype only (no network submit).
 */
export function PmClose() {
  const plan = usePlan();
  const formId = useId();
  const errorRef = useRef<HTMLDivElement | null>(null);
  const [errors, setErrors] = useState<readonly string[]>([]);

  const rows = useMemo(() => {
    const rooms =
      plan.rooms.length > 0
        ? plan.rooms
            .map((id) => labelOf(PM_PLANNER.rooms, id))
            .filter(Boolean)
            .join(", ")
        : null;

    return [
      { label: "Service", value: labelOf(PM_PLANNER.services, plan.service) },
      { label: "Property", value: labelOf(PM_PLANNER.properties, plan.property) },
      { label: "Timeline", value: labelOf(PM_PLANNER.timelines, plan.timeline) },
      { label: "Rooms", value: rooms },
      { label: "Locality", value: plan.locality.trim() || null },
    ].filter((row) => row.value);
  }, [plan.rooms, plan.service, plan.property, plan.timeline, plan.locality]);

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

  return (
    <section
      id={PM_SECTION_IDS.plan}
      className="pm-section pm-close"
      aria-labelledby="pm-close-title"
    >
      <span className="pm-close__glow" aria-hidden="true" />
      <div className="dc-container pm-close__inner">
        <div className="pm-close__intro">
          <p className="pm-eyebrow">{PM_CLOSE.eyebrow}</p>
          <h2 id="pm-close-title" className="pm-h2">
            {PM_CLOSE.heading}
          </h2>
          <p className="pm-lede">{PM_CLOSE.lede}</p>

          <div className="pm-summary pm-summary--intro">
            <div className="pm-summary__head">
              <h3 className="pm-summary__title">{PM_CLOSE.summaryHeading}</h3>
              <button
                type="button"
                className="pm-textlink pm-summary__edit"
                onClick={() => plan.openPlanner(plan.getNextIncompleteStep())}
              >
                {PM_CLOSE.editLabel}
              </button>
            </div>
            {rows.length > 0 ? (
              <dl className="pm-summary__list">
                {rows.map((row, index) => (
                  <div
                    key={row.label}
                    style={{ "--pm-line": index } as React.CSSProperties}
                  >
                    <dt>{row.label}</dt>
                    <dd>{row.value}</dd>
                  </div>
                ))}
              </dl>
            ) : (
              <p className="pm-summary__empty">{PM_PLANNER.summaryEmpty}</p>
            )}
          </div>

          <Link href={PM_CLOSE.secondaryHref} className="pm-textlink">
            {PM_CLOSE.secondaryLabel}
          </Link>
        </div>

        <div className="pm-card pm-close__panel">
          <span className="pm-card__glow" aria-hidden="true" />

          {plan.submitted ? (
            <div className="pm-planner__success" role="status">
              <h3 className="pm-planner__successTitle">{PM_CLOSE.successTitle}</h3>
              <p className="pm-planner__successBody">{PM_CLOSE.successBody}</p>
              <div className="pm-close__actions">
                <button
                  type="button"
                  className="dc-btn dc-btn--ghost"
                  onClick={() => plan.editSubmission()}
                >
                  {PM_CLOSE.editDetailsLabel}
                </button>
                <Link
                  href={PM_CLOSE.secondaryHref}
                  className="dc-btn dc-btn--primary pm-btn--sheen"
                >
                  {PM_CLOSE.secondaryLabel}
                </Link>
              </div>
            </div>
          ) : (
            <form className="pm-close__form" onSubmit={onSubmit} noValidate>
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

              <div className="pm-field">
                <label htmlFor={`${formId}-name`}>
                  {PM_PLANNER.nameLabel} <span className="pm-req">required</span>
                </label>
                <input
                  id={`${formId}-name`}
                  name="name"
                  type="text"
                  autoComplete="name"
                  value={plan.name}
                  onChange={(event) => plan.setContact({ name: event.target.value })}
                  required
                />
              </div>

              <div className="pm-field">
                <label htmlFor={`${formId}-mobile`}>
                  {PM_PLANNER.mobileLabel} <span className="pm-req">required</span>
                </label>
                <input
                  id={`${formId}-mobile`}
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
                <label htmlFor={`${formId}-locality`}>
                  {PM_PLANNER.localityLabel}{" "}
                  <span className="pm-req">required</span>
                </label>
                <input
                  id={`${formId}-locality`}
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
                <label htmlFor={`${formId}-message`}>
                  {PM_PLANNER.messageLabel}{" "}
                  <span className="pm-opt">optional</span>
                </label>
                <textarea
                  id={`${formId}-message`}
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

              <div className="pm-close__actions">
                <button
                  type="submit"
                  className="dc-btn dc-btn--primary pm-btn--lg pm-btn--sheen"
                >
                  {PM_CLOSE.submitLabel}
                </button>
                <Link
                  href={PM_CLOSE.secondaryHref}
                  className="dc-btn dc-btn--ghost pm-btn--lg"
                >
                  {PM_CLOSE.secondaryLabel}
                </Link>
              </div>
            </form>
          )}
        </div>
      </div>
    </section>
  );
}
