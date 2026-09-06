"use client";

import { useState } from "react";
import {
  LOGIN_PORTAL_COPY,
  type LoginPortal,
} from "@/features/staff-admin/contracts/login-portal";

interface LoginFormProps {
  /** Which identity contract this form collects. Decided on the server. */
  portal: LoginPortal;
  nextParam?: string;
  /** Set when the previous attempt failed. The reason is never disclosed. */
  hasError?: boolean;
}

/**
 * An ordinary HTML form posting to an ordinary Route Handler.
 *
 * This deliberately does NOT use `useActionState`/a Server Action. In production
 * the Server Action authenticated successfully and the browser still received no
 * session cookie — the `Set-Cookie` was written during an RSC mutation that the
 * navigation aborted ("The destination stream closed early"), so it never
 * applied. A plain POST answered with a plain 303 makes cookie delivery an
 * ordinary HTTP response property instead.
 *
 * The component stays a Client Component only for the pending affordance, which
 * is presentation. If its JavaScript never loads, the form still submits and
 * login still works.
 *
 * WHY THE CREDENTIAL FIELDS ARE NEVER `disabled`
 *
 * They were, while `isPending` was true, and that silently ate the login.
 *
 * A disabled control is not a SUCCESSFUL control: the HTML form-submission
 * algorithm skips it when building the entry list. `onSubmit` sets `isPending`,
 * React flushes that state synchronously for a discrete event, and the browser
 * then serialises a form whose identifier and password inputs are disabled. What
 * left the browser was `portal=admin` and nothing else.
 *
 * The server did exactly what it should with that: no identifier, no password,
 * fail closed, "Invalid admin credentials." — so the message named the
 * credential, and the credential was never sent.
 *
 * Production evidence: a direct POST to the deployed route with the same
 * credential returned 303 to /admin, and after a browser attempt with the same
 * credential `auth.users.last_sign_in_at` did not advance. The browser attempt
 * was failing BEFORE Supabase was ever asked.
 *
 * `readOnly` gives the same "hands off, this is in flight" behaviour and keeps
 * the field successful, so the values still travel. Only the submit button is
 * disabled, which is what actually prevents a double submission.
 *
 * TWO PORTALS, ONE FORM
 *
 * `portal` arrives already resolved from the server component, so the field
 * type, the labels and the hidden `portal` value are correct in the very first
 * HTML — there is no client-side toggle that could disagree with them, and no
 * state to get wrong before hydration. The server re-derives and re-validates
 * the portal on submit regardless; this half is presentation.
 */
export function LoginForm({ portal, nextParam, hasError = false }: LoginFormProps) {
  const [isPending, setIsPending] = useState(false);

  const copy = LOGIN_PORTAL_COPY[portal];
  const isStaff = portal === "staff";

  return (
    <form
      method="post"
      action="/auth/login/submit"
      className="space-y-6"
      onSubmit={() => setIsPending(true)}
    >
      {/*
       * The portal travels WITH the credentials rather than being re-derived
       * from their shape. A submission that names its own contract is what lets
       * the server refuse a mobile number posted to the admin portal instead of
       * silently trying it against the staff namespace.
       */}
      <input type="hidden" name="portal" value={portal} />
      {nextParam && <input type="hidden" name="next" value={nextParam} />}

      {hasError && (
        <div
          role="alert"
          aria-live="polite"
          className="rounded-md border border-red-500/40 bg-red-950/30 p-3.5 text-xs font-medium text-red-200"
        >
          {copy.errorMessage}
        </div>
      )}

      <div>
        <label
          htmlFor="identifier"
          className="block text-xs font-semibold uppercase tracking-wider text-amber-200/80"
        >
          {copy.identifierLabel}
        </label>
        <input
          /*
           * Keyed by portal so a navigation between the two never carries the
           * other portal's typed value into a field that cannot accept it.
           */
          key={portal}
          id="identifier"
          name="identifier"
          /*
           * The staff field is a NUMBER field in every way a phone keypad cares
           * about: `tel` + numeric inputMode raises the digit keyboard, and the
           * 10-character ceiling matches the canonical bare form the server
           * accepts. `pattern` is an extra native hint only — no keystroke
           * filtering, which is what breaks Backspace, paste and IME input.
           */
          type={isStaff ? "tel" : "email"}
          inputMode={isStaff ? "numeric" : "email"}
          /*
           * `username`, on BOTH portals.
           *
           * This is a login identifier, not a contact field. Password managers
           * pair `username` with `current-password`; labelling the admin field
           * `email` makes some of them treat it as a profile detail and offer
           * the wrong entry, or none. The keyboard is still chosen by
           * type/inputMode above, so the mobile keypad is unaffected.
           */
          autoComplete="username"
          required
          maxLength={isStaff ? 10 : 254}
          pattern={isStaff ? "[0-9]{10}" : undefined}
          /*
           * `readOnly`, NEVER `disabled` — see the docblock. A disabled input is
           * omitted from the native submission entirely, which is how a correct
           * password came to be reported as invalid.
           */
          readOnly={isPending}
          placeholder={copy.identifierPlaceholder}
          aria-describedby={copy.identifierHelp ? "identifier-hint" : undefined}
          className="mt-2 block min-h-11 w-full rounded-md border border-neutral-700 bg-neutral-900/80 px-3.5 py-2.5 text-base text-neutral-100 placeholder-neutral-500 transition-colors focus:border-amber-400 focus:outline-none focus:ring-1 focus:ring-amber-400 read-only:opacity-50 sm:text-sm"
        />
        {copy.identifierHelp && (
          <p id="identifier-hint" className="mt-2 text-[11px] leading-relaxed text-neutral-400">
            {copy.identifierHelp}
          </p>
        )}
      </div>

      <div>
        <label
          htmlFor="password"
          className="block text-xs font-semibold uppercase tracking-wider text-amber-200/80"
        >
          Password
        </label>
        <input
          id="password"
          name="password"
          type="password"
          autoComplete="current-password"
          required
          maxLength={128}
          // Read-only while in flight, never disabled: a disabled password field
          // is not submitted at all.
          readOnly={isPending}
          placeholder="••••••••••••"
          className="mt-2 block min-h-11 w-full rounded-md border border-neutral-700 bg-neutral-900/80 px-3.5 py-2.5 text-base text-neutral-100 placeholder-neutral-500 transition-colors focus:border-amber-400 focus:outline-none focus:ring-1 focus:ring-amber-400 read-only:opacity-50 sm:text-sm"
        />
      </div>

      <div>
        <button
          type="submit"
          /*
           * The button may safely be disabled: it submits no value of its own,
           * and disabling it is what actually prevents a double submission.
           */
          disabled={isPending}
          className="flex min-h-11 w-full items-center justify-center rounded-md bg-gradient-to-r from-amber-600 to-amber-500 px-4 py-3 text-xs font-bold uppercase tracking-widest text-neutral-950 transition-all hover:from-amber-500 hover:to-amber-400 focus:outline-none focus:ring-2 focus:ring-amber-400 focus:ring-offset-2 focus:ring-offset-neutral-950 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {isPending ? "Authenticating..." : copy.submitLabel}
        </button>
      </div>
    </form>
  );
}
