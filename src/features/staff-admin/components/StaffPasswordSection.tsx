"use client";

import { useMemo, useState } from "react";
import type {
  StaffCredentialFormState,
  StaffCredentialOperation,
} from "../contracts/staff-credential-form-state.ts";
import { STAFF_PASSWORD_MIN_LENGTH } from "../contracts/staff-login-phone.ts";
import {
  STAFF_PASSWORD_FIRST_LOGIN_NOTE,
  STAFF_PASSWORD_GENERATED_HELP,
  STAFF_PASSWORD_SECTION_HELP,
  STAFF_PASSWORD_STATUS,
  STAFF_PASSWORD_STRENGTH_NOTE,
  staffCredentialFailureHint,
  type StaffPasswordStatusTone,
} from "../contracts/staff-password-messages.ts";
import {
  analyseStaffPassword,
  generateStrongStaffPassword,
  type StaffPasswordCheck,
} from "../contracts/staff-password-quality.ts";

/**
 * Password entry for issuing or resetting a staff login.
 *
 * THE PROBLEM THIS SOLVES
 *
 * The old form checked length and confirmation, then reported "Password
 * updated." Supabase can still refuse a password that passes both — most often
 * `weak_password` with a `pwned` reason — so an operator would hand out a
 * password that could not sign in, and only find out when the staff member
 * called.
 *
 * Every piece of copy here therefore keeps the two stages apart. Local checks
 * earn "ready to submit" and nothing stronger; only the server's answer is ever
 * rendered as success or rejection.
 */

const fieldClassName =
  "block w-full min-h-11 rounded-md border border-neutral-700 bg-neutral-950 px-3 py-2 pr-24 text-sm text-neutral-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-400";

const inlineButtonClassName =
  "rounded border border-neutral-700 px-2 py-1 text-[11px] font-medium text-neutral-300 hover:border-neutral-500 hover:text-neutral-100 disabled:opacity-50";

const submitButtonClassName =
  "inline-flex min-h-11 items-center rounded-md bg-amber-500 px-4 py-2 text-sm font-semibold text-neutral-950 disabled:cursor-not-allowed disabled:opacity-60";

const TONE_CLASSNAME: Record<StaffPasswordStatusTone, string> = {
  neutral: "border-neutral-800 bg-neutral-950/60 text-neutral-300",
  warning: "border-amber-900/60 bg-amber-950/30 text-amber-100",
  info: "border-sky-900/60 bg-sky-950/30 text-sky-100",
  success: "border-emerald-900/60 bg-emerald-950/30 text-emerald-100",
  error: "border-red-900/60 bg-red-950/30 text-red-100",
};

/** Marks carry the state; colour alone never does. */
function CheckRow({ check }: { readonly check: StaffPasswordCheck }) {
  const isHardFailure = check.kind === "hard" && check.state === "unmet";

  const mark = check.state === "met" ? "✓" : isHardFailure ? "✕" : "•";

  const className =
    check.state === "met"
      ? "text-emerald-300"
      : isHardFailure
        ? "text-red-300"
        : check.state === "unmet"
          ? "text-amber-200"
          : "text-neutral-500";

  return (
    <li className={`flex items-start gap-2 ${className}`} data-check={check.id}>
      <span aria-hidden="true" className="mt-px w-3 shrink-0 text-center">
        {mark}
      </span>
      <span className="min-w-0 break-words">{check.label}</span>
      <span className="sr-only">
        {check.state === "met"
          ? " — met"
          : check.state === "pending"
            ? " — not yet checked"
            : isHardFailure
              ? " — required, not met"
              : " — recommended, not met"}
      </span>
    </li>
  );
}

interface StaffPasswordSectionProps {
  readonly idPrefix: string;
  readonly operation: Extract<StaffCredentialOperation, "issue" | "reset">;
  readonly state: StaffCredentialFormState;
  readonly pending: boolean;
  readonly submitLabel: string;
  readonly pendingLabel: string;
}

