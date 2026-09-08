"use client";

import Link from "next/link";
import { useEffect, useId, useRef, useState, type FormEvent } from "react";
import {
  AREA_LABEL,
  AREA_OPTIONAL_SUFFIX,
  AREA_PLACEHOLDER,
  BUDGET_LABEL,
  BUDGET_LOCKED_PLACEHOLDER,
  BUDGET_PLACEHOLDER,
  budgetRangesForProjectScope,
  isBudgetRangeForScope,
  LEAD_PROJECT_SCOPE_CODES,
  MOBILE_LABEL,
  MOBILE_PLACEHOLDER,
  NAME_LABEL,
  NAME_PLACEHOLDER,
  PROJECT_SCOPE_LABELS,
  projectScopeForServiceDeepLink,
  REQUIREMENT_LABEL,
  REQUIREMENT_PLACEHOLDER,
  SUBMIT_LABEL,
} from "../project-scope.ts";
import { SINGLE_CONSENT_CONCISE_COPY } from "../../legal/consent-registry.ts";
import { collectLeadFormAttribution } from "./lead-form-attribution.ts";
import {
  acceptIndianMobileInput,
  acceptIndianMobileKeystroke,
  INDIAN_MOBILE_HELPER,
  INDIAN_MOBILE_INVALID_MESSAGE,
} from "./indian-mobile.ts";
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
  fingerprintLeadPayload,
  getOrCreateKey,
  resetAfterSuccess,
  resetOnPayloadChange,
  shouldReuseOnError,
} from "./lead-form-idempotency.ts";
import { submitLeadIntake } from "./lead-intake-client.ts";
import { getLeadFormMode, type LeadFormMode } from "./lead-form-mode.ts";
import { requirementToLeadRequest } from "./requirement-to-lead-request.ts";
import { CONSULTATION_SUCCESS_MESSAGE } from "./consultation-copy.ts";
import "./premium-requirement-form.css";

/**
 * The public requirement form.
 *
 * Five questions, one of which is optional, and one consent line:
 *
 *   requirement -> budget -> area (optional) -> name -> mobile -> consent -> CTA
 *
 * REQUIREMENT AND BUDGET ARE ONE UNIT
 *
 * A budget band only means something relative to the scope it was chosen under —
 * "Above ₹16 Lakh" appears on both the 2 BHK and 3 BHK ladders with different
 * bands beneath it. So changing the requirement CLEARS the budget rather than
 * carrying it: a value that survived a scope change would look like an answer
 * the visitor gave for the new scope, and it is not.
 *
 * The client clearing it is a convenience, not the guarantee. The server
 * validator and `submit_lead_intake` both re-check the pairing, because this
 * component is the one layer an attacker does not have to run.
 *
 * WHY NAME AND MOBILE ARE HERE
 *
 * They are not extra questions; they are the lead. A requirement with no way to
 * call anybody back is not a lead, and the intake contract has always required
 * both. They sit last so the form opens with the question the visitor came to
 * answer rather than with a demand for their number.
 *
 * Every existing protection is reused unchanged: the shared national-mobile
 * helper, the honeypot, idempotency fingerprinting, attribution capture,
 * versioned consent copy and the shared status vocabulary.
 */

type FieldKey =
  | "projectScope"
  | "budgetRange"
  | "name"
  | "mobile"
  | "consent";

const FIELD_PATH_BY_KEY: Readonly<Record<string, FieldKey>> = {
  "requirements.projectScope": "projectScope",
  "requirements.budgetRange": "budgetRange",
  "contact.name": "name",
  "contact.mobile": "mobile",
  "consent.serviceEnquiry": "consent",
};

