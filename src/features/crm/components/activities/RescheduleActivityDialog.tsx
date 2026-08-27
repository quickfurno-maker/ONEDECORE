"use client";

import { useActionState, useEffect, useId, useState } from "react";
import { useRouter } from "next/navigation";
import { INITIAL_CRM_ACTIVITY_ACTION_STATE } from "../../contracts/activity-contracts.ts";
import type { CrmLeadDetailFollowUp } from "../../contracts/lead-detail-dtos.ts";
import {
  appendAbsoluteTimestampsFromLocalFields,
  defaultFutureDatetimeLocalValue,
  isoToDatetimeLocalValue,
} from "../../lib/local-datetime-to-iso.ts";
import { rescheduleLeadActivityAction } from "../../server/crm-activity-actions.ts";
import { CrmDateTimeField } from "../ui/CrmDateTimeField.tsx";
import { CrmActivityDialogShell } from "./CrmActivityDialogShell.tsx";

type ReminderMode = "unchanged" | "set" | "clear";

interface RescheduleActivityDialogProps {
  readonly open: boolean;
  readonly activity: CrmLeadDetailFollowUp | null;
  readonly onClose: () => void;
}

export function RescheduleActivityDialog({
  open,
  activity,
  onClose,
}: RescheduleActivityDialogProps) {
  const router = useRouter();
  const titleId = useId();
  const [reminderMode, setReminderMode] = useState<ReminderMode>("unchanged");
  const [clientError, setClientError] = useState<string | null>(null);
  const [state, formAction, pending] = useActionState(
    rescheduleLeadActivityAction,
    INITIAL_CRM_ACTIVITY_ACTION_STATE
  );

  useEffect(() => {
    if (state.success) {
      router.refresh();
      onClose();
    }
  }, [state.success, router, onClose]);

  if (!activity) {
    return null;
  }

  const fieldErrors = state.fieldErrors ?? {};

  const submitForm = (formData: FormData) => {
    setClientError(null);
    formData.set("clearReminder", reminderMode === "clear" ? "true" : "false");

    const mappings =
      reminderMode === "set"
        ? [
            { local: "dueAtLocal", absolute: "dueAt", required: true as const },
            {
              local: "reminderAtLocal",
              absolute: "reminderAt",
              required: true as const,
            },
          ]
        : [{ local: "dueAtLocal", absolute: "dueAt", required: true as const }];

    const ok = appendAbsoluteTimestampsFromLocalFields(formData, mappings);
    if (!ok) {
      setClientError("Enter a valid due date/time.");
      return;
    }
    formAction(formData);
  };

  return (
    <CrmActivityDialogShell
      open={open}
      title="Reschedule activity"
      titleId={titleId}
      onClose={onClose}
      testId="crm-reschedule-activity-dialog"
    >
      <form action={submitForm} className="space-y-4">
        <input type="hidden" name="activityId" value={activity.id} />

        <div>
          <CrmDateTimeField
            id={`${titleId}-due`}
            name="dueAtLocal"
            label="New due date and time"
            required
            defaultValue={isoToDatetimeLocalValue(activity.dueAt)}
            hasError={Boolean(fieldErrors.dueAt)}
            data-testid="crm-reschedule-due"
          />
          {fieldErrors.dueAt ? (
            <p className="mt-1 text-xs text-[var(--crm-danger)]" role="alert">
              {fieldErrors.dueAt}
            </p>
          ) : null}
        </div>

        <fieldset>
          <legend className="text-sm font-medium text-[var(--crm-text-secondary)]">Reminder</legend>
          <div className="mt-2 space-y-2">
            {(
              [
                ["unchanged", "Keep reminder unchanged"],
                ["set", "Set reminder"],
                ["clear", "Clear reminder"],
              ] as const
            ).map(([mode, label]) => (
              <label
                key={mode}
                className="flex items-center gap-2 text-sm text-[var(--crm-text)]"
              >
                <input
                  type="radio"
                  name="reminderMode"
                  checked={reminderMode === mode}
                  onChange={() => setReminderMode(mode)}
                  data-testid={`crm-reschedule-reminder-${mode}`}
                />
                {label}
              </label>
            ))}
          </div>
        </fieldset>

        {reminderMode === "set" ? (
          <div>
            <CrmDateTimeField
              id={`${titleId}-reminder`}
              name="reminderAtLocal"
              label="Reminder date and time"
              required
              clearable
              defaultValue={
                activity.reminderAt
                  ? isoToDatetimeLocalValue(activity.reminderAt)
                  : defaultFutureDatetimeLocalValue(12)
              }
              hasError={Boolean(fieldErrors.reminderAt)}
              data-testid="crm-reschedule-reminder-at"
            />
          </div>
        ) : null}

        {clientError ? (
          <p className="text-sm text-[var(--crm-danger)]" role="alert">
            {clientError}
          </p>
        ) : null}
        {state.message && !state.success ? (
          <p className="text-sm text-[var(--crm-danger)]" role="alert">
            {state.message}
          </p>
        ) : null}

        <div className="flex flex-wrap justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="crm-btn crm-btn-secondary min-h-11"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={pending}
            className="crm-btn crm-btn-primary disabled:opacity-60"
            data-testid="crm-reschedule-submit"
          >
            {pending ? "Saving…" : "Save reschedule"}
          </button>
        </div>
      </form>
    </CrmActivityDialogShell>
  );
}
