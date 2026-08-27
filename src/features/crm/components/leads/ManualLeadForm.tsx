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
  canonicalizeOptionalPhone,
  MANUAL_LEAD_PHONE_ERROR_MESSAGE,
  sanitizeManualLeadPhoneInput,
} from "../../lib/phone-e164.ts";
import {
  createManualLeadAction,
  previewManualLeadDuplicateAction,
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
  "crm-input mt-1 block w-full text-base sm:text-sm";

const labelClassName = "text-sm font-medium text-[var(--crm-text)]";

const sectionTitleClass =
  "text-[15px] font-semibold text-[var(--crm-text)] sm:text-sm";

const MANUAL_LEAD_INITIAL_ACTION_STATE: ManualLeadActionState = {
  success: false,
  message: "",
};

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
  const phoneErrorId = `${formId}-phone-error`;
  const [phone, setPhone] = useState("");
  const [phoneError, setPhoneError] = useState<string | null>(null);
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

  const serverPhoneError =
    createState.fieldErrors?.phone ?? previewState.fieldErrors?.phone ?? null;
  const activePhoneError = phoneError ?? serverPhoneError;

  const activeError =
    createState.success === false && createState.message
      ? createState
      : previewState.success === false && previewState.message
        ? previewState
        : null;

  const validatePhoneBeforeSubmit = (): boolean => {
    const result = canonicalizeOptionalPhone(phone);
    if (result.error) {
      setPhoneError(result.error);
      return false;
    }
    setPhoneError(null);
    return true;
  };

  return (
    <div className="space-y-5">
      <div className="rounded-[14px] border border-[var(--crm-border)] bg-[var(--crm-surface-subtle)] px-3.5 py-3 text-sm text-[var(--crm-text-secondary)]">
        Creating a CRM lead does not record marketing or WhatsApp consent.
      </div>

      {activeError && !activePhoneError ? (
        <div
          id={errorSummaryId}
          role="alert"
          className="rounded-[14px] border border-[var(--crm-danger)]/30 bg-[var(--crm-danger-soft)] px-3.5 py-3 text-sm text-[var(--crm-danger)]"
        >
          {activeError.message}
        </div>
      ) : null}

      <form className="space-y-5 rounded-[16px] border border-[var(--crm-border)] bg-[var(--crm-surface)] p-3.5 sm:p-6">
        <section className="space-y-3.5">
          <h2 className={sectionTitleClass}>Contact</h2>
          <div className="grid gap-4 md:grid-cols-2">
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
                Phone
              </label>
              <input
                id={`${formId}-phone`}
                name="phone"
                type="tel"
                inputMode="numeric"
                autoComplete="tel"
                maxLength={10}
                placeholder="9876543210"
                value={phone}
                aria-invalid={activePhoneError ? true : undefined}
                aria-describedby={
                  activePhoneError ? phoneErrorId : `${formId}-phone-hint`
                }
                onChange={(event) => {
                  setPhone(sanitizeManualLeadPhoneInput(event.target.value));
                  if (phoneError) {
                    setPhoneError(null);
                  }
                }}
                onBlur={() => {
                  if (!phone) {
                    setPhoneError(null);
                    return;
                  }
                  const result = canonicalizeOptionalPhone(phone);
                  setPhoneError(result.error);
                }}
                className={[
                  fieldClassName,
                  activePhoneError ? "border-[var(--crm-danger)]" : "",
                ]
                  .filter(Boolean)
                  .join(" ")}
              />
              <p
                id={`${formId}-phone-hint`}
                className="mt-1 text-[12px] text-[var(--crm-muted)]"
              >
                Optional if email is provided. Enter a 10-digit mobile number only.
              </p>
              {activePhoneError ? (
                <p
                  id={phoneErrorId}
                  role="alert"
                  className="mt-1 text-sm text-[var(--crm-danger)]"
                >
                  {activePhoneError || MANUAL_LEAD_PHONE_ERROR_MESSAGE}
                </p>
              ) : null}
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

            <p className="md:col-span-2 text-[12px] text-[var(--crm-muted)]">
              Provide at least one contact channel: phone or email.
            </p>
          </div>
        </section>

        <section className="space-y-3.5 border-t border-[var(--crm-border)] pt-5">
          <h2 className={sectionTitleClass}>Project basics</h2>
          <div className="grid gap-4 md:grid-cols-2">
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
                defaultValue="within-1-month"
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
          </div>
        </section>

        <section className="space-y-3.5 border-t border-[var(--crm-border)] pt-5">
          <h2 className={sectionTitleClass}>Optional details</h2>
          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <label htmlFor={`${formId}-locality`} className={labelClassName}>
                Locality
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
                Budget comfort
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
                <legend className={labelClassName}>Rooms</legend>
                <div className="mt-2 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                  {LEAD_ROOM_CODES.map((code) => (
                    <label
                      key={code}
                      className="flex min-h-11 items-center gap-2 text-sm text-[var(--crm-text-secondary)]"
                    >
                      <input
                        type="checkbox"
                        name="roomCodes"
                        value={code}
                        className="size-4 rounded border-[var(--crm-border-strong)] text-[var(--crm-primary)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--crm-primary)]"
                      />
                      {MANUAL_LEAD_CATALOG_LABELS.room[code]}
                    </label>
                  ))}
                </div>
              </fieldset>
            </div>

            <div className="md:col-span-2">
              <label htmlFor={`${formId}-message`} className={labelClassName}>
                Message
              </label>
              <textarea
                id={`${formId}-message`}
                name="message"
                rows={3}
                maxLength={2000}
                className={fieldClassName}
              />
            </div>

            <div className="md:col-span-2">
              <label htmlFor={`${formId}-source-detail`} className={labelClassName}>
                Source detail
              </label>
              <input
                id={`${formId}-source-detail`}
                name="sourceDetail"
                maxLength={500}
                className={fieldClassName}
              />
            </div>
          </div>
        </section>

        <section className="space-y-3.5 border-t border-[var(--crm-border)] pt-5">
          <h2 className={sectionTitleClass}>Assignment</h2>
          {assigneePolicy.mode === "executive_self" ? (
            <p className="text-sm text-[var(--crm-text-secondary)]">
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
        </section>

        <input
          type="hidden"
          name="duplicateOverride"
          value={duplicateOverride ? "true" : "false"}
        />

        {preview?.outcomeCode === "RECENT_SIMILAR" && canOverrideDuplicate ? (
          <div className="space-y-3 rounded-[14px] border border-[var(--crm-border)] bg-[var(--crm-surface-subtle)] p-3.5">
            <label className="flex min-h-11 items-start gap-3 text-sm text-[var(--crm-text)]">
              <input
                type="checkbox"
                checked={duplicateOverride}
                onChange={(event) => setDuplicateOverride(event.target.checked)}
                className="mt-1 size-4 rounded border-[var(--crm-border-strong)] text-[var(--crm-primary)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--crm-primary)]"
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

        <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap">
          <button
            type="submit"
            formAction={(formData) => {
              if (!validatePhoneBeforeSubmit()) {
                return;
              }
              previewAction(formData);
            }}
            disabled={previewPending || createPending}
            className="crm-btn crm-btn-secondary min-h-11 w-full sm:w-auto"
          >
            {previewPending ? "Checking…" : "Check duplicates"}
          </button>

          <button
            type="submit"
            formAction={(formData) => {
              if (!validatePhoneBeforeSubmit()) {
                return;
              }
              createAction(formData);
            }}
            disabled={!submitAllowed || createPending || previewPending}
            className="crm-btn crm-btn-primary min-h-11 w-full sm:w-auto"
          >
            {createPending ? "Creating lead…" : "Create lead"}
          </button>
        </div>
      </form>
    </div>
  );
}
