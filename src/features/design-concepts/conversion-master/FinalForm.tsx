"use client";

import Link from "next/link";
import { useId, useRef, useState, type FormEvent } from "react";
import {
  CM_FINAL_FORM,
  CM_PLANNER,
  CM_SECTION_IDS,
  type CmPropertyId,
  type CmServiceId,
  type CmTimelineId,
} from "./content";
import { useLead } from "./LeadContext";

const INDIAN_MOBILE = /^[6-9]\d{9}$/;

export function FinalForm() {
  const lead = useLead();
  const formId = useId();
  const errorRef = useRef<HTMLDivElement | null>(null);
  const [errors, setErrors] = useState<string[]>([]);
  const [message, setMessage] = useState("");
  const [done, setDone] = useState(false);
  const [name, setName] = useState(lead.name);
  const [mobile, setMobile] = useState(lead.mobile);
  const [locality, setLocality] = useState(lead.locality);
  const [service, setService] = useState<CmServiceId | null>(lead.service);
  const [property, setProperty] = useState<CmPropertyId | null>(lead.property);
  const [timeline, setTimeline] = useState<CmTimelineId | null>(lead.timeline);
  const [whatsappConsent, setWhatsappConsent] = useState(lead.whatsappConsent);

  const validate = (): string[] => {
    const next: string[] = [];
    if (!name.trim()) next.push("Name is required.");
    if (!INDIAN_MOBILE.test(mobile.trim())) {
      next.push("Enter a valid 10-digit Indian mobile number.");
    }
    if (!locality.trim()) next.push("Pune locality is required.");
    if (!service) next.push("Select a service.");
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

    lead.setContact({
      name: name.trim(),
      mobile: mobile.trim(),
      locality: locality.trim(),
      whatsappConsent,
    });
    if (service) lead.setService(service);
    if (property) lead.setProperty(property);
    if (timeline) lead.setTimeline(timeline);
    setDone(true);
  };

  return (
    <section
      id={CM_SECTION_IDS.consult}
      className="cm-section cm-final"
      aria-labelledby="cm-final-title"
    >
      <div className="dc-container cm-final__grid">
        <div className="cm-final__intro">
          <p className="dc-eyebrow">{CM_FINAL_FORM.overline}</p>
          <h2 id="cm-final-title" className="cm-h2">
            {CM_FINAL_FORM.heading}
          </h2>
          <p className="dc-lede">{CM_FINAL_FORM.lede}</p>
          <Link href={CM_FINAL_FORM.secondaryHref} className="dc-textlink">
            {CM_FINAL_FORM.secondaryLabel}
          </Link>
        </div>

        <div className="cm-final__panel">
          {done ? (
            <div className="cm-planner__success" role="status">
              <h3 className="cm-planner__successTitle">
                {CM_FINAL_FORM.successTitle}
              </h3>
              <p className="cm-planner__successBody">{CM_FINAL_FORM.successBody}</p>
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

              <div className="cm-field">
                <label htmlFor={`${formId}-name`}>
                  Name <span className="cm-req">required</span>
                </label>
                <input
                  id={`${formId}-name`}
                  type="text"
                  autoComplete="name"
                  value={name}
                  onChange={(event) => setName(event.target.value)}
                  required
                />
              </div>

              <div className="cm-field">
                <label htmlFor={`${formId}-mobile`}>
                  Mobile number <span className="cm-req">required</span>
                </label>
                <input
                  id={`${formId}-mobile`}
                  type="tel"
                  inputMode="numeric"
                  autoComplete="tel-national"
                  maxLength={10}
                  value={mobile}
                  onChange={(event) =>
                    setMobile(event.target.value.replace(/\D/g, "").slice(0, 10))
                  }
                  required
                />
              </div>

              <div className="cm-field">
                <label htmlFor={`${formId}-locality`}>
                  Pune locality <span className="cm-req">required</span>
                </label>
                <input
                  id={`${formId}-locality`}
                  type="text"
                  value={locality}
                  onChange={(event) => setLocality(event.target.value)}
                  required
                />
              </div>

              <fieldset className="cm-fieldset">
                <legend className="cm-legend">
                  Service <span className="cm-req">required</span>
                </legend>
                <div className="cm-options">
                  {CM_PLANNER.services.map((option) => (
                    <label
                      key={option.id}
                      className="cm-option"
                      data-selected={service === option.id ? "" : undefined}
                    >
                      <input
                        type="radio"
                        name="final-service"
                        checked={service === option.id}
                        onChange={() => setService(option.id)}
                      />
                      <span>{option.label}</span>
                    </label>
                  ))}
                </div>
              </fieldset>

              <fieldset className="cm-fieldset">
                <legend className="cm-legend">
                  Property type <span className="cm-opt">optional</span>
                </legend>
                <div className="cm-options">
                  {CM_PLANNER.properties.map((option) => (
                    <label
                      key={option.id}
                      className="cm-option"
                      data-selected={property === option.id ? "" : undefined}
                    >
                      <input
                        type="radio"
                        name="final-property"
                        checked={property === option.id}
                        onChange={() => setProperty(option.id)}
                      />
                      <span>{option.label}</span>
                    </label>
                  ))}
                </div>
              </fieldset>

              <fieldset className="cm-fieldset">
                <legend className="cm-legend">
                  Timeline <span className="cm-opt">optional</span>
                </legend>
                <div className="cm-options">
                  {CM_PLANNER.timelines.map((option) => (
                    <label
                      key={option.id}
                      className="cm-option"
                      data-selected={timeline === option.id ? "" : undefined}
                    >
                      <input
                        type="radio"
                        name="final-timeline"
                        checked={timeline === option.id}
                        onChange={() => setTimeline(option.id)}
                      />
                      <span>{option.label}</span>
                    </label>
                  ))}
                </div>
              </fieldset>

              <div className="cm-field">
                <label htmlFor={`${formId}-message`}>
                  Message <span className="cm-opt">optional</span>
                </label>
                <textarea
                  id={`${formId}-message`}
                  rows={4}
                  value={message}
                  onChange={(event) => setMessage(event.target.value)}
                />
              </div>

              <label className="cm-check">
                <input
                  type="checkbox"
                  checked={whatsappConsent}
                  onChange={(event) => setWhatsappConsent(event.target.checked)}
                />
                <span>
                  {CM_FINAL_FORM.whatsappConsentLabel}{" "}
                  <span className="cm-opt">optional</span>
                </span>
              </label>

              <div className="cm-final__actions">
                <button type="submit" className="dc-btn dc-btn--primary">
                  {CM_FINAL_FORM.submitLabel}
                </button>
                <Link
                  href={CM_FINAL_FORM.secondaryHref}
                  className="dc-btn dc-btn--ghost"
                >
                  {CM_FINAL_FORM.secondaryLabel}
                </Link>
              </div>
            </form>
          )}
        </div>
      </div>
    </section>
  );
}
