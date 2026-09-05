"use client";

import { useActionState } from "react";
import type {
  StaffCredentialOperationSummary,
  StaffDetail,
} from "../contracts/dto.ts";
import { STAFF_ACCESS_STATE_LABELS } from "../contracts/permissions.ts";
import {
  INITIAL_STAFF_CREDENTIAL_FORM_STATE,
  type StaffCredentialFormState,
} from "../contracts/staff-credential-form-state.ts";
import { staffLoginUsername } from "../contracts/staff-login-phone.ts";
import { StaffPasswordSection } from "./StaffPasswordSection.tsx";
import {
  changeStaffLoginPhoneAction,
  issueStaffCredentialsAction,
  reactivateStaffAccessAction,
  resetStaffPasswordAction,
  revokeStaffAccessAction,
} from "../server/staff-credential-form-actions.ts";

const fieldClassName =
  "mt-1 block w-full min-h-11 rounded-md border border-neutral-700 bg-neutral-950 px-3 py-2 text-sm text-neutral-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-400";

const buttonClassName =
  "inline-flex min-h-11 items-center rounded-md bg-amber-500 px-4 py-2 text-sm font-semibold text-neutral-950 disabled:opacity-60";

const dangerButtonClassName =
  "inline-flex min-h-11 items-center rounded-md border border-red-800 px-4 py-2 text-sm font-semibold text-red-200 hover:border-red-500 disabled:opacity-60";

function Feedback({ state }: { readonly state: StaffCredentialFormState }) {
  if (!state.message) {
    return null;
  }

  return (
    <p
      role="status"
      aria-live="polite"
      className={
        state.success
          ? "rounded-md border border-emerald-900/60 bg-emerald-950/30 px-3 py-2 text-sm text-emerald-100"
          : "rounded-md border border-red-900/60 bg-red-950/30 px-3 py-2 text-sm text-red-100"
      }
    >
      {state.message}
      {state.success && state.loginUsername ? (
        <>
          {" "}
          Username: <span className="font-semibold">{state.loginUsername}</span>
        </>
      ) : null}
    </p>
  );
}

function ReasonField({ idPrefix }: { readonly idPrefix: string }) {
  return (
    <div>
      <label htmlFor={`${idPrefix}-reason`} className="text-sm font-medium text-neutral-200">
        Reason
      </label>
      <input
        id={`${idPrefix}-reason`}
        name="reason"
        type="text"
        required
        minLength={3}
        maxLength={200}
        className={fieldClassName}
      />
      <p className="mt-1 text-xs text-neutral-500">Recorded in the audit trail.</p>
    </div>
  );
}

interface StaffLoginAccessPanelProps {
  readonly staff: StaffDetail;
  /** Super Admin only. Enforced again in the RPC, so this is not the gate. */
  readonly canManageCredentials: boolean;
  /** An unfinished operation, so a half-done change is visible and retryable. */
  readonly pendingOperation?: StaffCredentialOperationSummary | null;
}

/**
 * Super Admin control over one staff member's login.
 *
 * The username IS the staff member's 10-digit mobile number, and there is no
 * separate login id. No control anywhere reveals an existing password: it can
 * only ever be replaced, never read back.
 */
