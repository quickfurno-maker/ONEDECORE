"use client";

import { useActionState, useEffect, useId, useState } from "react";
import { useRouter } from "next/navigation";
import {
  CRM_ACTIVITY_PRIORITIES,
  CRM_ACTIVITY_TYPES,
  type CrmActivityPriority,
  type CrmActivityType,
} from "../../contracts/activity-contracts.ts";
import {
  CRM_CADENCE_MAX_DELAY_HOURS,
  CRM_CADENCE_MAX_STEPS,
  INITIAL_CADENCE_ACTION_STATE,
  formatCadenceDelayLabel,
  type CadenceActionState,
  type CrmCadenceStep,
} from "../../contracts/cadence-contracts.ts";
import {
  createCadenceTemplateAction,
  saveCadenceDraftAction,
} from "../../server/crm-cadence-actions.ts";
import {
  formatActivityPriorityLabel,
  formatActivityTypeLabel,
} from "../activities/activity-ui-utils.ts";

interface EditableStep {
  readonly key: string;
  readonly activityType: CrmActivityType;
  readonly title: string;
  readonly priority: CrmActivityPriority;
  readonly delayHours: string;
  readonly durationMinutes: string;
  readonly reminderOffsetMinutes: string;
}

interface CadenceDraftEditorProps {
  /** Omitted when creating a new draft. */
  readonly templateId?: string;
  readonly initialName?: string;
  readonly initialDescription?: string | null;
  readonly initialSteps?: readonly CrmCadenceStep[];
}

const inputClass = "crm-input mt-1 w-full text-base sm:text-sm";

function newStep(index: number): EditableStep {
  return {
    key: `step-${index}-${Math.random().toString(36).slice(2, 8)}`,
    activityType: "call",
    title: "",
    priority: "normal",
    delayHours: "24",
    durationMinutes: "",
    reminderOffsetMinutes: "",
  };
}

function toEditable(step: CrmCadenceStep): EditableStep {
  return {
    key: step.id,
    activityType: step.activityType,
    title: step.title,
    priority: step.priority,
    delayHours: String(step.delayHours),
    durationMinutes: step.durationMinutes == null ? "" : String(step.durationMinutes),
    reminderOffsetMinutes:
      step.reminderOffsetMinutes == null ? "" : String(step.reminderOffsetMinutes),
  };
}