export function StaffPasswordSection({
  idPrefix,
  operation,
  state,
  pending,
  submitLabel,
  pendingLabel,
}: StaffPasswordSectionProps) {
  const [password, setPassword] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [revealed, setRevealed] = useState(false);
  const [generated, setGenerated] = useState(false);
  const [copied, setCopied] = useState(false);

  const analysis = useMemo(
    () => analyseStaffPassword(password, confirmation),
    [password, confirmation]
  );

  /** Only this form's own result. Another form's message must not appear here. */
  const result = state.operation === operation && state.message ? state : null;

  /*
   * Clear the fields once the SERVER has accepted — never on submit, and never
   * on failure. A rejected password stays in the boxes so the operator can edit
   * it rather than retype from scratch, which is the moment they are most likely
   * to reach for something weaker.
   *
   * Adjusted during render rather than in an effect: `useActionState` hands back
   * a new state object per submission, so comparing identity here clears the
   * boxes in the same pass that renders the success — an effect would paint the
   * accepted password once before wiping it.
   */
  const [handledState, setHandledState] =
    useState<StaffCredentialFormState | null>(null);

  if (handledState !== state) {
    setHandledState(state);
    if (state.success && state.operation === operation) {
      setPassword("");
      setConfirmation("");
      setGenerated(false);
      setRevealed(false);
      setCopied(false);
    }
  }

  const status = resolveStatus({ analysis, pending, result, operation });

  const onGenerate = () => {
    const next = generateStrongStaffPassword();
    setPassword(next);
    setConfirmation(next);
    setGenerated(true);
    setCopied(false);
    // Shown so the operator can actually read and pass it on; it is cleared the
    // moment the save succeeds.
    setRevealed(true);
  };

  const onCopy = async () => {
    try {
      await navigator.clipboard.writeText(password);
      setCopied(true);
    } catch {
      // Clipboard access can be denied or unavailable outside a secure context.
      // The password is on screen, so this is a convenience, not a dependency.
      setCopied(false);
    }
  };

  return (
    <div className="space-y-4">
      <p className="text-xs text-neutral-400">{STAFF_PASSWORD_SECTION_HELP}</p>

      {/* ONE status area, so there is never a stale success beside a failure. */}
      <p
        role="status"
        aria-live="polite"
        data-testid={`${idPrefix}-password-status`}
        className={`rounded-md border px-3 py-2 text-sm ${TONE_CLASSNAME[status.tone]}`}
      >
        {status.message}
        {status.hint ? (
          <span className="mt-1 block text-xs opacity-90">{status.hint}</span>
        ) : null}
        {status.tone === "success" && state.loginUsername ? (
          <span className="mt-1 block text-xs opacity-90">
            Username: <span className="font-semibold">{state.loginUsername}</span>
          </span>
        ) : null}
      </p>

      <div>
        <label
          htmlFor={`${idPrefix}-password`}
          className="text-sm font-medium text-neutral-200"
        >
          Password
        </label>
        <div className="relative mt-1">
          <input
            id={`${idPrefix}-password`}
            name="password"
            type={revealed ? "text" : "password"}
            autoComplete="new-password"
            required
            minLength={STAFF_PASSWORD_MIN_LENGTH}
            maxLength={72}
            value={password}
            onChange={(event) => {
              setPassword(event.target.value);
              setGenerated(false);
              setCopied(false);
            }}
            className={fieldClassName}
            aria-describedby={`${idPrefix}-password-checks`}
          />
          <button
            type="button"
            onClick={() => setRevealed((current) => !current)}
            className="absolute inset-y-0 right-2 my-auto h-7 rounded px-2 text-[11px] font-medium text-neutral-400 hover:text-neutral-100"
            aria-pressed={revealed}
          >
            {revealed ? "Hide" : "Show"}
          </button>
        </div>
      </div>

      <div>
        <label
          htmlFor={`${idPrefix}-confirm`}
          className="text-sm font-medium text-neutral-200"
        >
          Confirm password
        </label>
        <input
          id={`${idPrefix}-confirm`}
          name="confirmPassword"
          type={revealed ? "text" : "password"}
          autoComplete="new-password"
          required
          minLength={STAFF_PASSWORD_MIN_LENGTH}
          maxLength={72}
          value={confirmation}
          onChange={(event) => {
            setConfirmation(event.target.value);
            setCopied(false);
          }}
          className={`mt-1 ${fieldClassName}`}
        />
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={onGenerate}
          className={inlineButtonClassName}
          data-testid={`${idPrefix}-generate-password`}
        >
          Generate strong password
        </button>
        {password.length > 0 ? (
          <button type="button" onClick={onCopy} className={inlineButtonClassName}>
            {copied ? "Copied" : "Copy password"}
          </button>
        ) : null}
        <span className="text-[11px] text-neutral-500">
          Strength: <span className="font-semibold">{analysis.strength}</span>
        </span>
      </div>

      {generated ? (
        <p className="rounded-md border border-sky-900/60 bg-sky-950/30 px-3 py-2 text-xs text-sky-100">
          {STAFF_PASSWORD_GENERATED_HELP}
        </p>
      ) : null}

      <div>
        <ul
          id={`${idPrefix}-password-checks`}
          className="space-y-1 text-xs"
          data-testid={`${idPrefix}-password-checks`}
        >
          {analysis.checks.map((check) => (
            <CheckRow key={check.id} check={check} />
          ))}
        </ul>
        <p className="mt-2 text-[11px] text-neutral-500">
          {STAFF_PASSWORD_STRENGTH_NOTE}
        </p>
      </div>

      <button
        type="submit"
        // Hard checks only. Blocking on a RECOMMENDATION would tell the operator
        // the recommendations are the standard — they are not, and the provider
        // may reject something that satisfies all of them anyway.
        disabled={pending || !analysis.canSubmit}
        className={submitButtonClassName}
        data-testid={`${idPrefix}-submit`}
      >
        {pending ? pendingLabel : submitLabel}
      </button>
    </div>
  );
}

interface ResolvedStatus {
  readonly tone: StaffPasswordStatusTone;
  readonly message: string;
  readonly hint: string | null;
}

/**
 * The single status line, in priority order.
 *
 * A server verdict outranks any local state: once the provider has answered,
 * that answer is what the operator sees until they start typing again.
 */
function resolveStatus(input: {
  analysis: ReturnType<typeof analyseStaffPassword>;
  pending: boolean;
  result: StaffCredentialFormState | null;
  operation: "issue" | "reset";
}): ResolvedStatus {
  const { analysis, pending, result, operation } = input;

  if (pending) {
    return { tone: "info", message: STAFF_PASSWORD_STATUS.submitting, hint: null };
  }

  if (result) {
    if (result.success) {
      return {
        tone: "success",
        message: result.message,
        hint: operation === "issue" ? STAFF_PASSWORD_FIRST_LOGIN_NOTE : null,
      };
    }
    return {
      tone: "error",
      message: result.message,
      hint: staffCredentialFailureHint(result.category ?? "provider_failed"),
    };
  }

  if (analysis.untouched) {
    return { tone: "neutral", message: STAFF_PASSWORD_STATUS.idle, hint: null };
  }

  if (!analysis.canSubmit) {
    return {
      tone: "warning",
      message: STAFF_PASSWORD_STATUS.localInvalid,
      hint: null,
    };
  }

  return { tone: "info", message: STAFF_PASSWORD_STATUS.localValid, hint: null };
}
