"use client";

import {
  useActionState,
  useEffect,
  useId,
  useRef,
  useState,
  type RefObject,
} from "react";
import { useRouter } from "next/navigation";
import {
  INITIAL_CRM_ACTIVITY_ACTION_STATE,
  type CrmActivityType,
} from "../../contracts/activity-contracts.ts";
import type { CrmAssigneeDirectoryEntry } from "../../contracts/lead-detail-dtos.ts";
import {
  appendAbsoluteTimestampsFromLocalFields,
  defaultFutureDatetimeLocalValue,
} from "../../lib/local-datetime-to-iso.ts";
import { createLeadActivityAction } from "../../server/crm-activity-actions.ts";
import {
  CRM_ACTIVITY_DEFAULT_DURATIONS,
  CRM_ACTIVITY_SUGGESTED_TITLES,
  activityPriorityOptions,
  activityTypeOptions,
  fieldErrorId,
  inputClassName,
} from "./activity-ui-utils.ts";

interface CreateActivityFormProps {
  readonly leadId: string;
  readonly canChooseOwner: boolean;
  readonly assigneeDirectory: readonly CrmAssigneeDirectoryEntry[];
  readonly quotationId: string | null;
  readonly quotationLabel: string | null;
  readonly formRef?: RefObject<HTMLFormElement | null>;
  readonly defaultPrimary?: boolean;
}

