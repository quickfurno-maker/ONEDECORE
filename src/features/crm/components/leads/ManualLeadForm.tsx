"use client";

import { useActionState, useId, useMemo, useState } from "react";
import {
  LEAD_BUDGET_COMFORT_CODES,
  LEAD_PROPERTY_CODES,
  LEAD_ROOM_CODES,
  LEAD_SERVICE_CODES,
  LEAD_TIMELINE_CODES,
} from "@/features/lead-intake/planner-allowlist";
import type { CrmAssigneeDirectoryEntry } from "../../contracts/lead-detail-dtos.ts";
import type { CrmLeadSourceOption } from "../../contracts/lead-detail-dtos.ts";
import type { ManualCreateAssigneePolicy } from "../../contracts/manual-lead-contracts.ts";
import { MANUAL_LEAD_CATALOG_LABELS } from "../../contracts/manual-lead-contracts.ts";
import {
  createManualLeadAction,
  previewManualLeadDuplicateAction,
  MANUAL_LEAD_INITIAL_ACTION_STATE,
  type ManualLeadActionState,
} from "../../server/crm-manual-lead-actions.ts";
import { ManualLeadDuplicateNotice } from "./ManualLeadDuplicateNotice.tsx";

interface ManualLeadFormProps {
  readonly sources: readonly CrmLeadSourceOption[];
  readonly assigneeDirectory: readonly CrmAssigneeDirectoryEntry[];
  readonly assigneePolicy: ManualCreateAssigneePolicy;
  readonly canOverrideDuplicate: boolean;
}

const fieldClassName =
  "mt-1 block w-full min-h-11 rounded-md border border-neutral-700 bg-neutral-950 px-3 py-2 text-sm text-neutral-50 placeholder:text-neutral-500 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-400";

const labelClassName = "text-sm font-medium text-neutral-200";

function canSubmitAfterPreview(
  preview: ManualLeadActionState["duplicatePreview"] | undefined,
  canOverrideDuplicate: boolean,
  duplicateOverride: boolean
): boolean {
  if (!preview) {
    return false;
  }

  if (preview.outcomeCode === "CLEAR" || preview.outcomeCode === "REUSABLE_CONTACT") {
    return true;
  }

  if (preview.outcomeCode === "RECENT_SIMILAR") {
    return canOverrideDuplicate && duplicateOverride;
  }

  return false;
}