export function CadenceDraftEditor({
  templateId,
  initialName = "",
  initialDescription = null,
  initialSteps = [],
}: CadenceDraftEditorProps) {
  const router = useRouter();
  const fieldId = useId();
  const isCreate = !templateId;
  const [state, formAction, pending] = useActionState<
    CadenceActionState,
    FormData
  >(
    isCreate ? createCadenceTemplateAction : saveCadenceDraftAction,
    INITIAL_CADENCE_ACTION_STATE
  );
  const [steps, setSteps] = useState<readonly EditableStep[]>(
    initialSteps.length > 0 ? initialSteps.map(toEditable) : [newStep(0)]
  );

  useEffect(() => {
    if (state.success && isCreate && state.templateId) {
      router.push(`/admin/crm/cadences/${state.templateId}`);
      return;
    }
    if (state.success) {
      router.refresh();
    }
  }, [state.success, state.templateId, isCreate, router]);

  const fieldErrors = state.fieldErrors ?? {};

  const updateStep = (index: number, patch: Partial<EditableStep>) => {
    setSteps((current) =>
      current.map((step, position) =>
        position === index ? { ...step, ...patch } : step
      )
    );
  };

  const moveStep = (index: number, direction: -1 | 1) => {
    const target = index + direction;
    setSteps((current) => {
      if (target < 0 || target >= current.length) {
        return current;
      }
      const next = [...current];
      const [moved] = next.splice(index, 1);
      next.splice(target, 0, moved!);
      return next;
    });
  };

  return (
    <form
      action={formAction}
      className="space-y-5"
      data-testid="crm-cadence-draft-editor"
    >
      {templateId ? (
        <input type="hidden" name="templateId" value={templateId} />
      ) : null}

      <section className="crm-surface space-y-4 p-5">
        <div>
          <label
            htmlFor={`${fieldId}-name`}
            className="text-sm text-[var(--crm-text-secondary)]"
          >
            Cadence name
          </label>
          <input
            id={`${fieldId}-name`}
            name="name"
            required
            maxLength={120}
            defaultValue={initialName}
            className={inputClass}
            data-testid="crm-cadence-name"
          />
        </div>
        <div>
          <label
            htmlFor={`${fieldId}-description`}
            className="text-sm text-[var(--crm-text-secondary)]"
          >
            Description (optional)
          </label>
          <textarea
            id={`${fieldId}-description`}
            name="description"
            rows={2}
            maxLength={500}
            defaultValue={initialDescription ?? ""}
            className={inputClass}
            data-testid="crm-cadence-description"
          />
        </div>
      </section>

      <section className="crm-surface p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-sm font-semibold text-[var(--crm-text)]">
              Steps
            </h2>
            <p className="mt-1 text-xs text-[var(--crm-muted)]">
              Each step becomes the lead&rsquo;s primary next action when the
              previous one is completed. Delays are measured from that
              completion. A WhatsApp step is an internal reminder — CRM never
              sends automatically.
            </p>
          </div>
          <button
            type="button"
            onClick={() => setSteps((current) => [...current, newStep(current.length)])}
            disabled={steps.length >= CRM_CADENCE_MAX_STEPS}
            className="crm-btn crm-btn-secondary"
            data-testid="crm-cadence-add-step"
          >
            Add step
          </button>
        </div>

        <ol className="mt-4 space-y-4">
          {steps.map((step, index) => (
            <li
              key={step.key}
              className="rounded-lg border border-[var(--crm-border)] p-4"
              data-testid="crm-cadence-step-row"
            >
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="text-[12px] font-medium text-[var(--crm-primary)]">
                  Step {index + 1} ·{" "}
                  {formatCadenceDelayLabel(Number.parseInt(step.delayHours, 10) || 0)}
                </p>
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => moveStep(index, -1)}
                    disabled={index === 0}
                    className="crm-btn crm-btn-ghost min-h-11"
                    aria-label={`Move step ${index + 1} up`}
                    data-testid="crm-cadence-step-up"
                  >
                    Move up
                  </button>
                  <button
                    type="button"
                    onClick={() => moveStep(index, 1)}
                    disabled={index === steps.length - 1}
                    className="crm-btn crm-btn-ghost min-h-11"
                    aria-label={`Move step ${index + 1} down`}
                    data-testid="crm-cadence-step-down"
                  >
                    Move down
                  </button>
                  <button
                    type="button"
                    onClick={() =>
                      setSteps((current) =>
                        current.filter((_, position) => position !== index)
                      )
                    }
                    disabled={steps.length === 1}
                    className="crm-btn crm-btn-ghost min-h-11 text-red-300"
                    aria-label={`Remove step ${index + 1}`}
                    data-testid="crm-cadence-step-remove"
                  >
                    Remove
                  </button>
                </div>
              </div>

              <div className="mt-3 grid gap-3 sm:grid-cols-2">
                <div className="sm:col-span-2">
                  <label
                    htmlFor={`${fieldId}-title-${index}`}
                    className="text-sm text-[var(--crm-text-secondary)]"
                  >
                    Task title
                  </label>
                  <input
                    id={`${fieldId}-title-${index}`}
                    name="stepTitle"
                    required
                    maxLength={120}
                    value={step.title}
                    onChange={(event) =>
                      updateStep(index, { title: event.target.value })
                    }
                    className={inputClass}
                    data-testid="crm-cadence-step-title"
                  />
                  {fieldErrors[`steps.${index}.title`] ? (
                    <p className="mt-1 text-xs text-red-300" role="alert">
                      {fieldErrors[`steps.${index}.title`]}
                    </p>
                  ) : null}
                </div>

                <div>
                  <label
                    htmlFor={`${fieldId}-type-${index}`}
                    className="text-sm text-[var(--crm-text-secondary)]"
                  >
                    Activity type
                  </label>
                  <select
                    id={`${fieldId}-type-${index}`}
                    name="stepActivityType"
                    value={step.activityType}
                    onChange={(event) =>
                      updateStep(index, {
                        activityType: event.target.value as CrmActivityType,
                      })
                    }
                    className={inputClass}
                    data-testid="crm-cadence-step-type"
                  >
                    {CRM_ACTIVITY_TYPES.map((type) => (
                      <option key={type} value={type}>
                        {formatActivityTypeLabel(type)}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label
                    htmlFor={`${fieldId}-priority-${index}`}
                    className="text-sm text-[var(--crm-text-secondary)]"
                  >
                    Priority
                  </label>
                  <select
                    id={`${fieldId}-priority-${index}`}
                    name="stepPriority"
                    value={step.priority}
                    onChange={(event) =>
                      updateStep(index, {
                        priority: event.target.value as CrmActivityPriority,
                      })
                    }
                    className={inputClass}
                    data-testid="crm-cadence-step-priority"
                  >
                    {CRM_ACTIVITY_PRIORITIES.map((priority) => (
                      <option key={priority} value={priority}>
                        {formatActivityPriorityLabel(priority)}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label
                    htmlFor={`${fieldId}-delay-${index}`}
                    className="text-sm text-[var(--crm-text-secondary)]"
                  >
                    Delay (hours)
                  </label>
                  <input
                    id={`${fieldId}-delay-${index}`}
                    name="stepDelayHours"
                    type="number"
                    inputMode="numeric"
                    min={0}
                    max={CRM_CADENCE_MAX_DELAY_HOURS}
                    required
                    value={step.delayHours}
                    onChange={(event) =>
                      updateStep(index, { delayHours: event.target.value })
                    }
                    className={inputClass}
                    data-testid="crm-cadence-step-delay"
                  />
                  {fieldErrors[`steps.${index}.delayHours`] ? (
                    <p className="mt-1 text-xs text-red-300" role="alert">
                      {fieldErrors[`steps.${index}.delayHours`]}
                    </p>
                  ) : null}
                </div>

                <div>
                  <label
                    htmlFor={`${fieldId}-duration-${index}`}
                    className="text-sm text-[var(--crm-text-secondary)]"
                  >
                    Duration (minutes, optional)
                  </label>
                  <input
                    id={`${fieldId}-duration-${index}`}
                    name="stepDurationMinutes"
                    type="number"
                    inputMode="numeric"
                    min={1}
                    max={1440}
                    value={step.durationMinutes}
                    onChange={(event) =>
                      updateStep(index, { durationMinutes: event.target.value })
                    }
                    className={inputClass}
                    data-testid="crm-cadence-step-duration"
                  />
                </div>

                <div>
                  <label
                    htmlFor={`${fieldId}-reminder-${index}`}
                    className="text-sm text-[var(--crm-text-secondary)]"
                  >
                    Reminder before due (minutes, optional)
                  </label>
                  <input
                    id={`${fieldId}-reminder-${index}`}
                    name="stepReminderOffsetMinutes"
                    type="number"
                    inputMode="numeric"
                    min={0}
                    max={10080}
                    value={step.reminderOffsetMinutes}
                    onChange={(event) =>
                      updateStep(index, {
                        reminderOffsetMinutes: event.target.value,
                      })
                    }
                    className={inputClass}
                    data-testid="crm-cadence-step-reminder"
                  />
                </div>
              </div>
            </li>
          ))}
        </ol>

        {fieldErrors.steps ? (
          <p className="mt-3 text-xs text-red-300" role="alert">
            {fieldErrors.steps}
          </p>
        ) : null}
      </section>

      {state.message ? (
        <p
          className={`text-sm ${state.success ? "text-emerald-300" : "text-red-300"}`}
          role="status"
          data-testid="crm-cadence-editor-message"
        >
          {state.message}
        </p>
      ) : null}

      <div className="flex flex-wrap gap-2">
        <button
          type="submit"
          disabled={pending}
          className="crm-btn crm-btn-primary flex-1 sm:flex-none"
          data-testid="crm-cadence-save"
        >
          {pending ? "Saving…" : isCreate ? "Create draft" : "Save draft"}
        </button>
      </div>
    </form>
  );
}