export function PremiumRequirementForm({
  mode: modeProp,
}: {
  readonly mode?: LeadFormMode;
} = {}) {
  const mode = modeProp ?? getLeadFormMode();

  const [projectScope, setProjectScope] = useState("");
  const [budgetRange, setBudgetRange] = useState("");
  const [area, setArea] = useState("");
  const [name, setName] = useState("");
  const [mobile, setMobile] = useState("");
  const [consent, setConsent] = useState(false);
  const [honeypot, setHoneypot] = useState("");

  const [errors, setErrors] = useState<Partial<Record<FieldKey, string>>>({});
  const [summary, setSummary] = useState<readonly string[]>([]);
  const [uxState, setUxState] = useState<LeadFormUxState>("idle");
  const [submissionReference, setSubmissionReference] = useState<string>();
  const [retryAfterSeconds, setRetryAfterSeconds] = useState<number>();

  const submittingRef = useRef(false);
  const summaryRef = useRef<HTMLDivElement>(null);
  const [formStartedAt] = useState(() => new Date().toISOString());

  /*
   * `useId` rather than fixed ids: a page may reasonably show this form twice
   * (a hero copy and a footer copy), and duplicate ids would silently point the
   * second form's labels at the first form's fields.
   */
  const base = useId();
  const id = (suffix: string) => `${base}-${suffix}`;

  /*
   * `?service=` DEEP LINKS
   *
   * `public-nav.ts` still links each service to `/?service=<code>#consultation`.
   * Only `modular-kitchens` names exactly one scope, so only it preselects; the
   * other two leave the requirement blank rather than choosing a home size on
   * the visitor's behalf. See `projectScopeForServiceDeepLink`.
   *
   * Read AFTER mount, never in the state initializer: `window.location.search`
   * is "" on the server and populated on hydration, which is a first-render
   * mismatch on exactly the URLs the deep link exists for.
   */
  useEffect(() => {
    /*
     * Deferred rather than set synchronously in the effect body: the first
     * render must match the server byte for byte, and a synchronous setState
     * here would also cascade a second render.
     *
     * A TIMEOUT rather than `requestAnimationFrame`, which is what the legacy
     * form uses. rAF is suspended in a backgrounded tab, so a link opened with
     * "open in new tab" would sit unpreselected until the visitor switched to
     * it. A timeout fires either way, and "after a macrotask" versus "after
     * paint" is indistinguishable to anyone looking at the page.
     *
     * There is deliberately no "already applied" ref guard. React invokes
     * effects twice in development; a ref set on the first pass, combined with
     * the cleanup cancelling that pass, leaves the second pass returning early
     * and the deep link never applying. The functional update below is the real
     * guard — it writes only while the requirement is still unchosen, so
     * running twice is harmless and running once is enough.
     */
    const timer = window.setTimeout(() => {
      const raw = new URLSearchParams(window.location.search).get("service");
      const scope = projectScopeForServiceDeepLink(raw);
      // Never overwrite a choice the visitor has already made.
      if (scope) setProjectScope((current) => (current === "" ? scope : current));
    }, 0);
    return () => window.clearTimeout(timer);
  }, []);

  const budgetOptions = budgetRangesForProjectScope(projectScope);
  const budgetLocked = budgetOptions.length === 0;

  const isSubmitting = uxState === "submitting" || uxState === "validating";
  const isSuccess =
    uxState === "success-created" || uxState === "success-duplicate";
  // "active" is the live mode; "preview" validates locally and never posts.
  const canNetworkSubmit = mode === "active";

  const clearError = (field: FieldKey) =>
    setErrors((previous) => {
      if (!previous[field]) return previous;
      const next = { ...previous };
      delete next[field];
      return next;
    });

  /** Changing the requirement re-bases the budget. See the header. */
  const onProjectScopeChange = (value: string) => {
    setProjectScope(value);
    clearError("projectScope");
    if (!isBudgetRangeForScope(value, budgetRange)) {
      setBudgetRange("");
      clearError("budgetRange");
    }
  };

  /**
   * The canonical national-mobile handling, identical to the existing form.
   *
   * `acceptIndianMobileKeystroke` takes the WHOLE candidate value, not one key,
   * so there is no keydown filter here — filtering keys is what once blocked
   * Backspace, Delete, Tab and the arrows.
   */
  const applyMobileRaw = (raw: string) => {
    const accepted = acceptIndianMobileKeystroke(raw);
    if (!accepted.ok) {
      const paste = acceptIndianMobileInput(raw);
      if (paste.ok) {
        setMobile(paste.national);
        clearError("mobile");
        return;
      }
      setErrors((previous) => ({
        ...previous,
        mobile: INDIAN_MOBILE_INVALID_MESSAGE,
      }));
      return;
    }
    setMobile(accepted.national);
    if (accepted.national.length === 0 || accepted.national.length === 10) {
      clearError("mobile");
    }
  };

  const onSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (isSubmitting || submittingRef.current) return;

    setSummary([]);
    setRetryAfterSeconds(undefined);
    setSubmissionReference(undefined);
    setUxState("validating");

    /*
     * ONE VALIDATOR, NOT TWO.
     *
     * The adapter decides what is acceptable, and the form renders whatever it
     * refuses. A second set of rules here would be a second thing to keep in
     * step with the server, and the first to fall out of step.
     */
    const draft = requirementToLeadRequest({
      projectScope,
      budgetRange,
      area,
      name,
      mobile,
      consent,
      attribution: collectLeadFormAttribution(),
      antiBot: { website: honeypot, formStartedAt },
      idempotencyKey: "00000000-0000-4000-8000-000000000000",
    });

    if (!draft.ok) {
      const next: Partial<Record<FieldKey, string>> = {};
      for (const path of draft.fields) {
        const key = FIELD_PATH_BY_KEY[path];
        if (key) next[key] = messageForField(key);
      }
      setErrors(next);
      setSummary(draft.fields.map((f) => `${fieldPathToLabel(f)} needs attention.`));
      setUxState("validation-error");
      summaryRef.current?.focus();
      return;
    }

    setErrors({});

    // Preview mode validates locally and never calls intake.
    if (!canNetworkSubmit) {
      setUxState("idle");
      return;
    }

    submittingRef.current = true;
    setUxState("submitting");

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
      setSummary(
        result.fields.map((f) => `${fieldPathToLabel(f)} could not be accepted.`)
      );
    }
    setUxState(mapClientResultToUxState(result));
    submittingRef.current = false;
  };

  const status = getLeadFormStatusMessage(uxState, {
    submissionReference,
    retryAfterSeconds,
    validationFields: [],
  });

  if (isSuccess) {
    return (
      <div className="od-req-form" data-od-requirement-state="success">
        <p className="od-req-form__status" role="status" aria-live="polite">
          {CONSULTATION_SUCCESS_MESSAGE}
        </p>
        {status?.body ? (
          <p className="od-req-form__hint">{status.body}</p>
        ) : null}
      </div>
    );
  }

  /** Drives the visual state hooks in CSS: error beats complete beats empty. */
  const fieldState = (invalid: boolean, complete: boolean) =>
    invalid ? "error" : complete ? "complete" : "empty";

  return (
    <form
      className="od-req-form"
      onSubmit={(event) => void onSubmit(event)}
      aria-busy={isSubmitting}
      noValidate
      data-od-requirement-form="public-consult-v3"
      data-od-lead-phone-ux="national-10"
    >
      {mode === "preview" ? (
        <p className="od-req-form__hint" role="note">
          {LEAD_FORM_PREVIEW_NOTICE}
        </p>
      ) : null}

      {summary.length > 0 && uxState === "validation-error" ? (
        <div
          ref={summaryRef}
          tabIndex={-1}
          role="alert"
          className="od-req-form__summary"
        >
          <p>Please check the highlighted fields.</p>
          <ul>
            {summary.map((line) => (
              <li key={line}>{line}</li>
            ))}
          </ul>
        </div>
      ) : null}

      {/* 1 — Requirement */}
      <div
        className="od-req-form__field"
        data-state={fieldState(Boolean(errors.projectScope), Boolean(projectScope))}
      >
        <label className="od-req-form__label" htmlFor={id("scope")}>
          {REQUIREMENT_LABEL}
        </label>
        <div className="od-req-form__control">
          <select
            id={id("scope")}
            name="projectScope"
            className="od-req-form__select"
            value={projectScope}
            onChange={(event) => onProjectScopeChange(event.target.value)}
            aria-invalid={errors.projectScope ? true : undefined}
            aria-describedby={
              errors.projectScope ? id("scope-error") : undefined
            }
          >
            <option value="">{REQUIREMENT_PLACEHOLDER}</option>
            {LEAD_PROJECT_SCOPE_CODES.map((scope) => (
              <option key={scope} value={scope}>
                {PROJECT_SCOPE_LABELS[scope]}
              </option>
            ))}
          </select>
        </div>
        {errors.projectScope ? (
          <p className="od-req-form__error" id={id("scope-error")}>
            {errors.projectScope}
          </p>
        ) : null}
      </div>

      {/* 2 — Budget. Disabled until a requirement gives it a ladder. */}
      <div
        className="od-req-form__field"
        data-state={fieldState(Boolean(errors.budgetRange), Boolean(budgetRange))}
        data-locked={budgetLocked ? "" : undefined}
      >
        <label className="od-req-form__label" htmlFor={id("budget")}>
          {BUDGET_LABEL}
        </label>
        <div className="od-req-form__control">
          <select
            id={id("budget")}
            name="budgetRange"
            className="od-req-form__select"
            value={budgetRange}
            disabled={budgetLocked}
            onChange={(event) => {
              setBudgetRange(event.target.value);
              clearError("budgetRange");
            }}
            aria-invalid={errors.budgetRange ? true : undefined}
            aria-describedby={
              errors.budgetRange ? id("budget-error") : undefined
            }
          >
            <option value="">
              {budgetLocked ? BUDGET_LOCKED_PLACEHOLDER : BUDGET_PLACEHOLDER}
            </option>
            {budgetOptions.map((option) => (
              <option key={option.code} value={option.code}>
                {option.label}
              </option>
            ))}
          </select>
        </div>
        {errors.budgetRange ? (
          <p className="od-req-form__error" id={id("budget-error")}>
            {errors.budgetRange}
          </p>
        ) : null}
      </div>

      {/* 3 — Area. Optional, and said so in the label rather than a footnote. */}
      <div
        className="od-req-form__field"
        data-state={fieldState(false, area.trim().length > 0)}
      >
        <label className="od-req-form__label" htmlFor={id("area")}>
          {AREA_LABEL}
          <span className="od-req-form__optional">{AREA_OPTIONAL_SUFFIX}</span>
        </label>
        <div className="od-req-form__control">
          <input
            id={id("area")}
            name="locality"
            className="od-req-form__input"
            type="text"
            value={area}
            onChange={(event) => setArea(event.target.value)}
            placeholder={AREA_PLACEHOLDER}
            autoComplete="address-level3"
            maxLength={LEAD_FORM_FIELD_LIMITS.localityMax}
          />
        </div>
      </div>

      {/* 4 — Name */}
      <div
        className="od-req-form__field"
        data-state={fieldState(Boolean(errors.name), name.trim().length >= 2)}
      >
        <label className="od-req-form__label" htmlFor={id("name")}>
          {NAME_LABEL}
        </label>
        <div className="od-req-form__control">
          <input
            id={id("name")}
            name="name"
            className="od-req-form__input"
            type="text"
            value={name}
            onChange={(event) => {
              setName(event.target.value);
              if (event.target.value.trim().length >= 2) clearError("name");
            }}
            placeholder={NAME_PLACEHOLDER}
            autoComplete="name"
            maxLength={LEAD_FORM_FIELD_LIMITS.nameMax}
            aria-invalid={errors.name ? true : undefined}
            aria-describedby={errors.name ? id("name-error") : undefined}
          />
        </div>
        {errors.name ? (
          <p className="od-req-form__error" id={id("name-error")}>
            {errors.name}
          </p>
        ) : null}
      </div>

      {/* 5 — Mobile */}
      <div
        className="od-req-form__field"
        data-state={fieldState(Boolean(errors.mobile), mobile.length === 10)}
      >
        <label className="od-req-form__label" htmlFor={id("mobile")}>
          {MOBILE_LABEL}
        </label>
        <div className="od-req-form__control">
          <input
            id={id("mobile")}
            name="mobile"
            className="od-req-form__input"
            type="tel"
            inputMode="numeric"
            value={mobile}
            onChange={(event) => applyMobileRaw(event.target.value)}
            onPaste={(event) => {
              /*
               * `maxLength={10}` would truncate a pasted "+919812345678" to
               * "+919812345", so a full E.164 paste is normalised BEFORE the
               * browser applies the limit.
               */
              const text = event.clipboardData.getData("text");
              const accepted = acceptIndianMobileInput(text);
              if (accepted.ok) {
                event.preventDefault();
                setMobile(accepted.national);
                clearError("mobile");
                return;
              }
              const compacted = text.replace(/[\s\-().]/g, "");
              if (/\D/.test(compacted) || compacted.length > 10) {
                event.preventDefault();
                setErrors((previous) => ({
                  ...previous,
                  mobile: INDIAN_MOBILE_INVALID_MESSAGE,
                }));
              }
            }}
            placeholder={MOBILE_PLACEHOLDER}
            autoComplete="tel-national"
            maxLength={10}
            aria-invalid={errors.mobile ? true : undefined}
            aria-describedby={
              errors.mobile ? id("mobile-error") : id("mobile-help")
            }
          />
        </div>
        {errors.mobile ? (
          <p className="od-req-form__error" id={id("mobile-error")}>
            {errors.mobile}
          </p>
        ) : (
          <p className="od-req-form__hint" id={id("mobile-help")}>
            {INDIAN_MOBILE_HELPER}
          </p>
        )}
      </div>

      {/*
        6 — Consent. ONE checkbox, covering the two REQUIRED purposes and
        nothing else. The wording is the registered copy for both, so what is
        recorded is what was read. WhatsApp is optional, is not asked here, and
        is never inferred from this box.
      */}
      <div
        className="od-req-form__consent"
        data-state={errors.consent ? "error" : "empty"}
      >
        <label className="od-req-form__consent-label" htmlFor={id("consent")}>
          <input
            id={id("consent")}
            name="consent"
            className="od-req-form__checkbox"
            type="checkbox"
            checked={consent}
            onChange={(event) => {
              setConsent(event.target.checked);
              if (event.target.checked) clearError("consent");
            }}
            aria-invalid={errors.consent ? true : undefined}
            aria-describedby={errors.consent ? id("consent-error") : undefined}
          />
          <span>
            {SINGLE_CONSENT_CONCISE_COPY}{" "}
            <Link href={LEAD_FORM_PRIVACY_PATH}>Privacy</Link>
            {" · "}
            <Link href={LEAD_FORM_TERMS_PATH}>Terms</Link>
          </span>
        </label>
        {errors.consent ? (
          <p className="od-req-form__error" id={id("consent-error")}>
            {errors.consent}
          </p>
        ) : null}
      </div>

      {/* Honeypot — visually hidden, never announced. */}
      <div className="od-req-form__trap" aria-hidden="true">
        <label htmlFor={id("website")}>Website</label>
        <input
          id={id("website")}
          name={LEAD_FORM_HONEYPOT_FIELD}
          type="text"
          tabIndex={-1}
          autoComplete="off"
          value={honeypot}
          onChange={(event) => setHoneypot(event.target.value)}
        />
      </div>

      {/* 7 — CTA */}
      <button
        type="submit"
        className="od-req-form__submit"
        disabled={isSubmitting}
      >
        <span>{isSubmitting ? "Sending…" : SUBMIT_LABEL}</span>
        {isSubmitting ? null : (
          <span className="od-req-form__arrow" aria-hidden="true">
            →
          </span>
        )}
      </button>

      {status && !isSuccess ? (
        <p className="od-req-form__status" role="status" aria-live="polite">
          {status.title}
        </p>
      ) : null}
    </form>
  );
}

function messageForField(key: FieldKey): string {
  switch (key) {
    case "projectScope":
      return "Please choose what you are looking for.";
    case "budgetRange":
      return "Please choose an approximate budget.";
    case "name":
      return "Please enter your name.";
    case "mobile":
      return INDIAN_MOBILE_INVALID_MESSAGE;
    case "consent":
      return "Please accept the contact consent to continue.";
  }
}
