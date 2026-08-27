"use client";

import {
  useActionState,
  useEffect,
  useId,
  useMemo,
  useState,
} from "react";
import { useRouter } from "next/navigation";
import {
  INITIAL_CRM_ACTIVITY_ACTION_STATE,
  type CrmActivityOutcomeOption,
  type CrmActivityResolution,
  type CrmActivityType,
} from "../../contracts/activity-contracts.ts";
import type {
  CrmLeadClosureReasonOption,
  CrmLeadDetailFollowUp,
} from "../../contracts/lead-detail-dtos.ts";
import type { CrmWhatsappSendIntentOption } from "../../server/crm-whatsapp-evidence-queries.ts";
import {
  appendAbsoluteTimestampsFromLocalFields,
  defaultFutureDatetimeLocalValue,
} from "../../lib/local-datetime-to-iso.ts";
import { completeLeadActivityAction } from "../../server/crm-activity-actions.ts";
import { CrmActivityDialogShell } from "./CrmActivityDialogShell.tsx";
import {
  CRM_ACTIVITY_DEFAULT_DURATIONS,
  CRM_ACTIVITY_RESOLUTION_LABELS,
  CRM_ACTIVITY_SUGGESTED_TITLES,
  activityPriorityOptions,
  activityTypeOptions,
  filterOutcomeOptionsForActivityType,
  inputClassName,
  suggestNextActivityType,
} from "./activity-ui-utils.ts";

interface CompleteActivityDialogProps {
  readonly open: boolean;
  readonly activity: CrmLeadDetailFollowUp | null;
  readonly leadId: string;
  readonly hasOtherOpenPrimary: boolean;
  readonly outcomeOptions: readonly CrmActivityOutcomeOption[];
  readonly closureReasons: readonly CrmLeadClosureReasonOption[];
  readonly whatsappSendIntents: readonly CrmWhatsappSendIntentOption[];
  readonly quotationId: string | null;
  readonly quotationLabel: string | null;
  readonly onClose: () => void;
}

