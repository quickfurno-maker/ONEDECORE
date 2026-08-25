"use client";

import Link from "next/link";
import {
  useCallback,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  type FormEvent,
} from "react";
import { usePlan } from "../../public-site/home-r4/PlanContext";
import {
  PM_PLANNER,
  type PmPropertyId,
  type PmServiceId,
  type PmTimelineId,
} from "../../public-site/home-r4/content";
import { collectLeadFormAttribution } from "./lead-form-attribution.ts";
import {
  getServiceCommunicationConsentCopy,
  getServiceEnquiryConsentCopy,
  getWhatsappServiceConsentCopy,
  LEAD_FORM_FIELD_LIMITS,
  LEAD_FORM_HONEYPOT_FIELD,
  LEAD_FORM_PRIVACY_PATH,
  LEAD_FORM_TERMS_PATH,
} from "./lead-form-contract.ts";
import {
  fieldPathToLabel,
  getLeadFormStatusMessage,
  LEAD_FORM_PREVIEW_NOTICE,
  mapClientResultToUxState,
  validateLeadFormFields,
  type LeadFormUxState,
} from "./lead-form-errors.ts";
import {
  fingerprintLeadPayload,
  getOrCreateKey,
  resetAfterSuccess,
  resetOnPayloadChange,
  shouldReuseOnError,
} from "./lead-form-idempotency.ts";
import { submitLeadIntake } from "./lead-intake-client.ts";
import type { LeadFormMode } from "./lead-form-mode.ts";
import { getLeadFormMode } from "./lead-form-mode.ts";
import { planToLeadRequest } from "./plan-to-lead-request.ts";

export interface HomeLeadCaptureProps {
  readonly mode?: LeadFormMode;
}

