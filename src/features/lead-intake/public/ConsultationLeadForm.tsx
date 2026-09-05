"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import { collectLeadFormAttribution } from "./lead-form-attribution.ts";
import {
  CONSULTATION_CONTACT_LABEL,
  CONSULTATION_INTRO_HELP,
  CONSULTATION_INTRO_TITLE,
  CONSULTATION_NOTE_LABEL,
  CONSULTATION_SERVICE_HELP,
  CONSULTATION_SERVICE_LABEL,
  CONSULTATION_SERVICE_OPTIONS,
  CONSULTATION_SERVICE_PLACEHOLDER,
  CONSULTATION_STEPS,
  qualifierForService,
} from "./consultation-copy.ts";
import { consultationToLeadRequest } from "./consultation-to-lead-request.ts";
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
import { getLeadFormMode, type LeadFormMode } from "./lead-form-mode.ts";

/**
 * The public consultation form.
 *
 * SERVICE -> ONE RELEVANT QUALIFIER -> CONTACT -> CONSENT -> SUBMIT
 *
 * The previous form asked every visitor for BHK, a timeline, rooms and a budget
 * band before it would take a phone number. A kitchen enquiry was pushed through
 * a whole-home questionnaire, which is both a poor first impression and a source
 * of CRM rows full of answers nobody meant.
 *
 * This asks exactly one question per service, and the question changes with the
 * service. Nothing is asked that the chosen service does not need, and nothing
 * is sent that was not asked — see `consultation-to-lead-request.ts`.
 *
 * Every existing protection is reused unchanged: national 10-digit mobile
 * handling, honeypot, idempotency fingerprinting, attribution, consent copy
 * versioning and the shared error vocabulary.
 */
