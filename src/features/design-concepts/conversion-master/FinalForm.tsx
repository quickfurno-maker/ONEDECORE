"use client";

import Link from "next/link";
import { useId, useMemo, useRef, useState, type FormEvent } from "react";
import {
  CM_FINAL,
  CM_PLANNER,
  CM_SCOPE,
  CM_SECTION_IDS,
} from "./content";
import { useLead } from "./LeadContext";
import { isValidIndianMobile } from "./lead-state";

function labelOf(
  options: readonly { id: string; label: string }[],
  id: string | null
): string | null {
  if (!id) return null;
  return options.find((option) => option.id === id)?.label ?? null;
}

/** ContactCompletion — final section bound to LeadContext (no local contact duplicates). */
export function FinalForm() {
  const lead = useLead();
  const formId = useId();
  const errorRef = useRef<HTMLDivElement | null>(null);
  const [errors, setErrors] = useState<string[]>([]);

  const summaryRows = useMemo(() => {
    const rooms =
      lead.rooms.length > 0
        ? lead.rooms
            .map((id) => labelOf(CM_SCOPE.rooms, id))
            .filter(Boolean)
            .join(", ")
        : null;

    return [
      { label: "Service", value: labelOf(CM_PLANNER.services, lead.service) },
      {
        label: "Property",
        value: labelOf(CM_PLANNER.properties, lead.property),
      },
      {
        label: "Timeline",
        value: labelOf(CM_PLANNER.timelines, lead.timeline),
      },
      { label: "Rooms / areas", value: rooms },
      {
        label: "Locality",
        value: lead.locality.trim() || null,
      },
    ].filter((row) => row.value);
  }, [
    lead.service,
    lead.property,
    lead.timeline,
    lead.rooms,
    lead.locality,
  ]);

  const validate = (): string[] => {
    const next: string[] = [];
    if (!lead.name.trim()) next.push("Name is required.");
    if (!isValidIndianMobile(lead.mobile)) {
      next.push("Enter a valid 10-digit Indian mobile number.");
    }
    if (!lead.locality.trim()) next.push("Pune locality is required.");
    if (!lead.privacyConsent) next.push("Privacy consent is required.");
    return next;
  };

  const onSubmit = (event: FormEvent) => {
    event.preventDefault();
    const nextErrors = validate();
    setErrors(nextErrors);
    if (nextErrors.length > 0) {
      queueMicrotask(() => errorRef.current?.focus());
      return;
    }
    lead.markSubmitted();
  };

  const editPlan = () => {
    lead.openPlanner(lead.getNextIncompleteStep());
  };

  return (
    <section
      id={CM_SECTION_IDS.consult}
      className="cm-section cm-final"
      aria-labelledby="cm-final-title"
    >
      <div className="dc-container cm-final__grid">
        <div className="cm-final__intro">
          <p className="dc-eyebrow">{CM_FINAL.overline}</p>
          <h2 id="cm-final-title" className="cm-h2">
            {CM_FINAL.heading}
          </h2>
          <p className="dc-lede">{CM_FINAL.lede}</p>
          <Link href={CM_FINAL.secondaryHref} className="dc-textlink">
            {CM_FINAL.secondaryLabel}
          </Link>
        </div>

        <div className="cm-final__panel">
          {lead.submitted ? (
            <div className="cm-planner__success cm-final__success" role="status">
              <h3 className="cm-planner__successTitle">{CM_FINAL.successTitle}</h3>
              <p className="cm-planner__successBody">{CM_FINAL.successBody}</p>
              <div className="cm-final__actions">
                <button
                  type="button"
                  className="dc-btn dc-btn--ghost"
                  onClick={() => lead.editSubmission()}
                >
                  {CM_FINAL.editDetailsLabel}
                </button>
                <Link
                  href={CM_FINAL.secondaryHref}
                  className="dc-btn dc-btn--primary"
                >
                  {CM_FINAL.secondaryLabel}
                </Link>
              </div>
            </div>
          ) : (
            <form className="cm-final__form" onSubmit={onSubmit} noValidate>
              {errors.length > 0 ? (
                <div
                  ref={errorRef}
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

              <div className="cm-final__summary">
                <div className="cm-final__summaryHead">
                  <h3 className="cm-h3">{CM_FINAL.summaryHeading}</h3>
                  <button
                    type="button"
                    className="dc-textlink cm-final__editPlan"
                    onClick={editPlan}
                  >
                    {CM_FINAL.editLabel}
                  </button>
                </div>
                {summaryRows.length > 0 ? (
                  <dl className="cm-final__summaryList">
                    {summaryRows.map((row) => (
                      <div key={row.label}>
                        <dt>{row.label}</dt>
                        <dd>{row.value}</dd>
                      </div>
                    ))}
                  </dl>
                ) : (
                  <p className="cm-final__summaryEmpty">
                    No plan details yet — edit your plan to choose a service.
                  </p>
                )}
              </div>

              <div className="cm-field">
                <label htmlFor={`${formId}-name`}>
                  {CM_FINAL.nameLabel} <span className="cm-req">required</span>
                </label>
                <input
                  id={`${formId}-name`}
                  name="name"
                  type="text"
                  autoComplete="name"
                  value={lead.name}
                  onChange={(event) =>
                    lead.setContact({ name: event.target.value })
                  }
                  required
                />
              </div>

              <div className="cm-field">
                <label htmlFor={`${formId}-mobile`}>
                  {CM_FINAL.mobileLabel}{" "}
                  <span className="cm-req">required</span>
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
                />
              </div>

              <div className="cm-field">
                <label htmlFor={`${formId}-locality`}>
                  {CM_FINAL.localityLabel}{" "}
                  <span className="cm-req">required</span>
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

              <div className="cm-field">
                <label htmlFor={`${formId}-message`}>
                  {CM_FINAL.messageLabel}{" "}
                  <span className="cm-opt">optional</span>
                </label>
                <textarea
                  id={`${formId}-message`}
                  name="message"
                  rows={4}
                  value={lead.message}
                  onChange={(event) => lead.setMessage(event.target.value)}
                />
              </div>

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
                  {CM_FINAL.privacyConsentLabel}{" "}
                  <span className="cm-req">required</span>
                </span>
              </label>

              <label className="cm-check">
                <input
                  type="checkbox"
                  checked={lead.whatsappConsent}
                  onChange={(event) =>
                    lead.setContact({ whatsappConsent: event.target.checked })
                  }
                />
                <span>
                  {CM_FINAL.whatsappConsentLabel}{" "}
                  <span className="cm-opt">optional</span>
                </span>
              </label>

              <div className="cm-final__actions">
                <button type="submit" className="dc-btn dc-btn--primary">
                  {CM_FINAL.submitLabel}
                </button>
                <Link
                  href={CM_FINAL.secondaryHref}
                  className="dc-btn dc-btn--ghost"
                >
                  {CM_FINAL.secondaryLabel}
                </Link>
              </div>
            </form>
          )}
        </div>
      </div>
    </section>
  );
}