export function ManualLeadForm({
  sources,
  assigneeDirectory,
  assigneePolicy,
  canOverrideDuplicate,
}: ManualLeadFormProps) {
  const formId = useId();
  const errorSummaryId = `${formId}-errors`;
  const [duplicateOverride, setDuplicateOverride] = useState(false);
  const [previewState, previewAction, previewPending] = useActionState(
    previewManualLeadDuplicateAction,
    MANUAL_LEAD_INITIAL_ACTION_STATE
  );
  const [createState, createAction, createPending] = useActionState(
    createManualLeadAction,
    MANUAL_LEAD_INITIAL_ACTION_STATE
  );

  const defaultSourceId = useMemo(() => {
    const manualEntry = sources.find((source) => source.code === "manual_entry");
    return manualEntry?.id ?? sources[0]?.id ?? "";
  }, [sources]);

  const preview = previewState.duplicatePreview;
  const submitAllowed = canSubmitAfterPreview(
    preview,
    canOverrideDuplicate,
    duplicateOverride
  );

  const activeError =
    createState.success === false && createState.message
      ? createState
      : previewState.success === false && previewState.message
        ? previewState
        : null;

  return (
    <div className="space-y-6">
      <div className="rounded-md border border-neutral-800 bg-neutral-900/40 px-4 py-3 text-sm text-neutral-300">
        Creating a CRM lead does not record marketing or WhatsApp consent.
      </div>

      {activeError ? (
        <div
          id={errorSummaryId}
          role="alert"
          className="rounded-md border border-rose-800/70 bg-rose-950/40 px-4 py-3 text-sm text-rose-100"
        >
          {activeError.message}
        </div>
      ) : null}

      <form className="space-y-6 rounded-xl border border-neutral-800 bg-neutral-950/60 p-4 sm:p-6">
        <div className="grid gap-5 md:grid-cols-2">
          <div className="md:col-span-2">
            <label htmlFor={`${formId}-name`} className={labelClassName}>
              Client name
            </label>
            <input
              id={`${formId}-name`}
              name="submittedName"
              required
              minLength={2}
              maxLength={120}
              autoComplete="name"
              className={fieldClassName}
            />
          </div>

          <div>
            <label htmlFor={`${formId}-phone`} className={labelClassName}>
              Phone (E.164)
            </label>
            <input
              id={`${formId}-phone`}
              name="phone"
              type="tel"
              inputMode="tel"
              placeholder="+919876543210"
              autoComplete="tel"
              className={fieldClassName}
            />
          </div>

          <div>
            <label htmlFor={`${formId}-email`} className={labelClassName}>
              Email
            </label>
            <input
              id={`${formId}-email`}
              name="email"
              type="email"
              autoComplete="email"
              className={fieldClassName}
            />
          </div>

          <p className="md:col-span-2 text-xs text-neutral-400">
            Provide at least one contact channel: phone or email.
          </p>

          <div>
            <label htmlFor={`${formId}-service`} className={labelClassName}>
              Service
            </label>
            <select
              id={`${formId}-service`}
              name="serviceCode"
              required
              className={fieldClassName}
              defaultValue="complete-home-interiors"
            >
              {LEAD_SERVICE_CODES.map((code) => (
                <option key={code} value={code}>
                  {MANUAL_LEAD_CATALOG_LABELS.service[code]}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label htmlFor={`${formId}-property`} className={labelClassName}>
              Property type
            </label>
            <select
              id={`${formId}-property`}
              name="propertyCode"
              required
              className={fieldClassName}
              defaultValue="apartment-2bhk"
            >
              {LEAD_PROPERTY_CODES.map((code) => (
                <option key={code} value={code}>
                  {MANUAL_LEAD_CATALOG_LABELS.property[code]}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label htmlFor={`${formId}-timeline`} className={labelClassName}>
              Timeline
            </label>
            <select
              id={`${formId}-timeline`}
              name="timelineCode"
              required
              className={fieldClassName}
              defaultValue="within-3-months"
            >
              {LEAD_TIMELINE_CODES.map((code) => (
                <option key={code} value={code}>
                  {MANUAL_LEAD_CATALOG_LABELS.timeline[code]}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label htmlFor={`${formId}-source`} className={labelClassName}>
              Primary source
            </label>
            <select
              id={`${formId}-source`}
              name="primarySourceId"
              required
              className={fieldClassName}
              defaultValue={defaultSourceId}
            >
              {sources.map((source) => (
                <option key={source.id} value={source.id}>
                  {source.displayName}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label htmlFor={`${formId}-locality`} className={labelClassName}>
              Locality (optional)
            </label>
            <input
              id={`${formId}-locality`}
              name="locality"
              maxLength={120}
              className={fieldClassName}
            />
          </div>

          <div>
            <label htmlFor={`${formId}-budget`} className={labelClassName}>
              Budget comfort (optional)
            </label>
            <select
              id={`${formId}-budget`}
              name="budgetComfortCode"
              className={fieldClassName}
              defaultValue=""
            >
              <option value="">Not specified</option>
              {LEAD_BUDGET_COMFORT_CODES.map((code) => (
                <option key={code} value={code}>
                  {MANUAL_LEAD_CATALOG_LABELS.budget[code]}
                </option>
              ))}
            </select>
          </div>

          <div className="md:col-span-2">
            <fieldset>
              <legend className={labelClassName}>Rooms (optional)</legend>
              <div className="mt-2 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                {LEAD_ROOM_CODES.map((code) => (
                  <label
                    key={code}
                    className="flex min-h-11 items-center gap-2 text-sm text-neutral-300"
                  >
                    <input
                      type="checkbox"
                      name="roomCodes"
                      value={code}
                      className="size-4 rounded border-neutral-600 text-amber-500 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-400"
                    />
                    {MANUAL_LEAD_CATALOG_LABELS.room[code]}
                  </label>
                ))}
              </div>
            </fieldset>
          </div>

          <div className="md:col-span-2">
            <label htmlFor={`${formId}-message`} className={labelClassName}>
              Enquiry / message (optional)
            </label>
            <textarea
              id={`${formId}-message`}
              name="message"
              rows={4}
              maxLength={2000}
              className={fieldClassName}
            />
          </div>

          <div className="md:col-span-2">
            <label htmlFor={`${formId}-source-detail`} className={labelClassName}>
              Source detail (optional)
            </label>
            <input
              id={`${formId}-source-detail`}
              name="sourceDetail"
              maxLength={500}
              className={fieldClassName}
            />
          </div>
        </div>

        {assigneePolicy.mode === "executive_self" ? (
          <p className="text-sm text-neutral-300">
            This lead will be assigned to you when it is created.
          </p>
        ) : (
          <div>
            <label htmlFor={`${formId}-assignee`} className={labelClassName}>
              Assignee
            </label>
            <select
              id={`${formId}-assignee`}
              name="assigneeId"
              className={fieldClassName}
              defaultValue="unassigned"
            >
              <option value="unassigned">Unassigned (new queue)</option>
              {assigneePolicy.mode === "manager" && assigneePolicy.allowSelf ? (
                <option value="self">Assign to me</option>
              ) : null}
              {assigneeDirectory.map((entry) => (
                <option key={entry.userId} value={entry.userId}>
                  {entry.displayName} ({entry.roleCode})
                </option>
              ))}
            </select>
          </div>
        )}

        <input
          type="hidden"
          name="duplicateOverride"
          value={duplicateOverride ? "true" : "false"}
        />

        {preview?.outcomeCode === "RECENT_SIMILAR" && canOverrideDuplicate ? (
          <div className="space-y-3 rounded-md border border-neutral-800 bg-neutral-900/30 p-4">
            <label className="flex min-h-11 items-start gap-3 text-sm text-neutral-200">
              <input
                type="checkbox"
                checked={duplicateOverride}
                onChange={(event) => setDuplicateOverride(event.target.checked)}
                className="mt-1 size-4 rounded border-neutral-600 text-amber-500 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-400"
              />
              Override recent similar enquiry block
            </label>
            {duplicateOverride ? (
              <div>
                <label htmlFor={`${formId}-override-reason`} className={labelClassName}>
                  Override reason (required, 10–500 characters)
                </label>
                <textarea
                  id={`${formId}-override-reason`}
                  name="duplicateOverrideReason"
                  required
                  minLength={10}
                  maxLength={500}
                  rows={3}
                  className={fieldClassName}
                />
              </div>
            ) : null}
          </div>
        ) : null}

        <ManualLeadDuplicateNotice preview={preview ?? null} />

        <div className="flex flex-wrap gap-3">
          <button
            type="submit"
            formAction={previewAction}
            disabled={previewPending || createPending}
            className="inline-flex min-h-11 items-center rounded-md border border-neutral-600 px-4 py-2 text-sm font-medium text-neutral-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-400 disabled:opacity-60"
          >
            {previewPending ? "Checking…" : "Check duplicates"}
          </button>

          <button
            type="submit"
            formAction={createAction}
            disabled={!submitAllowed || createPending || previewPending}
            className="inline-flex min-h-11 items-center rounded-md bg-amber-500 px-4 py-2 text-sm font-semibold text-neutral-950 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-300 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {createPending ? "Creating lead…" : "Create lead"}
          </button>
        </div>
      </form>
    </div>
  );
}