export function StaffLoginAccessPanel({
  staff,
  canManageCredentials,
  pendingOperation = null,
}: StaffLoginAccessPanelProps) {
  const [issueState, issue, issuePending] = useActionState(
    issueStaffCredentialsAction,
    INITIAL_STAFF_CREDENTIAL_FORM_STATE
  );
  const [resetState, reset, resetPending] = useActionState(
    resetStaffPasswordAction,
    INITIAL_STAFF_CREDENTIAL_FORM_STATE
  );
  const [revokeState, revoke, revokePending] = useActionState(
    revokeStaffAccessAction,
    INITIAL_STAFF_CREDENTIAL_FORM_STATE
  );
  const [reactivateState, reactivate, reactivatePending] = useActionState(
    reactivateStaffAccessAction,
    INITIAL_STAFF_CREDENTIAL_FORM_STATE
  );
  const [phoneState, changePhone, phonePending] = useActionState(
    changeStaffLoginPhoneAction,
    INITIAL_STAFF_CREDENTIAL_FORM_STATE
  );

  const username = staffLoginUsername(staff.loginPhoneE164);
  const hasCredentials = username !== null;
  const isRevoked = staff.accessState === "revoked";

  // An unresolved phone change means Supabase Auth may already hold the NEW
  // number while this record still shows the old one. Ordinary reactivation
  // would re-open access on top of that split, so the only offer is to retry
  // the change. The server refuses anything else regardless of what is rendered.
  const pendingPhoneChange =
    pendingOperation?.operation === "change_phone" ? pendingOperation : null;

  // The Staff Login ID is the employee's OWN number, read from their employment
  // record. It is display-only here: the server derives it again from the same
  // record, so this control cannot choose a different login.
  const employmentUsername = staffLoginUsername(staff.phoneE164);

  return (
    <section className="rounded-lg border border-neutral-800 bg-neutral-900/60 p-6">
      <h3 className="text-sm font-semibold uppercase tracking-wide text-neutral-300">
        Login &amp; access
      </h3>

      <p className="mt-2 text-sm text-neutral-400">
        Employment and login are separate. This staff member is employed and fully
        manageable either way — this section only controls signing in.
      </p>

      <dl className="mt-4 grid gap-3 sm:grid-cols-2">
        <div>
          <dt className="text-xs uppercase tracking-wide text-neutral-500">Username</dt>
          <dd className="mt-1 text-sm font-semibold text-neutral-100">
            {username ?? "Not issued"}
          </dd>
          {username ? (
            <p className="mt-1 text-xs text-neutral-500">
              Staff type these 10 digits. Stored as {staff.loginPhoneE164}.
            </p>
          ) : null}
        </div>
        <div>
          <dt className="text-xs uppercase tracking-wide text-neutral-500">Access state</dt>
          <dd className="mt-1 text-sm font-semibold text-neutral-100">
            {STAFF_ACCESS_STATE_LABELS[staff.accessState]}
          </dd>
          {staff.accessState === "credentials_ready" ? (
            <p className="mt-1 text-xs text-neutral-500">
              Credentials exist. This becomes Active only after a real first sign-in.
            </p>
          ) : null}
        </div>
      </dl>

      {pendingOperation ? (
        <p
          role="status"
          className="mt-4 rounded-md border border-amber-900/60 bg-amber-950/30 px-3 py-2 text-sm text-amber-100"
        >
          A previous <span className="font-semibold">{pendingOperation.operation}</span>{" "}
          operation did not finish ({pendingOperation.status}). Access is fail-closed;
          run it again to complete it.
          {pendingPhoneChange ? (
            <>
              {" "}
              Until this phone change is completed no other credential action is
              available — including reactivation.
            </>
          ) : null}
        </p>
      ) : null}

      {!canManageCredentials ? (
        <p className="mt-4 rounded-md border border-neutral-800 bg-neutral-950/60 px-3 py-2 text-sm text-neutral-400">
          Only a Super Admin can issue or change staff login credentials.
        </p>
      ) : (
        <div className="mt-6 space-y-8">
          {!hasCredentials && employmentUsername === null ? (
            <p className="rounded-md border border-amber-900/60 bg-amber-950/30 px-3 py-2 text-sm text-amber-100">
              This staff member has no valid 10-digit mobile number on their
              employment record. Update the employment details first — the login
              username is always their own number.
            </p>
          ) : null}

          {!hasCredentials && employmentUsername !== null ? (
            <form action={issue} className="space-y-4">
              <input type="hidden" name="staffId" value={staff.staffId} />
              <input type="hidden" name="displayName" value={staff.displayName} />
              <div>
                <span className="text-sm font-medium text-neutral-200">
                  Staff Login ID
                </span>
                <p
                  data-testid="issue-login-id"
                  className="mt-1 rounded-md border border-neutral-800 bg-neutral-950 px-3 py-2 text-sm font-semibold text-neutral-100"
                >
                  {employmentUsername}
                </p>
                <p className="mt-1 text-xs text-neutral-500">
                  Taken from this staff member&rsquo;s employment record and saved as
                  +91{employmentUsername}. It cannot be edited here — after credentials
                  exist, use Change login phone.
                </p>
              </div>
              <StaffPasswordSection
                idPrefix="issue"
                operation="issue"
                state={issueState}
                pending={issuePending}
                submitLabel="Issue credentials"
                pendingLabel="Issuing…"
              />
            </form>
          ) : null}

          {pendingPhoneChange ? (
            <form action={changePhone} className="space-y-4">
              <input type="hidden" name="staffId" value={staff.staffId} />
              <h4 className="text-sm font-semibold text-neutral-200">
                Retry pending phone change
              </h4>
              <p className="text-xs text-neutral-500">
                Supabase Auth may already hold{" "}
                <span className="font-semibold">
                  {pendingPhoneChange.targetLoginUsername ?? "the new number"}
                </span>
                . Retry to finish moving the login and re-open access. Reactivation
                is unavailable until this resolves.
              </p>
              <div>
                <label
                  htmlFor="retry-phone"
                  className="text-sm font-medium text-neutral-200"
                >
                  New mobile number
                </label>
                <input
                  id="retry-phone"
                  name="loginPhone"
                  type="tel"
                  inputMode="numeric"
                  required
                  maxLength={10}
                  defaultValue={pendingPhoneChange.targetLoginUsername ?? ""}
                  className={fieldClassName}
                />
              </div>
              <ReasonField idPrefix="retry" />
              <button type="submit" disabled={phonePending} className={buttonClassName}>
                {phonePending ? "Retrying…" : "Retry phone change"}
              </button>
              <Feedback state={phoneState} />
            </form>
          ) : null}

          {hasCredentials && !isRevoked && !pendingPhoneChange ? (
            <>
              <form action={reset} className="space-y-4">
                <input type="hidden" name="staffId" value={staff.staffId} />
                <h4 className="text-sm font-semibold text-neutral-200">
                  Set / reset password
                </h4>
                <StaffPasswordSection
                  idPrefix="reset"
                  operation="reset"
                  state={resetState}
                  pending={resetPending}
                  submitLabel="Set / reset password"
                  pendingLabel="Updating…"
                />
              </form>

              <form action={changePhone} className="space-y-4">
                <input type="hidden" name="staffId" value={staff.staffId} />
                <h4 className="text-sm font-semibold text-neutral-200">
                  Change login phone
                </h4>
                <div>
                  <label htmlFor="change-phone" className="text-sm font-medium text-neutral-200">
                    New mobile number
                  </label>
                  <input
                    id="change-phone"
                    name="loginPhone"
                    type="tel"
                    inputMode="numeric"
                    required
                    maxLength={10}
                    placeholder="9812345678"
                    className={fieldClassName}
                  />
                  <p className="mt-1 text-xs text-neutral-500">
                    Updates the staff record and Supabase Auth together and signs the
                    account out. The previous number stops working immediately. The
                    password and the staff id are unchanged.
                  </p>
                </div>
                <ReasonField idPrefix="change" />
                <button type="submit" disabled={phonePending} className={buttonClassName}>
                  {phonePending ? "Changing…" : "Change login phone"}
                </button>
                <Feedback state={phoneState} />
              </form>

              <form action={revoke} className="space-y-4">
                <input type="hidden" name="staffId" value={staff.staffId} />
                <h4 className="text-sm font-semibold text-neutral-200">Revoke access</h4>
                <p className="text-xs text-neutral-500">
                  Blocks sign-in and ends current sessions. Employment, attendance and
                  salary records are untouched.
                </p>
                <ReasonField idPrefix="revoke" />
                <button
                  type="submit"
                  disabled={revokePending}
                  className={dangerButtonClassName}
                >
                  {revokePending ? "Revoking…" : "Revoke access"}
                </button>
                <Feedback state={revokeState} />
              </form>
            </>
          ) : null}

          {isRevoked && !pendingPhoneChange ? (
            <form action={reactivate} className="space-y-4">
              <input type="hidden" name="staffId" value={staff.staffId} />
              <h4 className="text-sm font-semibold text-neutral-200">Reactivate</h4>
              <p className="text-xs text-neutral-500">
                Restores access without changing the password or the login number.
              </p>
              <ReasonField idPrefix="reactivate" />
              <button
                type="submit"
                disabled={reactivatePending}
                className={buttonClassName}
              >
                {reactivatePending ? "Reactivating…" : "Reactivate access"}
              </button>
              <Feedback state={reactivateState} />
            </form>
          ) : null}
        </div>
      )}
    </section>
  );
}
