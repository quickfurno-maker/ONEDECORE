import {
  formatCadenceDelayLabel,
  type CrmCadenceStep,
} from "../../contracts/cadence-contracts.ts";
import {
  formatActivityPriorityLabel,
  formatActivityTypeLabel,
} from "../activities/activity-ui-utils.ts";

interface CadenceStepListProps {
  readonly steps: readonly CrmCadenceStep[];
}

/** Read-only step view for a published or archived (frozen) cadence. */
export function CadenceStepList({ steps }: CadenceStepListProps) {
  if (steps.length === 0) {
    return (
      <p className="text-sm text-[var(--crm-muted)]">
        This cadence has no steps.
      </p>
    );
  }

  return (
    <ol className="space-y-3" data-testid="crm-cadence-step-list">
      {steps.map((step) => (
        <li
          key={step.id}
          className="rounded-lg border border-[var(--crm-border)] p-4"
          data-testid="crm-cadence-step-readonly"
        >
          <div className="flex flex-wrap items-start justify-between gap-2">
            <div className="min-w-0">
              <p className="text-[12px] font-medium text-[var(--crm-primary)]">
                Step {step.stepOrder} · {formatCadenceDelayLabel(step.delayHours)}
              </p>
              <p className="mt-1 text-sm font-semibold text-[var(--crm-text)]">
                {step.title}
              </p>
              <p className="mt-1 text-sm text-[var(--crm-muted)]">
                {formatActivityTypeLabel(step.activityType)} ·{" "}
                {formatActivityPriorityLabel(step.priority)} priority
                {step.durationMinutes ? ` · ${step.durationMinutes} min` : ""}
                {step.reminderOffsetMinutes != null
                  ? ` · reminder ${step.reminderOffsetMinutes} min before`
                  : ""}
              </p>
            </div>
          </div>
        </li>
      ))}
    </ol>
  );
}
