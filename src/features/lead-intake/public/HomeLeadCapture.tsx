"use client";

import Link from "next/link";
import {
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  type FormEvent,
  type ReactNode,
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
  type LeadFormFieldErrors,
  type LeadFormFieldKey,
  type LeadFormUxState,
} from "./lead-form-errors.ts";
import {
  acceptIndianMobileInput,
  acceptIndianMobileKeystroke,
  INDIAN_MOBILE_HELPER,
  INDIAN_MOBILE_INVALID_MESSAGE,
} from "./indian-mobile.ts";
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

function pulseInvalidHaptic(): void {
  if (typeof navigator === "undefined") return;
  if (typeof navigator.vibrate !== "function") return;
  try {
    navigator.vibrate([45, 30, 45]);
  } catch {
    // Unsupported / blocked — validation UX still works without haptics.
  }
}

function initialNationalMobile(raw: string): string {
  const accepted = acceptIndianMobileInput(raw);
  if (accepted.ok) return accepted.national;
  if (/^\d{0,10}$/.test(raw.trim())) return raw.trim();
  return "";
}

export function HomeLeadCapture({ mode: modeProp }: HomeLeadCaptureProps) {
  const mode = modeProp ?? getLeadFormMode();
  const plan = usePlan();
  const formId = useId();
  const summaryRef = useRef<HTMLDivElement>(null);
  const shakeClearRef = useRef<number | null>(null);
  const nameRef = useRef<HTMLInputElement>(null);
  const mobileRef = useRef<HTMLInputElement>(null);
  const serviceRef = useRef<HTMLSelectElement>(null);
  const propertyRef = useRef<HTMLSelectElement>(null);
  const timelineRef = useRef<HTMLSelectElement>(null);
  const serviceEnquiryConsentRef = useRef<HTMLInputElement>(null);
  const servicePhoneConsentRef = useRef<HTMLInputElement>(null);

  const fieldRefs: Record<
    LeadFormFieldKey,
    React.RefObject<HTMLElement | null>
  > = {
    name: nameRef,
    mobile: mobileRef,
    service: serviceRef,
    property: propertyRef,
    // The legacy planner has no qualifier control; it collects property and
    // timeline directly. The key exists so the shared vocabulary stays total.
    qualifier: propertyRef,
    timeline: timelineRef,
    serviceEnquiryConsent: serviceEnquiryConsentRef,
    servicePhoneConsent: servicePhoneConsentRef,
  };

  const [name, setName] = useState(plan.name);
  const [mobile, setMobile] = useState(() => initialNationalMobile(plan.mobile));
  const [locality, setLocality] = useState(plan.locality);
  const [message, setMessage] = useState(plan.message);
  const [honeypot, setHoneypot] = useState("");
  const [serviceEnquiryConsent, setServiceEnquiryConsent] = useState(false);
  const [servicePhoneConsent, setServicePhoneConsent] = useState(false);
  const [whatsappConsent, setWhatsappConsent] = useState(false);
  const [formStartedAt] = useState(() => new Date().toISOString());
  const [uxState, setUxState] = useState<LeadFormUxState>("idle");
  const [fieldErrors, setFieldErrors] = useState<LeadFormFieldErrors>({});
  const [clientSummary, setClientSummary] = useState<readonly string[]>([]);
  const [serverFields, setServerFields] = useState<readonly string[]>([]);
  const [shakeField, setShakeField] = useState<LeadFormFieldKey | null>(null);
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
    if (plan.service) return;
    const frame = window.requestAnimationFrame(() => {
      const raw = new URLSearchParams(window.location.search).get("service");
      if (!raw) return;
      if (PM_PLANNER.services.some((row) => row.id === raw)) {
        plan.setService(raw as PmServiceId);
      }
    });
    return () => window.cancelAnimationFrame(frame);
  }, [plan]);

  useEffect(() => {
    return () => {
      if (shakeClearRef.current != null) {
        window.clearTimeout(shakeClearRef.current);
      }
    };
  }, []);

  const clearFieldError = (key: LeadFormFieldKey) => {
    setFieldErrors((prev) => {
      if (!prev[key]) return prev;
      const next = { ...prev };
      delete next[key];
      return next;
    });
  };

  const focusFirstInvalid = (key: LeadFormFieldKey) => {
    const node = fieldRefs[key].current;
    if (!node) {
      summaryRef.current?.focus();
      return;
    }
    node.focus();
    node.scrollIntoView({ block: "center", behavior: "smooth" });
  };

  const triggerInvalidFeedback = (key: LeadFormFieldKey) => {
    pulseInvalidHaptic();
    setShakeField(key);
    if (shakeClearRef.current != null) {
      window.clearTimeout(shakeClearRef.current);
    }
    shakeClearRef.current = window.setTimeout(() => {
      setShakeField(null);
      shakeClearRef.current = null;
    }, 350);
    window.requestAnimationFrame(() => focusFirstInvalid(key));
  };

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
  const canAttemptSubmit = !isSubmitting && !isSuccess;
  const canNetworkSubmit = mode === "active" && canAttemptSubmit;

  const applyMobileRaw = (raw: string) => {
    const accepted = acceptIndianMobileKeystroke(raw);
    if (!accepted.ok) {
      const paste = acceptIndianMobileInput(raw);
      if (paste.ok) {
        setMobile(paste.national);
        clearFieldError("mobile");
        return;
      }
      setFieldErrors((prev) => ({
        ...prev,
        mobile: INDIAN_MOBILE_INVALID_MESSAGE,
      }));
      return;
    }
    setMobile(accepted.national);
    if (
      accepted.national.length === 0 ||
      accepted.national.length === 10
    ) {
      clearFieldError("mobile");
    }
  };

  const onSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!canAttemptSubmit || submittingRef.current) return;

    setClientSummary([]);
    setServerFields([]);
    setRetryAfterSeconds(undefined);
    setSubmissionReference(undefined);
    setUxState("validating");

    const validation = validateLeadFormFields({
      name,
      mobile,
      locality,
      message,
      serviceEnquiryConsent,
      servicePhoneConsent,
      service: plan.service,
      property: plan.property,
      timeline: plan.timeline,
    });

    if (!validation.ok) {
      setFieldErrors(validation.fields);
      setClientSummary(validation.messages);
      setUxState("validation-error");
      if (validation.firstInvalid) {
        triggerInvalidFeedback(validation.firstInvalid);
      }
      return;
    }

    setFieldErrors({});
    setClientSummary([]);

    // Preview: client validation only — never call intake.
    if (!canNetworkSubmit) {
      setUxState("idle");
      return;
    }

    submittingRef.current = true;
    setUxState("submitting");

    const attribution = collectLeadFormAttribution();
    const draft = planToLeadRequest({
      plan,
      name,
      mobile,
      locality,
      message,
      consent: {
        serviceEnquiry: true,
        servicePhone: true,
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
      summaryRef.current?.focus();
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

  const serverSummary =
    serverFields.length > 0
      ? serverFields.map(
          (field) => `${fieldPathToLabel(field)} could not be accepted.`
        )
      : [];

  const showSummary =
    (clientSummary.length > 0 && uxState === "validation-error") ||
    (statusMessage?.isError && uxState !== "validation-error") ||
    (serverSummary.length > 0 && uxState === "validation-error");

  const fieldClass = (key: LeadFormFieldKey) => {
    const parts = ["pm-field"];
    if (fieldErrors[key]) parts.push("pm-field--invalid");
    if (shakeField === key) parts.push("pm-field--shake");
    return parts.join(" ");
  };

  const consentClass = (key: LeadFormFieldKey) => {
    const parts = ["pm-close__consent-item"];
    if (fieldErrors[key]) parts.push("pm-close__consent-item--invalid");
    if (shakeField === key) parts.push("pm-field--shake");
    return parts.join(" ");
  };

  const describedBy = (key: LeadFormFieldKey, extra?: string) => {
    const ids: string[] = [];
    if (extra) ids.push(extra);
    if (fieldErrors[key]) ids.push(`${formId}-${key}-error`);
    return ids.length > 0 ? ids.join(" ") : undefined;
  };

  const errorText = (key: LeadFormFieldKey): ReactNode =>
    fieldErrors[key] ? (
      <p id={`${formId}-${key}-error`} className="pm-field__error" role="alert">
        {fieldErrors[key]}
      </p>
    ) : null;

  return (
    <form
      className="pm-close__form"
      onSubmit={(event) => void onSubmit(event)}
      aria-busy={isSubmitting}
      noValidate
      data-od-lead-phone-ux="national-10"
    >
      {mode === "preview" ? (
        <p className="pm-close__form-notice" role="note">
          {LEAD_FORM_PREVIEW_NOTICE}
        </p>
      ) : null}

      {showSummary ? (
        <div
          ref={summaryRef}
          className="pm-errors"
          role="alert"
          aria-live="assertive"
          tabIndex={-1}
        >
          {clientSummary.length > 0 && uxState === "validation-error" ? (
            <>
              <p className="pm-errors__title">Please fix the following:</p>
              <ul>
                {clientSummary.map((error) => (
                  <li key={error}>{error}</li>
                ))}
              </ul>
            </>
          ) : serverSummary.length > 0 && uxState === "validation-error" ? (
            <>
              <p className="pm-errors__title">Please fix the following:</p>
              <ul>
                {serverSummary.map((error) => (
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

        <div className={fieldClass("name")}>
          <label htmlFor={`${formId}-name`}>Full name</label>
          <input
            ref={nameRef}
            id={`${formId}-name`}
            name="name"
            type="text"
            autoComplete="name"
            required
            minLength={LEAD_FORM_FIELD_LIMITS.nameMin}
            maxLength={LEAD_FORM_FIELD_LIMITS.nameMax}
            value={name}
            aria-invalid={Boolean(fieldErrors.name)}
            aria-describedby={describedBy("name")}
            onChange={(event) => {
              setName(event.target.value);
              clearFieldError("name");
            }}
          />
          {errorText("name")}
        </div>

        <div className={fieldClass("mobile")}>
          <label htmlFor={`${formId}-mobile`}>Mobile number</label>
          <input
            ref={mobileRef}
            id={`${formId}-mobile`}
            name="mobile"
            type="tel"
            autoComplete="tel-national"
            inputMode="numeric"
            pattern="[6-9][0-9]{9}"
            maxLength={10}
            required
            placeholder="10-digit mobile"
            value={mobile}
            aria-invalid={Boolean(fieldErrors.mobile)}
            aria-describedby={describedBy("mobile", `${formId}-mobile-hint`)}
            onChange={(event) => applyMobileRaw(event.target.value)}
            onPaste={(event) => {
              const text = event.clipboardData.getData("text");
              const accepted = acceptIndianMobileInput(text);
              if (accepted.ok) {
                event.preventDefault();
                setMobile(accepted.national);
                clearFieldError("mobile");
                return;
              }
              // Let onChange handle digit-only pastes; block ambiguous truncating pastes.
              const compacted = text.replace(/[\s\-().]/g, "");
              if (/\D/.test(compacted) || compacted.length > 10) {
                event.preventDefault();
                setFieldErrors((prev) => ({
                  ...prev,
                  mobile: INDIAN_MOBILE_INVALID_MESSAGE,
                }));
              }
            }}
          />
          <p id={`${formId}-mobile-hint`} className="pm-close__field-hint">
            {INDIAN_MOBILE_HELPER}
          </p>
          {errorText("mobile")}
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

        <div className={fieldClass("service")}>
          <label htmlFor={`${formId}-service`}>What are you looking for?</label>
          <select
            ref={serviceRef}
            id={`${formId}-service`}
            name="service"
            required
            value={plan.service ?? ""}
            aria-invalid={Boolean(fieldErrors.service)}
            aria-describedby={describedBy("service")}
            onChange={(event) => {
              const value = event.target.value;
              if (value) plan.setService(value as PmServiceId);
              clearFieldError("service");
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
          {errorText("service")}
        </div>

        <div className={fieldClass("property")}>
          <label htmlFor={`${formId}-property`}>Property type</label>
          <select
            ref={propertyRef}
            id={`${formId}-property`}
            name="property"
            required
            value={plan.property ?? ""}
            aria-invalid={Boolean(fieldErrors.property)}
            aria-describedby={describedBy("property")}
            onChange={(event) => {
              const value = event.target.value;
              if (value) plan.setProperty(value as PmPropertyId);
              clearFieldError("property");
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
          {errorText("property")}
        </div>

        <div className={fieldClass("timeline")}>
          <label htmlFor={`${formId}-timeline`}>Timeline</label>
          <select
            ref={timelineRef}
            id={`${formId}-timeline`}
            name="timeline"
            required
            value={plan.timeline ?? ""}
            aria-invalid={Boolean(fieldErrors.timeline)}
            aria-describedby={describedBy("timeline")}
            onChange={(event) => {
              const value = event.target.value;
              if (value) plan.setTimeline(value as PmTimelineId);
              clearFieldError("timeline");
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
          {errorText("timeline")}
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

        <label className={consentClass("serviceEnquiryConsent")}>
          <input
            ref={serviceEnquiryConsentRef}
            type="checkbox"
            name="consentServiceEnquiry"
            checked={serviceEnquiryConsent}
            required
            aria-invalid={Boolean(fieldErrors.serviceEnquiryConsent)}
            aria-describedby={describedBy("serviceEnquiryConsent")}
            onChange={(event) => {
              setServiceEnquiryConsent(event.target.checked);
              clearFieldError("serviceEnquiryConsent");
            }}
          />
          <span>
            {serviceEnquiryCopy}{" "}
            <Link href={LEAD_FORM_PRIVACY_PATH}>Privacy Policy</Link> and{" "}
            <Link href={LEAD_FORM_TERMS_PATH}>Terms of Use</Link> apply.
          </span>
        </label>
        {errorText("serviceEnquiryConsent")}

        <label className={consentClass("servicePhoneConsent")}>
          <input
            ref={servicePhoneConsentRef}
            type="checkbox"
            name="consentServicePhone"
            checked={servicePhoneConsent}
            required
            aria-invalid={Boolean(fieldErrors.servicePhoneConsent)}
            aria-describedby={describedBy("servicePhoneConsent")}
            onChange={(event) => {
              setServicePhoneConsent(event.target.checked);
              clearFieldError("servicePhoneConsent");
            }}
          />
          <span>{serviceCommunicationCopy}</span>
        </label>
        {errorText("servicePhoneConsent")}

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
          disabled={!canAttemptSubmit}
          data-conversion-action="lead-submit"
        >
          {isSubmitting ? "Submitting…" : "Submit enquiry"}
        </button>
      </div>
    </form>
  );
}