export function CreateActivityForm({
  leadId,
  canChooseOwner,
  assigneeDirectory,
  quotationId,
  quotationLabel,
  formRef,
  defaultPrimary = false,
}: CreateActivityFormProps) {
  const router = useRouter();
  const formId = useId();
  const internalRef = useRef<HTMLFormElement>(null);
  const resolvedRef = formRef ?? internalRef;
  const [activityType, setActivityType] = useState<CrmActivityType>("call");
  const [title, setTitle] = useState(CRM_ACTIVITY_SUGGESTED_TITLES.call);
  const [titleTouched, setTitleTouched] = useState(false);
  const [durationMinutes, setDurationMinutes] = useState(
    String(CRM_ACTIVITY_DEFAULT_DURATIONS.call)
  );
  const [clientError, setClientError] = useState<string | null>(null);
  const [state, formAction, pending] = useActionState(
    createLeadActivityAction,
    INITIAL_CRM_ACTIVITY_ACTION_STATE
  );

  useEffect(() => {
    if (state.success) {
      router.refresh();
    }
  }, [state.success, router]);

  const handleTypeChange = (nextType: CrmActivityType) => {
    setActivityType(nextType);
    if (!titleTouched) {
      setTitle(CRM_ACTIVITY_SUGGESTED_TITLES[nextType]);
    }
    setDurationMinutes(String(CRM_ACTIVITY_DEFAULT_DURATIONS[nextType]));
  };

  const submitForm = (formData: FormData) => {
    setClientError(null);
    const ok = appendAbsoluteTimestampsFromLocalFields(formData, [
      { local: "dueAtLocal", absolute: "dueAt", required: true },
      { local: "reminderAtLocal", absolute: "reminderAt", required: false },
    ]);
    if (!ok) {
      setClientError(
        "Enter valid due date/time values. Local times are converted to absolute ISO before submit."
      );
      return;
    }
    formAction(formData);
  };

  const fieldErrors = state.fieldErrors ?? {};

  return (
    <form
      ref={resolvedRef}
      action={submitForm}
      className="space-y-3 rounded-md border border-neutral-800 bg-neutral-950/40 p-4"
      data-testid="crm-create-activity-form"
      id={formId}
    >
      <input type="hidden" name="leadId" value={leadId} />
      <input type="hidden" name="activityType" value={activityType} />

      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <label htmlFor={`${formId}-type`} className="text-sm text-neutral-300">
            Activity type
          </label>
          <select
            id={`${formId}-type`}
            value={activityType}
            onChange={(event) =>
              handleTypeChange(event.target.value as CrmActivityType)
            }
            className={inputClassName(Boolean(fieldErrors.activityType))}
            data-testid="crm-create-activity-type"
          >
            {activityTypeOptions().map((type) => (
              <option key={type} value={type}>
                {type.replace(/_/g, " ")}
              </option>
            ))}
          </select>
          {fieldErrors.activityType ? (
            <p
              id={fieldErrorId("activityType")}
              className="mt-1 text-xs text-red-300"
              role="alert"
            >
              {fieldErrors.activityType}
            </p>
          ) : null}
        </div>

        <div>
          <label
            htmlFor={`${formId}-priority`}
            className="text-sm text-neutral-300"
          >
            Priority
          </label>
          <select
            id={`${formId}-priority`}
            name="priority"
            defaultValue="normal"
            className={inputClassName(Boolean(fieldErrors.priority))}
            data-testid="crm-create-activity-priority"
          >
            {activityPriorityOptions().map((priority) => (
              <option key={priority} value={priority}>
                {priority}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div>
        <label htmlFor={`${formId}-title`} className="text-sm text-neutral-300">
          Title
        </label>
        <input
          id={`${formId}-title`}
          name="title"
          required
          minLength={1}
          maxLength={120}
          value={title}
          onChange={(event) => {
            setTitleTouched(true);
            setTitle(event.target.value);
          }}
          className={inputClassName(Boolean(fieldErrors.title))}
          data-testid="crm-create-activity-title"
        />
        {fieldErrors.title ? (
          <p className="mt-1 text-xs text-red-300" role="alert">
            {fieldErrors.title}
          </p>
        ) : null}
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <label htmlFor={`${formId}-due`} className="text-sm text-neutral-300">
            Due date and time
          </label>
          <input
            id={`${formId}-due`}
            name="dueAtLocal"
            type="datetime-local"
            required
            defaultValue={defaultFutureDatetimeLocalValue()}
            className={inputClassName(Boolean(fieldErrors.dueAt))}
            aria-invalid={Boolean(fieldErrors.dueAt)}
            aria-describedby={
              fieldErrors.dueAt ? fieldErrorId("dueAt") : undefined
            }
            data-testid="crm-create-activity-due"
          />
          {fieldErrors.dueAt ? (
            <p
              id={fieldErrorId("dueAt")}
              className="mt-1 text-xs text-red-300"
              role="alert"
            >
              {fieldErrors.dueAt}
            </p>
          ) : null}
        </div>

        <div>
          <label
            htmlFor={`${formId}-duration`}
            className="text-sm text-neutral-300"
          >
            Duration (minutes)
          </label>
          <input
            id={`${formId}-duration`}
            name="durationMinutes"
            type="number"
            min={1}
            max={1440}
            value={durationMinutes}
            onChange={(event) => setDurationMinutes(event.target.value)}
            className={inputClassName(Boolean(fieldErrors.durationMinutes))}
            data-testid="crm-create-activity-duration"
          />
        </div>
      </div>

      <div>
        <label
          htmlFor={`${formId}-reminder`}
          className="text-sm text-neutral-300"
        >
          Reminder (optional)
        </label>
        <input
          id={`${formId}-reminder`}
          name="reminderAtLocal"
          type="datetime-local"
          className={inputClassName(Boolean(fieldErrors.reminderAt))}
          data-testid="crm-create-activity-reminder"
        />
      </div>

      {canChooseOwner ? (
        <div>
          <label htmlFor={`${formId}-owner`} className="text-sm text-neutral-300">
            Owner
          </label>
          <select
            id={`${formId}-owner`}
            name="ownerId"
            defaultValue=""
            className={inputClassName(Boolean(fieldErrors.ownerId))}
            data-testid="crm-create-activity-owner"
          >
            <option value="">Assign to me</option>
            {assigneeDirectory.map((entry) => (
              <option key={entry.userId} value={entry.userId}>
                {entry.displayName}
              </option>
            ))}
          </select>
        </div>
      ) : null}

      {quotationId ? (
        <div>
          <label
            htmlFor={`${formId}-quotation`}
            className="text-sm text-neutral-300"
          >
            Link quotation (optional)
          </label>
          <select
            id={`${formId}-quotation`}
            name="quotationId"
            defaultValue=""
            className={inputClassName()}
            data-testid="crm-create-activity-quotation"
          >
            <option value="">None</option>
            <option value={quotationId}>{quotationLabel ?? quotationId}</option>
          </select>
        </div>
      ) : null}

      <label className="flex items-center gap-2 text-sm text-neutral-300">
        <input
          type="checkbox"
          name="isPrimary"
          value="true"
          defaultChecked={defaultPrimary}
          className="h-4 w-4 rounded border-neutral-600"
          data-testid="crm-create-activity-primary"
        />
        Make primary next action
      </label>

      {clientError ? (
        <p className="text-sm text-red-300" role="alert">
          {clientError}
        </p>
      ) : null}
      {state.message && !state.success ? (
        <p className="text-sm text-red-300" role="alert">
          {state.message}
        </p>
      ) : null}
      {state.success ? (
        <p className="text-sm text-emerald-300" role="status">
          {state.message}
        </p>
      ) : null}

      <button
        type="submit"
        disabled={pending}
        className="inline-flex min-h-11 w-full items-center justify-center rounded-md bg-amber-500 px-4 py-2 text-sm font-medium text-neutral-950 disabled:opacity-60 sm:w-auto"
        data-testid="crm-create-activity-submit"
      >
        {pending ? "Creating…" : "Create activity"}
      </button>
    </form>
  );
}
