"use client";

/**
 * The final step of the one public lead form: the Brief.
 *
 * WHY THIS IS A SEPARATE COMPONENT
 *
 * Steps 1–3 of the sheet ask domain questions and change nothing outside the
 * browser. This step submits. Keeping the submission concerns — idempotency,
 * consent evidence, the anti-bot window, the honeypot, and the whole error
 * vocabulary — inside one component means the planner UI stays a form and this
 * file stays the only place a lead leaves the browser.
 *
 * WHAT IT READS AND WHAT IT OWNS
 *
 * It READS the plan (service, home scope, budget band, timeline, locality,
 * message) because those were answered on earlier steps. It OWNS the contact
 * fields, the consent checkbox and the submission state, because those exist
 * only here and must not survive a step change or leak into the shared plan.
 *
 * THE ANTI-BOT WINDOW
 *
 * `formStartedAt` is stamped when this component first mounts, which is when
 * the visitor actually reaches the brief. The server requires the gap to be at
 * least 800ms and at most 24 hours; a human filling in a name and a mobile
 * number cannot beat the floor, and a sheet left open overnight is asked to
 * start again rather than silently accepted.
 */

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
import { SINGLE_CONSENT_CONCISE_COPY } from "../../legal/consent-registry.ts";
import { usePlan } from "../../public-site/home-r4/PlanContext";
import { collectLeadFormAttribution } from "./lead-form-attribution.ts";
import {
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
  type LeadFormUxState,
} from "./lead-form-errors.ts";
import {
  acceptIndianMobileInput,
  acceptIndianMobileKeystroke,
  INDIAN_MOBILE_BLANK_MESSAGE,
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
import { unifiedLeadToRequest } from "./unified-lead-request.ts";

/**
 * The three answers this step is responsible for. Deliberately NOT the shared
 * `LeadFormFieldKey` vocabulary: that one carries `property` and `qualifier`,
 * which are fields v4 forbids, and a key that cannot be produced here has no
 * business being reachable from here.
 */
type BriefFieldKey = "name" | "mobile" | "consent";

const BRIEF_FIELD_ORDER: readonly BriefFieldKey[] = ["name", "mobile", "consent"];

export const UNIFIED_BRIEF_SUBMIT_LABEL = "Request free consultation";
export const UNIFIED_BRIEF_SUBMITTING_LABEL = "Sending…";

export interface UnifiedLeadBriefProps {
  readonly mode: LeadFormMode;
  /** Called after a lead is accepted, so the sheet can show its success state. */
  readonly onSubmitted?: () => void;
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

export function UnifiedLeadBrief({ mode, onSubmitted }: UnifiedLeadBriefProps) {
  const plan = usePlan();
  const formId = useId();

  const nameRef = useRef<HTMLInputElement>(null);
  const mobileRef = useRef<HTMLInputElement>(null);
  const consentRef = useRef<HTMLInputElement>(null);
  const summaryRef = useRef<HTMLDivElement>(null);
  const shakeClearRef = useRef<number | null>(null);
  const submittingRef = useRef(false);

  const [name, setName] = useState(plan.name);
  const [mobile, setMobile] = useState(plan.mobile);
  const [consent, setConsent] = useState(false);
  const [honeypot, setHoneypot] = useState("");
  const [formStartedAt] = useState(() => new Date().toISOString());
  const [uxState, setUxState] = useState<LeadFormUxState>("idle");
  const [fieldErrors, setFieldErrors] = useState<
    Partial<Record<BriefFieldKey, string>>
  >({});
  const [serverFields, setServerFields] = useState<readonly string[]>([]);
  const [shakeField, setShakeField] = useState<BriefFieldKey | null>(null);
  const [retryAfterSeconds, setRetryAfterSeconds] = useState<
    number | undefined
  >(undefined);
  const [submissionReference, setSubmissionReference] = useState<
    string | undefined
  >(undefined);

  const fieldRefs: Record<BriefFieldKey, React.RefObject<HTMLElement | null>> =
    useMemo(
      () => ({ name: nameRef, mobile: mobileRef, consent: consentRef }),
      []
    );

  useEffect(() => {
    return () => {
      if (shakeClearRef.current != null) {
        window.clearTimeout(shakeClearRef.current);
      }
    };
  }, []);

  const isSubmitting = uxState === "submitting";
  const isSuccess =
    uxState === "success-created" || uxState === "success-duplicate";
  const canAttemptSubmit = !isSubmitting && !isSuccess;
  const canNetworkSubmit = mode === "active" && canAttemptSubmit;

  const statusMessage = getLeadFormStatusMessage(uxState, {
    retryAfterSeconds,
    validationFields: serverFields,
    submissionReference,
  });

  const clearFieldError = (key: BriefFieldKey) => {
    setFieldErrors((prev) => {
      if (!prev[key]) return prev;
      const next = { ...prev };
      delete next[key];
      return next;
    });
  };

  const triggerInvalidFeedback = (key: BriefFieldKey) => {
    pulseInvalidHaptic();
    setShakeField(key);
    if (shakeClearRef.current != null) {
      window.clearTimeout(shakeClearRef.current);
    }
    shakeClearRef.current = window.setTimeout(() => {
      setShakeField(null);
      shakeClearRef.current = null;
    }, 350);
    const node = fieldRefs[key].current;
    if (node) {
      node.focus();
      node.scrollIntoView({ block: "center", behavior: "smooth" });
    } else {
      summaryRef.current?.focus();
    }
  };

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

  const onSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!canAttemptSubmit || submittingRef.current) return;

    setServerFields([]);
    setRetryAfterSeconds(undefined);
    setSubmissionReference(undefined);

    /*
     * Local checks first, so the three answers this step owns get a message
     * against the control that asked for them. Everything else — a scope from
     * the wrong ladder, a timeline outside the vocabulary — is the adapter's
     * job below, and comes back as a field path rather than an inline error,
     * because the control that would show it lives on an earlier step.
     */
    const next: Partial<Record<BriefFieldKey, string>> = {};
    const trimmedName = name.trim();
    if (
      trimmedName.length < LEAD_FORM_FIELD_LIMITS.nameMin ||
      trimmedName.length > LEAD_FORM_FIELD_LIMITS.nameMax
    ) {
      next.name = "Enter your full name.";
    }
    if (!mobile.trim()) {
      next.mobile = INDIAN_MOBILE_BLANK_MESSAGE;
    } else if (!acceptIndianMobileInput(mobile).ok) {
      next.mobile = INDIAN_MOBILE_INVALID_MESSAGE;
    }
    if (!consent) {
      next.consent =
        "Please confirm that ONEDECORE may process this enquiry and contact you about it.";
    }

    const firstInvalid = BRIEF_FIELD_ORDER.find((key) => next[key]) ?? null;
    if (firstInvalid) {
      setFieldErrors(next);
      setUxState("validation-error");
      triggerInvalidFeedback(firstInvalid);
      return;
    }

    setFieldErrors({});

    // Preview: client validation only — never call intake.
    if (!canNetworkSubmit) {
      setUxState("idle");
      return;
    }

    submittingRef.current = true;
    setUxState("submitting");

    const draft = unifiedLeadToRequest({
      service: plan.service,
      projectScope: plan.projectScope,
      budgetRange: plan.budgetRange,
      timeline: plan.timeline,
      area: plan.locality,
      message: plan.message,
      name,
      mobile,
      consent,
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
    const idempotencyKey = getOrCreateKey(fingerprint);
    const result = await submitLeadIntake({ ...draft.body, idempotencyKey });

    if (
      result.kind === "success-created" ||
      result.kind === "success-duplicate"
    ) {
      resetAfterSuccess();
      setSubmissionReference(result.submissionReference);
      setUxState(mapClientResultToUxState(result));
      submittingRef.current = false;
      onSubmitted?.();
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

  const serverSummary = serverFields.map(
    (field) => `${fieldPathToLabel(field)} could not be accepted.`
  );
  const showSummary =
    (serverSummary.length > 0 && uxState === "validation-error") ||
    (statusMessage?.isError === true && serverSummary.length === 0);

  const fieldClass = (key: BriefFieldKey) => {
    const parts = ["pm-field"];
    if (fieldErrors[key]) parts.push("pm-field--invalid");
    if (shakeField === key) parts.push("pm-field--shake");
    return parts.join(" ");
  };

  const errorText = (key: BriefFieldKey): ReactNode =>
    fieldErrors[key] ? (
      <p id={`${formId}-${key}-error`} className="pm-field__error" role="alert">
        {fieldErrors[key]}
      </p>
    ) : null;

  const describedBy = (key: BriefFieldKey, extra?: string) => {
    const ids: string[] = [];
    if (extra) ids.push(extra);
    if (fieldErrors[key]) ids.push(`${formId}-${key}-error`);
    return ids.length > 0 ? ids.join(" ") : undefined;
  };

  return (
    <form
      className="pm-brief"
      onSubmit={(event) => void onSubmit(event)}
      aria-busy={isSubmitting}
      noValidate
      data-od-lead-form="unified-v4"
      data-od-lead-phone-ux="national-10"
    >
      {mode === "preview" ? (
        <p className="pm-planner__hint" role="note">
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
          {serverSummary.length > 0 ? (
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
        <p className="pm-brief__success" role="status" aria-live="polite">
          {statusMessage.title}
          {statusMessage.body ? <span> {statusMessage.body}</span> : null}
        </p>
      ) : null}

      <fieldset className="pm-fieldset" disabled={isSubmitting || isSuccess}>
        <legend className="pm-legend">Where should we send the plan?</legend>

        <div className={fieldClass("name")}>
          <label htmlFor={`${formId}-name`}>Your name</label>
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
              plan.setContact({ name: event.target.value });
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
            onChange={(event) => {
              applyMobileRaw(event.target.value);
              plan.setContact({ mobile: event.target.value });
            }}
            onPaste={(event) => {
              const text = event.clipboardData.getData("text");
              const accepted = acceptIndianMobileInput(text);
              if (accepted.ok) {
                event.preventDefault();
                setMobile(accepted.national);
                plan.setContact({ mobile: accepted.national });
                clearFieldError("mobile");
                return;
              }
              // Let onChange handle digit-only pastes; block ambiguous ones.
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
          <p id={`${formId}-mobile-hint`} className="pm-planner__hint">
            {INDIAN_MOBILE_HELPER}
          </p>
          {errorText("mobile")}
        </div>

        <div className="pm-field">
          <label htmlFor={`${formId}-locality`}>
            Area in Pune <span className="pm-opt">optional</span>
          </label>
          <input
            id={`${formId}-locality`}
            name="locality"
            type="text"
            autoComplete="address-level2"
            placeholder="e.g. Kharadi"
            maxLength={LEAD_FORM_FIELD_LIMITS.localityMax}
            value={plan.locality}
            onChange={(event) =>
              plan.setContact({ locality: event.target.value })
            }
          />
        </div>

        <div className="pm-field">
          <label htmlFor={`${formId}-message`}>
            Anything else we should know{" "}
            <span className="pm-opt">optional</span>
          </label>
          <textarea
            id={`${formId}-message`}
            name="message"
            rows={3}
            maxLength={LEAD_FORM_FIELD_LIMITS.messageMax}
            value={plan.message}
            onChange={(event) => plan.setMessage(event.target.value)}
          />
        </div>
      </fieldset>

      <fieldset className="pm-fieldset" disabled={isSubmitting || isSuccess}>
        <legend className="pm-legend">Consent</legend>
        {/*
          ONE checkbox, TWO purposes. The combined wording is the approved
          single-consent copy, and the versions recorded by the adapter are the
          combined ones — so the evidence stored names the sentence the visitor
          actually read, not two sentences they were never shown.
        */}
        <label
          className={
            fieldErrors.consent
              ? "pm-consent pm-consent--invalid"
              : shakeField === "consent"
                ? "pm-consent pm-field--shake"
                : "pm-consent"
          }
        >
          <input
            ref={consentRef}
            type="checkbox"
            name="consentServiceEnquiry"
            checked={consent}
            required
            aria-invalid={Boolean(fieldErrors.consent)}
            aria-describedby={describedBy("consent")}
            onChange={(event) => {
              setConsent(event.target.checked);
              clearFieldError("consent");
            }}
          />
          <span>
            {SINGLE_CONSENT_CONCISE_COPY}{" "}
            <Link href={LEAD_FORM_PRIVACY_PATH}>Privacy Policy</Link> and{" "}
            <Link href={LEAD_FORM_TERMS_PATH}>Terms of Use</Link> apply.
          </span>
        </label>
        {errorText("consent")}
      </fieldset>

      <div className="pm-brief__honeypot" aria-hidden="true">
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

      <div className="pm-planner__actions pm-planner__actions--brief">
        <button
          type="submit"
          className="dc-btn dc-btn--primary pm-btn--sheen"
          disabled={!canAttemptSubmit}
          data-conversion-action="lead-submit"
        >
          {isSubmitting
            ? UNIFIED_BRIEF_SUBMITTING_LABEL
            : UNIFIED_BRIEF_SUBMIT_LABEL}
        </button>
      </div>
    </form>
  );
}