export function HomeLeadCapture({ mode: modeProp }: HomeLeadCaptureProps) {
  const mode = modeProp ?? getLeadFormMode();
  const plan = usePlan();
  const formId = useId();
  const errorRef = useRef<HTMLDivElement>(null);

  const [name, setName] = useState(plan.name);
  const [mobile, setMobile] = useState(plan.mobile);
  const [email, setEmail] = useState("");
  const [locality, setLocality] = useState(plan.locality);
  const [message, setMessage] = useState(plan.message);
  const [honeypot, setHoneypot] = useState("");
  const [serviceEnquiryConsent, setServiceEnquiryConsent] = useState(false);
  const [servicePhoneConsent, setServicePhoneConsent] = useState(false);
  const [serviceEmailConsent, setServiceEmailConsent] = useState(false);
  const [whatsappConsent, setWhatsappConsent] = useState(false);
  const [formStartedAt] = useState(() => new Date().toISOString());
  const [uxState, setUxState] = useState<LeadFormUxState>("idle");
  const [clientErrors, setClientErrors] = useState<readonly string[]>([]);
  const [serverFields, setServerFields] = useState<readonly string[]>([]);
  const [retryAfterSeconds, setRetryAfterSeconds] = useState<number | undefined>(
    undefined
  );
  const [submissionReference, setSubmissionReference] = useState<
    string | undefined
  >(undefined);
  const submittingRef = useRef(false);

  const serviceEnquiryCopy = useMemo(() => getServiceEnquiryConsentCopy(), []);
  const serviceCommunicationCopy = useMemo(
    () => getServiceCommunicationConsentCopy(),
    []
  );
  const whatsappCopy = useMemo(() => getWhatsappServiceConsentCopy(), []);

  useEffect(() => {
    if (clientErrors.length > 0 || serverFields.length > 0) {
      errorRef.current?.focus();
    }
  }, [clientErrors, serverFields]);

  const hasEmail = email.trim().length > 0;

  const onEmailChange = useCallback((value: string) => {
    setEmail(value);
    if (!value.trim()) {
      setServiceEmailConsent(false);
    }
  }, []);

  const statusMessage = getLeadFormStatusMessage(uxState, {
    retryAfterSeconds,
    validationFields: serverFields,
    submissionReference,
  });

  if (mode === "copy-only") {
    return null;
  }

  const isSubmitting = uxState === "submitting";
  const isSuccess =
    uxState === "success-created" || uxState === "success-duplicate";
  const canSubmit = mode === "active" && !isSubmitting && !isSuccess;

  const onSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!canSubmit || submittingRef.current) return;

    setClientErrors([]);
    setServerFields([]);
    setRetryAfterSeconds(undefined);
    setSubmissionReference(undefined);
    setUxState("validating");

    const fieldErrors = validateLeadFormFields({
      name,
      mobile,
      email,
      locality,
      message,
      serviceEnquiryConsent,
      servicePhoneConsent,
      serviceEmailConsent,
      hasEmail,
    });

    if (fieldErrors.length > 0) {
      setClientErrors(fieldErrors);
      setUxState("validation-error");
      return;
    }

    if (!plan.service || !plan.property || !plan.timeline) {
      setClientErrors([
        "Choose your service, property type and timeline below before submitting.",
      ]);
      setUxState("validation-error");
      return;
    }

    submittingRef.current = true;
    setUxState("submitting");

    const attribution = collectLeadFormAttribution();
    const draft = planToLeadRequest({
      plan,
      name,
      mobile,
      email: hasEmail ? email : undefined,
      locality,
      message,
      consent: {
        serviceEnquiry: true,
        servicePhone: true,
        ...(hasEmail && serviceEmailConsent
          ? { serviceEmail: true as const }
          : {}),
        ...(whatsappConsent ? { whatsappService: true } : {}),
      },
      attribution,
      antiBot: {
        website: honeypot,
        formStartedAt,
      },
      idempotencyKey: "00000000-0000-4000-8000-000000000000",
    });

    if (!draft.ok) {
      setServerFields(draft.fields);
      setUxState("validation-error");
      submittingRef.current = false;
      return;
    }

    const fingerprint = fingerprintLeadPayload(draft.body);
    resetOnPayloadChange(fingerprint);
    const idempotencyKey = getOrCreateKey(fingerprint);
    const body = { ...draft.body, idempotencyKey };

    const result = await submitLeadIntake(body);

    if (
      result.kind === "success-created" ||
      result.kind === "success-duplicate"
    ) {
      resetAfterSuccess();
      setSubmissionReference(result.submissionReference);
      setUxState(mapClientResultToUxState(result));
      submittingRef.current = false;
      return;
    }

    if (!shouldReuseOnError(result.httpStatus)) {
      resetAfterSuccess();
    }

    if (result.kind === "rate-limited") {
      setRetryAfterSeconds(result.retryAfterSeconds);
    }
    if (result.kind === "validation-error" && result.fields?.length) {
      setServerFields(result.fields);
    }

    setUxState(mapClientResultToUxState(result));
    submittingRef.current = false;
  };

  const displayErrors =
    clientErrors.length > 0
      ? clientErrors
      : serverFields.map(
          (field) => `${fieldPathToLabel(field)} could not be accepted.`
        );

  return (
    <form
      className="pm-close__form"
      onSubmit={(event) => void onSubmit(event)}
      aria-busy={isSubmitting}
      noValidate
    >
      {mode === "preview" ? (
        <p className="pm-close__form-notice" role="note">
          {LEAD_FORM_PREVIEW_NOTICE}
        </p>
      ) : null}

      {(displayErrors.length > 0 && uxState === "validation-error") ||
      (statusMessage?.isError && uxState !== "validation-error") ? (
        <div
          ref={errorRef}
          className="pm-errors"
          role="alert"
          tabIndex={-1}
        >
          {displayErrors.length > 0 && uxState === "validation-error" ? (
            <>
              <p className="pm-errors__title">Please fix the following:</p>
              <ul>
                {displayErrors.map((error) => (
                  <li key={error}>{error}</li>
                ))}
              </ul>
            </>
          ) : statusMessage ? (
            <>
              <p className="pm-errors__title">{statusMessage.title}</p>
              {statusMessage.body ? <p>{statusMessage.body}</p> : null}
            </>
          ) : null}
        </div>
      ) : null}

      {statusMessage && !statusMessage.isError ? (
        <p className="pm-close__form-success" role="status" aria-live="polite">
          {statusMessage.title}
          {statusMessage.body ? (
            <>
              {" "}
              <span>{statusMessage.body}</span>
            </>
          ) : null}
        </p>
      ) : null}

      <fieldset className="pm-fieldset" disabled={isSubmitting || isSuccess}>
        <legend className="pm-legend">Your contact details</legend>

        <div className="pm-field">
          <label htmlFor={`${formId}-name`}>Full name</label>
          <input
            id={`${formId}-name`}
            name="name"
            type="text"
            autoComplete="name"
            required
            minLength={LEAD_FORM_FIELD_LIMITS.nameMin}
            maxLength={LEAD_FORM_FIELD_LIMITS.nameMax}
            value={name}
            aria-invalid={uxState === "validation-error" && !name.trim()}
            onChange={(event) => setName(event.target.value)}
          />
        </div>

        <div className="pm-field">
          <label htmlFor={`${formId}-mobile`}>Mobile number</label>
          <input
            id={`${formId}-mobile`}
            name="mobile"
            type="tel"
            autoComplete="tel"
            inputMode="tel"
            required
            placeholder="+91…"
            value={mobile}
            aria-invalid={uxState === "validation-error" && !mobile.trim()}
            aria-describedby={`${formId}-mobile-hint`}
            onChange={(event) => setMobile(event.target.value)}
          />
          <p id={`${formId}-mobile-hint`} className="pm-close__field-hint">
            Include country code, e.g. +91 for India.
          </p>
        </div>

        <div className="pm-field">
          <label htmlFor={`${formId}-email`}>
            Email <span className="pm-opt">optional</span>
          </label>
          <input
            id={`${formId}-email`}
            name="email"
            type="email"
            autoComplete="email"
            inputMode="email"
            maxLength={LEAD_FORM_FIELD_LIMITS.emailMax}
            value={email}
            onChange={(event) => onEmailChange(event.target.value)}
          />
        </div>
      </fieldset>

      <fieldset
        className="pm-fieldset pm-close__plan-fields"
        disabled={isSubmitting || isSuccess}
      >
        <legend className="pm-legend">Your interior need</legend>
        <p className="pm-close__field-hint">
          Required for a consultation request. Selections update your interior plan.
        </p>

        <div className="pm-field">
          <label htmlFor={`${formId}-service`}>What are you looking for?</label>
          <select
            id={`${formId}-service`}
            name="service"
            required
            value={plan.service ?? ""}
            aria-invalid={uxState === "validation-error" && !plan.service}
            onChange={(event) => {
              const value = event.target.value;
              if (value) plan.setService(value as PmServiceId);
            }}
          >
            <option value="" disabled>
              Select a service
            </option>
            {PM_PLANNER.services.map((option) => (
              <option key={option.id} value={option.id}>
                {option.label}
              </option>
            ))}
          </select>
        </div>

        <div className="pm-field">
          <label htmlFor={`${formId}-property`}>Property type</label>
          <select
            id={`${formId}-property`}
            name="property"
            required
            value={plan.property ?? ""}
            aria-invalid={uxState === "validation-error" && !plan.property}
            onChange={(event) => {
              const value = event.target.value;
              if (value) plan.setProperty(value as PmPropertyId);
            }}
          >
            <option value="" disabled>
              Select property type
            </option>
            {PM_PLANNER.properties.map((option) => (
              <option key={option.id} value={option.id}>
                {option.label}
              </option>
            ))}
          </select>
        </div>

        <div className="pm-field">
          <label htmlFor={`${formId}-timeline`}>Timeline</label>
          <select
            id={`${formId}-timeline`}
            name="timeline"
            required
            value={plan.timeline ?? ""}
            aria-invalid={uxState === "validation-error" && !plan.timeline}
            onChange={(event) => {
              const value = event.target.value;
              if (value) plan.setTimeline(value as PmTimelineId);
            }}
          >
            <option value="" disabled>
              Select a timeline
            </option>
            {PM_PLANNER.timelines.map((option) => (
              <option key={option.id} value={option.id}>
                {option.label}
              </option>
            ))}
          </select>
        </div>
      </fieldset>

      <fieldset className="pm-fieldset" disabled={isSubmitting || isSuccess}>
        <legend className="pm-legend">Optional details</legend>

        <div className="pm-field">
          <label htmlFor={`${formId}-locality`}>
            Locality <span className="pm-opt">optional</span>
          </label>
          <input
            id={`${formId}-locality`}
            name="locality"
            type="text"
            autoComplete="address-level2"
            maxLength={LEAD_FORM_FIELD_LIMITS.localityMax}
            value={locality}
            onChange={(event) => setLocality(event.target.value)}
          />
        </div>

        <div className="pm-field">
          <label htmlFor={`${formId}-message`}>
            Message <span className="pm-opt">optional</span>
          </label>
          <textarea
            id={`${formId}-message`}
            name="message"
            rows={3}
            maxLength={LEAD_FORM_FIELD_LIMITS.messageMax}
            value={message}
            onChange={(event) => setMessage(event.target.value)}
          />
        </div>
      </fieldset>

      <fieldset
        className="pm-fieldset pm-close__consent"
        disabled={isSubmitting || isSuccess}
      >
        <legend className="pm-legend">Consent</legend>

        <label className="pm-close__consent-item">
          <input
            type="checkbox"
            name="consentServiceEnquiry"
            checked={serviceEnquiryConsent}
            required
            onChange={(event) => setServiceEnquiryConsent(event.target.checked)}
          />
          <span>
            {serviceEnquiryCopy}{" "}
            <Link href={LEAD_FORM_PRIVACY_PATH}>Privacy Policy</Link> and{" "}
            <Link href={LEAD_FORM_TERMS_PATH}>Terms of Use</Link> apply.
          </span>
        </label>

        <label className="pm-close__consent-item">
          <input
            type="checkbox"
            name="consentServicePhone"
            checked={servicePhoneConsent}
            required
            onChange={(event) => setServicePhoneConsent(event.target.checked)}
          />
          <span>{serviceCommunicationCopy}</span>
        </label>

        {hasEmail ? (
          <label className="pm-close__consent-item">
            <input
              type="checkbox"
              name="consentServiceEmail"
              checked={serviceEmailConsent}
              required
              onChange={(event) => setServiceEmailConsent(event.target.checked)}
            />
            <span>{serviceCommunicationCopy}</span>
          </label>
        ) : null}

        <label className="pm-close__consent-item">
          <input
            type="checkbox"
            name="consentWhatsapp"
            checked={whatsappConsent}
            onChange={(event) => setWhatsappConsent(event.target.checked)}
          />
          <span>{whatsappCopy}</span>
        </label>
      </fieldset>

      <div className="pm-close__form-honeypot" aria-hidden="true">
        <label htmlFor={`${formId}-website`}>Website</label>
        <input
          id={`${formId}-website`}
          name={LEAD_FORM_HONEYPOT_FIELD}
          type="text"
          tabIndex={-1}
          autoComplete="off"
          value={honeypot}
          onChange={(event) => setHoneypot(event.target.value)}
        />
      </div>

      <div className="pm-close__form-actions">
        <button
          type="submit"
          className="dc-btn dc-btn--primary pm-btn--sheen"
          disabled={!canSubmit}
          data-conversion-action="lead-submit"
        >
          {isSubmitting ? "Submitting…" : "Submit enquiry"}
        </button>
      </div>
    </form>
  );
}
