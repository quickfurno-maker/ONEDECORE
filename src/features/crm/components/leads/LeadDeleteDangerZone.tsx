"use client";

import { useActionState, useId, useState } from "react";
import {
  LEAD_DELETE_CONFIRMATION,
  LEAD_DELETE_IDLE_STATE,
  LEAD_DELETE_REASON_MAX,
  LEAD_DELETE_REASON_MIN,
} from "../../contracts/lead-delete-contracts.ts";
import { deleteLeadAction } from "../../server/crm-lead-delete-actions.ts";

/**
 * The Super Admin's Danger Zone on the enquiry detail page.
 *
 * WHY IT LOOKS LIKE THIS
 *
 * Deleting an enquiry is the only action in the CRM that takes something away
 * from every other person's workspace. So it is at the bottom, behind its own
 * heading, and it costs a sentence and an exact word to reach — not because
 * anyone distrusts the owner, but because a destructive control that is easy to
 * hit by accident eventually is.
 *
 * The copy says what actually happens: the enquiry leaves the workspaces, the
 * record stays. Calling this "erasure" would be a lie, and Closed Lost is named
 * explicitly because it is what most people reaching for Delete actually want.
 *
 * The component renders only when the caller holds `leads.delete`. That is
 * presentation: the server action re-checks it and the database RPC checks the
 * permission AND the `super_admin` role again.
 */

interface LeadDeleteDangerZoneProps {
  readonly leadId: string;
  readonly leadReference: string;
  readonly clientName: string;
  readonly currentStage: string;
  /** The `updated_at` this page was rendered from. Makes the delete stale-safe. */
  readonly expectedUpdatedAt: string;
}

export function LeadDeleteDangerZone({
  leadId,
  leadReference,
  clientName,
  currentStage,
  expectedUpdatedAt,
}: LeadDeleteDangerZoneProps) {
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const reasonId = useId();
  const confirmationId = useId();
  const titleId = useId();

  const [state, formAction, pending] = useActionState(
    deleteLeadAction,
    LEAD_DELETE_IDLE_STATE
  );

  const trimmedReason = reason.trim();
  const canSubmit =
    trimmedReason.length >= LEAD_DELETE_REASON_MIN &&
    trimmedReason.length <= LEAD_DELETE_REASON_MAX &&
    confirmation === LEAD_DELETE_CONFIRMATION &&
    !pending;

  return (
    <section
      aria-labelledby={titleId}
      className="rounded-xl border border-red-900/50 bg-red-950/10 p-5"
    >
      <h2 id={titleId} className="text-sm font-semibold text-red-300">
        Danger zone
      </h2>
      <p className="mt-2 max-w-2xl text-xs leading-relaxed text-neutral-400">
        Deleting removes this enquiry from the lead list, pipeline, My Day,
        calendar, reports and the mobile app. The record and its history are kept
        for audit. There is no undo from this screen.
      </p>
      <p className="mt-2 max-w-2xl text-xs leading-relaxed text-neutral-400">
        If the customer simply did not buy, use{" "}
        <span className="font-semibold text-neutral-300">Closed Lost</span>{" "}
        instead — it keeps the enquiry in your sales reporting.
      </p>

      {!open ? (
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="mt-4 inline-flex min-h-11 items-center rounded-md border border-red-800 bg-red-950/40 px-4 text-xs font-semibold uppercase tracking-wider text-red-200 transition-colors hover:border-red-700 hover:text-red-100"
        >
          Delete enquiry
        </button>
      ) : (
        <form action={formAction} className="mt-5 space-y-4">
          <input type="hidden" name="leadId" value={leadId} />
          <input
            type="hidden"
            name="expectedUpdatedAt"
            value={expectedUpdatedAt}
          />

          <dl className="grid gap-3 rounded-lg border border-neutral-800 bg-neutral-950/60 p-4 text-xs sm:grid-cols-3">
            <div>
              <dt className="text-[10px] uppercase tracking-wider text-neutral-500">
                Client
              </dt>
              <dd className="mt-1 text-neutral-200">{clientName}</dd>
            </div>
            <div>
              <dt className="text-[10px] uppercase tracking-wider text-neutral-500">
                Stage
              </dt>
              <dd className="mt-1 text-neutral-200">{currentStage}</dd>
            </div>
            <div>
              <dt className="text-[10px] uppercase tracking-wider text-neutral-500">
                Reference
              </dt>
              <dd className="mt-1 break-all text-neutral-400">{leadReference}</dd>
            </div>
          </dl>

          <p className="text-xs text-neutral-400">
            An enquiry with quotation or project history cannot be deleted.
          </p>

          <div>
            <label
              htmlFor={reasonId}
              className="block text-xs font-semibold uppercase tracking-wider text-neutral-300"
            >
              Why are you deleting this enquiry?
            </label>
            <textarea
              id={reasonId}
              name="reason"
              value={reason}
              onChange={(event) => setReason(event.target.value)}
              rows={3}
              minLength={LEAD_DELETE_REASON_MIN}
              maxLength={LEAD_DELETE_REASON_MAX}
              required
              className="mt-2 block w-full rounded-md border border-neutral-700 bg-neutral-900/80 px-3 py-2 text-sm text-neutral-100 placeholder-neutral-500 focus:border-red-500 focus:outline-none focus:ring-1 focus:ring-red-500"
              placeholder="Duplicate enquiry created in error by the website form."
            />
            <p className="mt-1 text-[11px] text-neutral-500">
              {LEAD_DELETE_REASON_MIN}–{LEAD_DELETE_REASON_MAX} characters. Stored
              with the audit record.
            </p>
            {state.fieldErrors?.reason ? (
              <p className="mt-1 text-[11px] text-red-300">
                {state.fieldErrors.reason}
              </p>
            ) : null}
          </div>

          <div>
            <label
              htmlFor={confirmationId}
              className="block text-xs font-semibold uppercase tracking-wider text-neutral-300"
            >
              Type {LEAD_DELETE_CONFIRMATION} to confirm
            </label>
            <input
              id={confirmationId}
              name="confirmation"
              value={confirmation}
              onChange={(event) => setConfirmation(event.target.value)}
              autoComplete="off"
              required
              className="mt-2 block min-h-11 w-full rounded-md border border-neutral-700 bg-neutral-900/80 px-3 py-2 text-sm text-neutral-100 focus:border-red-500 focus:outline-none focus:ring-1 focus:ring-red-500 sm:max-w-xs"
            />
            {state.fieldErrors?.confirmation ? (
              <p className="mt-1 text-[11px] text-red-300">
                {state.fieldErrors.confirmation}
              </p>
            ) : null}
          </div>

          {state.message && !state.success ? (
            <p role="alert" className="text-xs font-medium text-red-300">
              {state.message}
            </p>
          ) : null}

          <div className="flex flex-wrap gap-3">
            <button
              type="submit"
              disabled={!canSubmit}
              className="inline-flex min-h-11 items-center rounded-md bg-red-700 px-4 text-xs font-semibold uppercase tracking-wider text-red-50 transition-colors hover:bg-red-600 disabled:cursor-not-allowed disabled:opacity-40"
            >
              {pending ? "Deleting…" : "Delete enquiry"}
            </button>
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="inline-flex min-h-11 items-center rounded-md border border-neutral-700 px-4 text-xs font-semibold uppercase tracking-wider text-neutral-300 transition-colors hover:border-neutral-600"
            >
              Cancel
            </button>
          </div>
        </form>
      )}
    </section>
  );
}