export function ConsultationLeadForm({
  mode: modeProp,
  initialService = null,
}: {
  readonly mode?: LeadFormMode;
  /** From `?service=` deep links, so a preselected service is not re-asked. */
  readonly initialService?: string | null;
}) {
  const mode = modeProp ?? getLeadFormMode();

  /*
   * The first render must be identical on the server and in the browser, so the
   * initial value comes ONLY from the explicit prop. Reading
   * `window.location.search` in the initializer would render "" on the server
   * and a chosen service on hydration — a mismatch on exactly the URLs the deep
   * link exists for.
   */
  const [service, setService] = useState<string>(() =>
    initialService && qualifierForService(initialService) ? initialService : ""
  );
  const [qualifierCode, setQualifierCode] = useState("");
  const [name, setName] = useState("");
  const [mobile, setMobile] = useState("");
  const [locality, setLocality] = useState("");
  const [message, setMessage] = useState("");
  const [noteOpen, setNoteOpen] = useState(false);
  const [serviceEnquiryConsent, setServiceEnquiryConsent] = useState(false);
  const [servicePhoneConsent, setServicePhoneConsent] = useState(false);
  const [whatsappConsent, setWhatsappConsent] = useState(false);
  const [honeypot, setHoneypot] = useState("");

  const [fieldErrors, setFieldErrors] = useState<LeadFormFieldErrors>({});
  const [clientSummary, setClientSummary] = useState<readonly string[]>([]);
  const [serverFields, setServerFields] = useState<readonly string[]>([]);
  const [uxState, setUxState] = useState<LeadFormUxState>("idle");
  const [submissionReference, setSubmissionReference] = useState<string>();
  const [retryAfterSeconds, setRetryAfterSeconds] = useState<number>();

  const submittingRef = useRef(false);
  const summaryRef = useRef<HTMLDivElement>(null);
  const [formStartedAt] = useState(() => new Date().toISOString());

  const qualifier = useMemo(() => qualifierForService(service), [service]);

  const clearFieldError = (key: LeadFormFieldKey) => {
    setFieldErrors((prev) => {
      if (!prev[key]) return prev;
      const next = { ...prev };
      delete next[key];
      return next;
    });
  };

  /*
   * A service link (`/?service=modular-kitchens#consultation`) selects that
   * service AFTER mount, so the kitchen question appears immediately instead of
   * a home-type question — without affecting the server-rendered markup.
   */
  useEffect(() => {
    if (initialService) return;
    /*
     * Deferred to a frame callback rather than set synchronously, matching the
     * legacy planner form. Two reasons: the rule against cascading renders from
     * an effect body, and — more importantly — the first paint stays byte-identical
     * to the server render, so hydration cannot mismatch.
     */
    const frame = window.requestAnimationFrame(() => {
      const raw = new URLSearchParams(window.location.search).get("service");
      if (raw && qualifierForService(raw)) {
        setService(raw);
      }
    });
    return () => window.cancelAnimationFrame(frame);
    // The deep link is read once, on mount.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /**
   * The canonical national-mobile handling, identical to the legacy form.
   *
   * `acceptIndianMobileKeystroke` takes the WHOLE candidate value, not a
   * keystroke. Passing `event.key` to it (as this form first did) blocked
   * Backspace, Delete, Tab and the arrow keys — an accessibility and conversion
   * regression. There is no keydown filter here at all.
   */
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
    if (accepted.national.length === 0 || accepted.national.length === 10) {
      clearFieldError("mobile");
    }
  };

  const isSubmitting = uxState === "submitting" || uxState === "validating";
  const isSuccess =
    uxState === "success-created" || uxState === "success-duplicate";
  // "active" is the live mode; "preview" validates locally and never posts.
  const canNetworkSubmit = mode === "active";

  /*
   * Changing the service RETIRES the previous answer.
   *
   * A 2 BHK chosen for complete-home interiors is meaningless once the visitor
   * switches to a kitchen, and carrying it across would submit an answer to a
   * question the customer was never asked under the new service. The stale error
   * goes with it, so the form does not show a complaint about a control that no
   * longer exists.
   */
  const onServiceChange = (next: string) => {
    setService(next);
    setQualifierCode("");
    clearFieldError("service");
    setFieldErrors((current) => {
      if (!current.qualifier) {
        return current;
      }
      const next = { ...current };
      delete next.qualifier;
      return next;
    });
  };

  const currentStep = !service ? 1 : !qualifierCode ? 2 : 3;

  const onSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (isSubmitting || submittingRef.current) return;

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
      service,
      // The consultation variant validates the qualifier instead of demanding a
      // property type and timeline this form never shows.
      variant: "consultation",
      qualifier: qualifierCode,
    });

    if (!validation.ok) {
      setFieldErrors(validation.fields);
      setClientSummary(validation.messages);
      setUxState("validation-error");
      summaryRef.current?.focus();
      return;
    }

    setFieldErrors({});

    // Preview mode validates locally and never calls intake.
    if (!canNetworkSubmit) {
      setUxState("idle");
      return;
    }

    submittingRef.current = true;
    setUxState("submitting");

    const draft = consultationToLeadRequest({
      service,
      qualifierCode,
      name,
      mobile,
      locality,
      message,
      consent: {
        serviceEnquiry: true,
        servicePhone: true,
        ...(whatsappConsent ? { whatsappService: true } : {}),
      },
      attribution: collectLeadFormAttribution(),
      antiBot: { website: honeypot, formStartedAt },
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
    const body = { ...draft.body, idempotencyKey: getOrCreateKey(fingerprint) };

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

  const status = getLeadFormStatusMessage(uxState, {
    submissionReference,
    retryAfterSeconds,
    validationFields: serverFields,
  });

  const summaryMessages =
    clientSummary.length > 0
      ? clientSummary
      : serverFields.map((f) => `${fieldPathToLabel(f)} could not be accepted.`);

  if (isSuccess) {
    return (
      <div className="od-consult-form" data-od-consult-state="success">
        <p className="od-consult-form__status" role="status" aria-live="polite">
          {status?.title}
        </p>
        {status?.body ? (
          <p className="od-consult-form__hint">{status.body}</p>
        ) : null}
      </div>
    );
  }

  return (
    <form
      className="od-consult-form"
      onSubmit={(event) => void onSubmit(event)}
      aria-busy={isSubmitting}
      noValidate
      data-od-lead-phone-ux="national-10"
      data-od-consult-step={currentStep}
    >
      <div className="od-consult-form__head">
        <h3 className="od-consult-form__title">{CONSULTATION_INTRO_TITLE}</h3>
        <p className="od-consult-form__hint">{CONSULTATION_INTRO_HELP}</p>
        <p className="od-consult-form__steps" aria-live="polite">
          Step {currentStep} of {CONSULTATION_STEPS.length} —{" "}
          {CONSULTATION_STEPS[currentStep - 1]}
        </p>
      </div>

      {mode === "preview" ? (
        <p className="od-consult-form__hint" role="note">
          {LEAD_FORM_PREVIEW_NOTICE}
        </p>
      ) : null}

      {summaryMessages.length > 0 && uxState === "validation-error" ? (
        <div
          ref={summaryRef}
          tabIndex={-1}
          role="alert"
          className="od-consult-form__summary"
        >
          <p>Please check the highlighted fields.</p>
          <ul>
            {summaryMessages.map((line) => (
              <li key={line}>{line}</li>
            ))}
          </ul>
        </div>
      ) : null}

      {/* STEP 1 — service */}
      <div className="od-consult-form__field">
        <label htmlFor="od-consult-service">{CONSULTATION_SERVICE_LABEL}</label>
        <select
          id="od-consult-service"
          name="service"
          value={service}
          onChange={(event) => onServiceChange(event.target.value)}
          aria-invalid={fieldErrors.service ? true : undefined}
          aria-describedby="od-consult-service-help"
        >
          <option value="">{CONSULTATION_SERVICE_PLACEHOLDER}</option>
          {CONSULTATION_SERVICE_OPTIONS.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
        <p id="od-consult-service-help" className="od-consult-form__hint">
          {CONSULTATION_SERVICE_HELP}
        </p>
        {fieldErrors.service ? (
          <p className="od-consult-form__error">{fieldErrors.service}</p>
        ) : null}
      </div>

      {/* STEP 2 — the ONE question this service needs */}
      {qualifier ? (
        <div className="od-consult-form__field">
          <label htmlFor="od-consult-qualifier">{qualifier.label}</label>
          <select
            id="od-consult-qualifier"
            name="qualifier"
            value={qualifierCode}
            onChange={(event) => {
              setQualifierCode(event.target.value);
              if (event.target.value) clearFieldError("qualifier");
            }}
            aria-invalid={fieldErrors.qualifier ? true : undefined}
            data-od-qualifier-kind={qualifier.kind}
          >
            <option value="">{qualifier.placeholder}</option>
            {qualifier.options.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
          {fieldErrors.qualifier ? (
            <p className="od-consult-form__error">{fieldErrors.qualifier}</p>
          ) : null}
        </div>
      ) : null}

      {/* STEP 3 — contact */}
      {qualifierCode ? (
        <fieldset className="od-consult-form__group">
          <legend>{CONSULTATION_CONTACT_LABEL}</legend>

          <div className="od-consult-form__field">
            <label htmlFor="od-consult-name">Full name</label>
            <input
              id="od-consult-name"
              name="name"
              type="text"
              autoComplete="name"
              maxLength={LEAD_FORM_FIELD_LIMITS.nameMax}
              value={name}
              onChange={(event) => {
                setName(event.target.value);
                if (event.target.value.trim().length >= 2) clearFieldError("name");
              }}
              aria-invalid={fieldErrors.name ? true : undefined}
            />
            {fieldErrors.name ? (
              <p className="od-consult-form__error">{fieldErrors.name}</p>
            ) : null}
          </div>

          <div className="od-consult-form__field">
            <label htmlFor="od-consult-mobile">Mobile number</label>
            <input
              id="od-consult-mobile"
              name="mobile"
              type="tel"
              inputMode="numeric"
              autoComplete="tel-national"
              maxLength={10}
              value={mobile}
              onChange={(event) => applyMobileRaw(event.target.value)}
              onPaste={(event) => {
                // `maxLength={10}` would truncate a pasted "+919812345678" to
                // "+919812345", so a full E.164 paste is normalised BEFORE the
                // browser applies the limit.
                const text = event.clipboardData.getData("text");
                const accepted = acceptIndianMobileInput(text);
                if (accepted.ok) {
                  event.preventDefault();
                  setMobile(accepted.national);
                  clearFieldError("mobile");
                  return;
                }
                // Digit-only pastes fall through to onChange; an ambiguous or
                // overlong paste is refused rather than silently truncated.
                const compacted = text.replace(/[\s\-().]/g, "");
                if (/\D/.test(compacted) || compacted.length > 10) {
                  event.preventDefault();
                  setFieldErrors((prev) => ({
                    ...prev,
                    mobile: INDIAN_MOBILE_INVALID_MESSAGE,
                  }));
                }
              }}
              aria-describedby="od-consult-mobile-help"
              aria-invalid={fieldErrors.mobile ? true : undefined}
            />
            <p id="od-consult-mobile-help" className="od-consult-form__hint">
              {INDIAN_MOBILE_HELPER}
            </p>
            {fieldErrors.mobile ? (
              <p className="od-consult-form__error">{fieldErrors.mobile}</p>
            ) : null}
          </div>

          <div className="od-consult-form__field">
            <label htmlFor="od-consult-locality">
              Pune area / locality <span>(optional)</span>
            </label>
            <input
              id="od-consult-locality"
              name="locality"
              type="text"
              maxLength={LEAD_FORM_FIELD_LIMITS.localityMax}
              value={locality}
              onChange={(event) => setLocality(event.target.value)}
            />
          </div>

          {/* The note is available but never dominant. */}
          {noteOpen ? (
            <div className="od-consult-form__field">
              <label htmlFor="od-consult-message">
                {CONSULTATION_NOTE_LABEL} <span>(optional)</span>
              </label>
              <textarea
                id="od-consult-message"
                name="message"
                rows={3}
                maxLength={LEAD_FORM_FIELD_LIMITS.messageMax}
                value={message}
                onChange={(event) => setMessage(event.target.value)}
              />
            </div>
          ) : (
            <button
              type="button"
              className="od-consult-form__note-toggle"
              onClick={() => setNoteOpen(true)}
            >
              {CONSULTATION_NOTE_LABEL} (optional)
            </button>
          )}

          {/*
            CONSENT IS UNCHANGED.
            Same purposes, same copy versions, same required/optional split, and
            never pre-checked. Shortening the form must not shorten this.
          */}
          <div className="od-consult-form__consent">
            <label>
              <input
                type="checkbox"
                name="serviceEnquiryConsent"
                checked={serviceEnquiryConsent}
                onChange={(event) => {
                  setServiceEnquiryConsent(event.target.checked);
                  if (event.target.checked) clearFieldError("serviceEnquiryConsent");
                }}
                aria-invalid={fieldErrors.serviceEnquiryConsent ? true : undefined}
              />
              <span>{getServiceEnquiryConsentCopy()}</span>
            </label>
            {fieldErrors.serviceEnquiryConsent ? (
              <p className="od-consult-form__error">
                {fieldErrors.serviceEnquiryConsent}
              </p>
            ) : null}

            <label>
              <input
                type="checkbox"
                name="servicePhoneConsent"
                checked={servicePhoneConsent}
                onChange={(event) => {
                  setServicePhoneConsent(event.target.checked);
                  if (event.target.checked) clearFieldError("servicePhoneConsent");
                }}
                aria-invalid={fieldErrors.servicePhoneConsent ? true : undefined}
              />
              <span>{getServiceCommunicationConsentCopy()}</span>
            </label>
            {fieldErrors.servicePhoneConsent ? (
              <p className="od-consult-form__error">
                {fieldErrors.servicePhoneConsent}
              </p>
            ) : null}

            <label>
              <input
                type="checkbox"
                name="whatsappConsent"
                checked={whatsappConsent}
                onChange={(event) => setWhatsappConsent(event.target.checked)}
              />
              <span>{getWhatsappServiceConsentCopy()}</span>
            </label>

            <p className="od-consult-form__hint">
              <Link href={LEAD_FORM_PRIVACY_PATH}>Privacy</Link>
              {" · "}
              <Link href={LEAD_FORM_TERMS_PATH}>Terms</Link>
            </p>
          </div>
        </fieldset>
      ) : null}

      {/* Honeypot — visually hidden, never announced. */}
      <div className="od-consult-form__trap" aria-hidden="true">
        <label htmlFor="od-consult-website">Website</label>
        <input
          id="od-consult-website"
          name={LEAD_FORM_HONEYPOT_FIELD}
          type="text"
          tabIndex={-1}
          autoComplete="off"
          value={honeypot}
          onChange={(event) => setHoneypot(event.target.value)}
        />
      </div>

      {/*
        The submit action belongs to the Contact stage.
        Showing it during Project/Requirement offers to send a form whose contact
        fields have not been revealed yet, which reads as a broken step counter.
      */}
      {qualifierCode ? (
        <button
          type="submit"
          className="od-consult-form__submit"
          disabled={isSubmitting}
        >
          {isSubmitting ? "Sending…" : "Get Free Design Consultation"}
        </button>
      ) : null}

      {status && !isSuccess ? (
        <p className="od-consult-form__status" role="status" aria-live="polite">
          {status.title}
        </p>
      ) : null}
    </form>
  );
}