export function CompleteActivityDialog({
  open,
  activity,
  leadId,
  hasOtherOpenPrimary,
  outcomeOptions,
  closureReasons,
  whatsappSendIntents,
  quotationId,
  quotationLabel,
  onClose,
}: CompleteActivityDialogProps) {
  const router = useRouter();
  const titleId = useId();
  const [state, formAction, pending] = useActionState(
    completeLeadActivityAction,
    INITIAL_CRM_ACTIVITY_ACTION_STATE
  );
  const [clientError, setClientError] = useState<string | null>(null);
  const [outcomeCode, setOutcomeCode] = useState("");
  const [resolution, setResolution] = useState<CrmActivityResolution>("NEXT_PRIMARY");
  const [nextType, setNextType] = useState<CrmActivityType>("call");
  const [nextTitle, setNextTitle] = useState(CRM_ACTIVITY_SUGGESTED_TITLES.call);
  const [nextDuration, setNextDuration] = useState("15");

  const isPrimary = activity?.isPrimaryNextAction ?? false;
  const filteredOutcomes = useMemo(
    () =>
      activity
        ? filterOutcomeOptionsForActivityType(outcomeOptions, activity.activityType)
        : [],
    [activity, outcomeOptions]
  );

  const showWhatsappEvidence =
    activity?.activityType === "whatsapp" && outcomeCode === "whatsapp_sent";

  const resolutionOptions = useMemo((): readonly CrmActivityResolution[] => {
    if (!activity) {
      return [];
    }
    if (isPrimary) {
      return ["NEXT_PRIMARY", "ON_HOLD", "CLOSED_LOST"];
    }
    if (hasOtherOpenPrimary) {
      return ["NONE"];
    }
    return ["NEXT_PRIMARY", "ON_HOLD", "CLOSED_LOST"];
  }, [activity, hasOtherOpenPrimary, isPrimary]);

  useEffect(() => {
    if (!open || !activity) {
      return;
    }
    const suggested = suggestNextActivityType(activity.activityType);
    setNextType(suggested);
    setNextTitle(CRM_ACTIVITY_SUGGESTED_TITLES[suggested]);
    setNextDuration(String(CRM_ACTIVITY_DEFAULT_DURATIONS[suggested]));
    setOutcomeCode(filteredOutcomes[0]?.code ?? "");
    setResolution(isPrimary || !hasOtherOpenPrimary ? "NEXT_PRIMARY" : "NONE");
    setClientError(null);
  }, [open, activity, filteredOutcomes, hasOtherOpenPrimary, isPrimary]);

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
  const showNextPrimaryFields = resolution === "NEXT_PRIMARY";
  const showOnHoldFields = resolution === "ON_HOLD";
  const showClosedLostFields = resolution === "CLOSED_LOST";

  const submitForm = (formData: FormData) => {
    setClientError(null);
    const mappings = [
      { local: "onHoldReviewAtLocal", absolute: "onHoldReviewAt", required: false },
      { local: "nextDueAtLocal", absolute: "nextDueAt", required: false },
      { local: "nextReminderAtLocal", absolute: "nextReminderAt", required: false },
    ];

    if (showOnHoldFields) {
      mappings[0] = { ...mappings[0]!, required: true };
    }
    if (showNextPrimaryFields) {
      mappings[1] = { ...mappings[1]!, required: true };
    }

    const ok = appendAbsoluteTimestampsFromLocalFields(formData, mappings);
    if (!ok) {
      setClientError(
        "Enter valid date/time values. Local times are converted to absolute ISO before submit."
      );
      return;
    }
    formAction(formData);
  };

  return (
    <CrmActivityDialogShell
      open={open}
      title="Complete activity"
      titleId={titleId}
      description={`${activity.title} · ${activity.activityType.replace(/_/g, " ")}`}
      onClose={onClose}
      testId="crm-complete-activity-dialog"
    >
      <form action={submitForm} className="space-y-4">
        <input type="hidden" name="activityId" value={activity.id} />
        <input type="hidden" name="leadId" value={leadId} />
        <input type="hidden" name="resolution" value={resolution} />
        <input type="hidden" name="nextActivityType" value={nextType} />

        <div>
          <label htmlFor={`${titleId}-outcome`} className="text-sm text-neutral-300">
            Outcome
          </label>
          <select
            id={`${titleId}-outcome`}
            name="outcomeCode"
            required
            value={outcomeCode}
            onChange={(event) => setOutcomeCode(event.target.value)}
            className={inputClassName(Boolean(fieldErrors.outcomeCode))}
            data-testid="crm-complete-outcome"
          >
            <option value="">Select outcome</option>
            {filteredOutcomes.map((option) => (
              <option key={option.code} value={option.code}>
                {option.displayName}
              </option>
            ))}
          </select>
          {fieldErrors.outcomeCode ? (
            <p className="mt-1 text-xs text-red-300" role="alert">
              {fieldErrors.outcomeCode}
            </p>
          ) : null}
        </div>

        <div>
          <label htmlFor={`${titleId}-note`} className="text-sm text-neutral-300">
            Completion note (optional)
          </label>
          <textarea
            id={`${titleId}-note`}
            name="completionNote"
            rows={3}
            maxLength={1000}
            className={inputClassName(Boolean(fieldErrors.completionNote))}
            data-testid="crm-complete-note"
          />
        </div>

        {showWhatsappEvidence ? (
          <div>
            <label
              htmlFor={`${titleId}-whatsapp-intent`}
              className="text-sm text-neutral-300"
            >
              Governed WhatsApp send
            </label>
            {whatsappSendIntents.length === 0 ? (
              <p className="mt-1 text-sm text-amber-200" role="alert">
                No governed outbound sends found for this lead. Send from WhatsApp
                inbox first, then complete with whatsapp_sent.
              </p>
            ) : (
              <select
                id={`${titleId}-whatsapp-intent`}
                name="whatsappSendIntentId"
                required
                className={inputClassName(Boolean(fieldErrors.whatsappSendIntentId))}
                data-testid="crm-complete-whatsapp-intent"
              >
                <option value="">Select send intent</option>
                {whatsappSendIntents.map((intent) => (
                  <option key={intent.intentId} value={intent.intentId}>
                    {intent.label}
                  </option>
                ))}
              </select>
            )}
            {fieldErrors.whatsappSendIntentId ? (
              <p className="mt-1 text-xs text-red-300" role="alert">
                {fieldErrors.whatsappSendIntentId}
              </p>
            ) : null}
          </div>
        ) : null}

        {resolutionOptions.length > 1 ? (
          <fieldset>
            <legend className="text-sm font-medium text-neutral-300">
              What happens next?
            </legend>
            <div className="mt-2 space-y-2">
              {resolutionOptions.map((option) => (
                <label
                  key={option}
                  className="flex items-center gap-2 text-sm text-neutral-200"
                >
                  <input
                    type="radio"
                    name="resolutionChoice"
                    checked={resolution === option}
                    onChange={() => setResolution(option)}
                    data-testid={`crm-complete-resolution-${option.toLowerCase()}`}
                  />
                  {CRM_ACTIVITY_RESOLUTION_LABELS[option]}
                </label>
              ))}
            </div>
            <p className="sr-only" data-testid="crm-closed-won-absent">
              Closed Won is not offered for activity completion
            </p>
          </fieldset>
        ) : (
          <p className="text-sm text-neutral-400">
            Completing this secondary activity — primary next action remains unchanged.
          </p>
        )}

        {showNextPrimaryFields ? (
          <div className="space-y-3 rounded-md border border-neutral-800 bg-neutral-950/50 p-3">
            <p className="text-sm font-medium text-neutral-200">Next primary action</p>
            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <label className="text-sm text-neutral-400">Type</label>
                <select
                  value={nextType}
                  onChange={(event) => {
                    const value = event.target.value as CrmActivityType;
                    setNextType(value);
                    setNextTitle(CRM_ACTIVITY_SUGGESTED_TITLES[value]);
                    setNextDuration(String(CRM_ACTIVITY_DEFAULT_DURATIONS[value]));
                  }}
                  className={inputClassName()}
                  data-testid="crm-complete-next-type"
                >
                  {activityTypeOptions().map((type) => (
                    <option key={type} value={type}>
                      {type.replace(/_/g, " ")}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-sm text-neutral-400">Priority</label>
                <select
                  name="nextPriority"
                  defaultValue="normal"
                  className={inputClassName()}
                  data-testid="crm-complete-next-priority"
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
              <label className="text-sm text-neutral-400">Title</label>
              <input
                name="nextTitle"
                required
                value={nextTitle}
                onChange={(event) => setNextTitle(event.target.value)}
                className={inputClassName(Boolean(fieldErrors.nextTitle))}
                data-testid="crm-complete-next-title"
              />
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <label className="text-sm text-neutral-400">Due</label>
                <input
                  name="nextDueAtLocal"
                  type="datetime-local"
                  required
                  defaultValue={defaultFutureDatetimeLocalValue()}
                  className={inputClassName(Boolean(fieldErrors.nextDueAt))}
                  data-testid="crm-complete-next-due"
                />
              </div>
              <div>
                <label className="text-sm text-neutral-400">Duration (min)</label>
                <input
                  name="nextDurationMinutes"
                  type="number"
                  min={1}
                  max={1440}
                  value={nextDuration}
                  onChange={(event) => setNextDuration(event.target.value)}
                  className={inputClassName()}
                  data-testid="crm-complete-next-duration"
                />
              </div>
            </div>
            <div>
              <label className="text-sm text-neutral-400">Reminder (optional)</label>
              <input
                name="nextReminderAtLocal"
                type="datetime-local"
                className={inputClassName()}
                data-testid="crm-complete-next-reminder"
              />
            </div>
            {quotationId ? (
              <div>
                <label className="text-sm text-neutral-400">Quotation (optional)</label>
                <select
                  name="nextQuotationId"
                  defaultValue=""
                  className={inputClassName()}
                  data-testid="crm-complete-next-quotation"
                >
                  <option value="">None</option>
                  <option value={quotationId}>{quotationLabel ?? quotationId}</option>
                </select>
              </div>
            ) : null}
          </div>
        ) : null}

        {showOnHoldFields ? (
          <div className="space-y-3 rounded-md border border-neutral-800 bg-neutral-950/50 p-3">
            <p className="text-sm text-neutral-400">
              Customer follow-up pauses while held. The review time becomes the
              primary next action.
            </p>
            <div>
              <label className="text-sm text-neutral-300">Reason</label>
              <textarea
                name="onHoldReason"
                required
                rows={3}
                className={inputClassName(Boolean(fieldErrors.onHoldReason))}
                data-testid="crm-complete-on-hold-reason"
              />
            </div>
            <div>
              <label className="text-sm text-neutral-300">Review on</label>
              <input
                name="onHoldReviewAtLocal"
                type="datetime-local"
                required
                defaultValue={defaultFutureDatetimeLocalValue(72)}
                className={inputClassName(Boolean(fieldErrors.onHoldReviewAt))}
                data-testid="crm-complete-on-hold-review"
              />
            </div>
          </div>
        ) : null}

        {showClosedLostFields ? (
          <div className="space-y-3 rounded-md border border-red-900/40 bg-red-950/10 p-3">
            <div>
              <label className="text-sm text-neutral-300">Closure reason</label>
              <select
                name="closureReasonCode"
                required
                className={inputClassName(Boolean(fieldErrors.closureReasonCode))}
                data-testid="crm-complete-closure-reason"
              >
                <option value="">Select reason</option>
                {closureReasons.map((reason) => (
                  <option key={reason.code} value={reason.code}>
                    {reason.displayName}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-sm text-neutral-300">Closed lost note</label>
              <textarea
                name="closedLostReason"
                required
                rows={3}
                className={inputClassName(Boolean(fieldErrors.closedLostReason))}
                data-testid="crm-complete-closed-lost-note"
              />
            </div>
          </div>
        ) : null}

        {clientError ? (
          <p className="text-sm text-red-300" role="alert">
            {clientError}
          </p>
        ) : null}
        {state.message && !state.success ? (
          <p className="text-sm text-red-300" role="alert">
            {state.message}
            {state.code === "NEXT_ACTION_REQUIRED"
              ? " Choose a next primary action or resolution."
              : ""}
          </p>
        ) : null}

        <div className="flex flex-wrap justify-end gap-2 pt-2">
          <button
            type="button"
            onClick={onClose}
            className="inline-flex min-h-11 items-center rounded-md border border-neutral-700 px-4 py-2 text-sm text-neutral-200"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={pending || (showWhatsappEvidence && whatsappSendIntents.length === 0)}
            className="inline-flex min-h-11 items-center rounded-md bg-[var(--od-gold)] px-4 py-2 text-sm font-semibold text-neutral-950 disabled:opacity-60"
            data-testid="crm-complete-submit"
          >
            {pending ? "Completing…" : "Complete activity"}
          </button>
        </div>
      </form>
    </CrmActivityDialogShell>
  );
}
