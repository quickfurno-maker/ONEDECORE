"use client";

import { useActionState } from "react";
import {
  SLA_NON_RETROACTIVE_NOTE,
  SLA_TARGET_MINUTES_MAX,
  SLA_TARGET_MINUTES_MIN,
  SLA_WEEKDAY_LABELS,
  buildSlaPolicyFormModel,
  formatSlaTimestamp,
  type CrmSlaPolicyDto,
  type SlaPolicyActionState,
} from "../../contracts/sla-policy-contracts.ts";
import { updateCrmSlaPolicyAction } from "../../server/crm-sla-policy-actions.ts";

const INITIAL_STATE: SlaPolicyActionState = { success: false, message: "" };

interface SlaSettingsPanelProps {
  readonly policy: CrmSlaPolicyDto;
}

export function SlaSettingsPanel({ policy }: SlaSettingsPanelProps) {
  const [state, formAction, pending] = useActionState(
    updateCrmSlaPolicyAction,
    INITIAL_STATE
  );
  const model = buildSlaPolicyFormModel(policy);

  return (
    <div className="space-y-4">
      <form
        key={policy.updatedAt}
        action={formAction}
        className="crm-surface space-y-5 p-4 sm:p-5"
      >
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[var(--crm-border)] pb-3">
          <div className="min-w-0">
            <h2 className="text-[15px] font-semibold text-[var(--crm-text)]">
              Policy: First Contact
            </h2>
            <p className="mt-0.5 text-[12px] text-[var(--crm-muted)]">
              Policy code <span className="font-mono">{policy.policyCode}</span>
            </p>
          </div>
          <StatusBadge isActive={policy.isActive} />
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <label className="block space-y-1.5" htmlFor="sla-target-minutes">
            <span className="block text-[13px] font-medium text-[var(--crm-text)]">
              Target response minutes
            </span>
            <input
              id="sla-target-minutes"
              name="targetBusinessMinutes"
              type="number"
              inputMode="numeric"
              min={SLA_TARGET_MINUTES_MIN}
              max={SLA_TARGET_MINUTES_MAX}
              step={1}
              required
              defaultValue={model.targetBusinessMinutes}
              className="crm-input w-full"
            />
            <span className="block text-[11px] leading-4 text-[var(--crm-muted)]">
              Business minutes ({SLA_TARGET_MINUTES_MIN}–{SLA_TARGET_MINUTES_MAX}) counted inside open hours only.
            </span>
          </label>

          <label className="block space-y-1.5" htmlFor="sla-timezone">
            <span className="block text-[13px] font-medium text-[var(--crm-text)]">
              Timezone
            </span>
            <input
              id="sla-timezone"
              name="timezone"
              type="text"
              required
              defaultValue={model.timezone}
              className="crm-input w-full"
            />
            <span className="block text-[11px] leading-4 text-[var(--crm-muted)]">
              IANA timezone name, for example Asia/Kolkata.
            </span>
          </label>
        </div>

        <label className="flex items-start gap-2.5 text-[13px] text-[var(--crm-text)]">
          <input
            name="businessHoursEnabled"
            type="checkbox"
            defaultChecked={model.businessHoursEnabled}
            className="mt-0.5 h-4 w-4 accent-[var(--crm-primary)]"
          />
          <span>
            Business hours enabled
            <span className="mt-0.5 block text-[11px] leading-4 text-[var(--crm-muted)]">
              When enabled, the SLA clock only advances inside the open windows below.
            </span>
          </span>
        </label>

        {/* min-w-0: a fieldset defaults to min-width:min-content and would
            otherwise refuse to shrink below the weekday table, widening the page
            instead of letting the table scroll inside its own container. */}
        <fieldset className="min-w-0 space-y-2">
          <legend className="text-[13px] font-medium text-[var(--crm-text)]">
            Business hours
          </legend>
          {model.isBusinessHoursDraft ? (
            <p
              role="note"
              className="rounded-[8px] border border-[var(--crm-border)] bg-[var(--crm-warning-soft)] px-3 py-2 text-[12px] leading-5 text-[var(--crm-text)]"
            >
              <strong className="font-semibold">Draft — not yet saved.</strong> No
              business hours exist in the database yet. Monday–Saturday 09:00–19:00
              with Sunday closed is shown as a proposed starting point and is written
              only when you save.
            </p>
          ) : null}

          <div className="crm-scrollbar-x -mx-1 overflow-x-auto px-1">
            <table className="w-full min-w-[420px] text-left text-[13px]">
              <caption className="sr-only">
                Weekly business hours for the first-contact SLA policy
              </caption>
              <thead className="text-[11px] text-[var(--crm-muted)]">
                <tr>
                  <th scope="col" className="pb-2 font-medium">Day</th>
                  <th scope="col" className="pb-2 font-medium">Open</th>
                  <th scope="col" className="pb-2 font-medium">Start</th>
                  <th scope="col" className="pb-2 font-medium">End</th>
                </tr>
              </thead>
              <tbody>
                {model.weekdays.map((row) => (
                  <tr key={row.day} className="crm-row border-t border-[var(--crm-border)]">
                    <th
                      scope="row"
                      className="py-2 pr-3 font-medium text-[var(--crm-text)]"
                    >
                      {SLA_WEEKDAY_LABELS[row.day]}
                    </th>
                    <td className="py-2 pr-3">
                      <input
                        id={`sla-${row.day}-open`}
                        name={`weekday.${row.day}.open`}
                        type="checkbox"
                        defaultChecked={row.open}
                        aria-label={`${SLA_WEEKDAY_LABELS[row.day]} open`}
                        className="h-4 w-4 accent-[var(--crm-primary)]"
                      />
                    </td>
                    <td className="py-2 pr-3">
                      <input
                        id={`sla-${row.day}-start`}
                        name={`weekday.${row.day}.start`}
                        type="time"
                        defaultValue={row.start}
                        aria-label={`${SLA_WEEKDAY_LABELS[row.day]} start time`}
                        className="crm-input w-[120px]"
                      />
                    </td>
                    <td className="py-2">
                      <input
                        id={`sla-${row.day}-end`}
                        name={`weekday.${row.day}.end`}
                        type="time"
                        defaultValue={row.end}
                        aria-label={`${SLA_WEEKDAY_LABELS[row.day]} end time`}
                        className="crm-input w-[120px]"
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="text-[11px] leading-4 text-[var(--crm-muted)]">
            Days left closed are omitted from the saved policy entirely.
          </p>
        </fieldset>

        <label className="flex items-start gap-2.5 text-[13px] text-[var(--crm-text)]">
          <input
            name="isActive"
            type="checkbox"
            defaultChecked={model.isActive}
            className="mt-0.5 h-4 w-4 accent-[var(--crm-primary)]"
          />
          <span>
            Active
            <span className="mt-0.5 block text-[11px] leading-4 text-[var(--crm-muted)]">
              Activation requires business hours enabled with at least one open day.
            </span>
          </span>
        </label>

        <div className="flex flex-wrap items-center gap-3 border-t border-[var(--crm-border)] pt-4">
          <button type="submit" disabled={pending} className="crm-btn crm-btn-primary">
            {pending ? "Saving..." : "Save SLA settings"}
          </button>
          {state.message ? (
            <p
              role="status"
              aria-live="polite"
              className={`text-[13px] ${
                state.success
                  ? "text-[var(--crm-success)]"
                  : "text-[var(--crm-danger)]"
              }`}
            >
              {state.message}
            </p>
          ) : null}
        </div>
      </form>

      <section
        aria-label="SLA activation status"
        className="crm-surface space-y-3 p-4 sm:p-5"
      >
        <div className="flex flex-wrap items-center gap-3">
          <h2 className="text-[15px] font-semibold text-[var(--crm-text)]">Status</h2>
          <StatusBadge isActive={policy.isActive} />
        </div>
        <dl className="grid gap-3 sm:grid-cols-2">
          <StatusValue label="Effective from" value={formatSlaTimestamp(policy.effectiveFrom)} />
          <StatusValue label="Activated at" value={formatSlaTimestamp(policy.activatedAt)} />
        </dl>
        <p className="text-[12px] leading-5 text-[var(--crm-muted)]">
          {SLA_NON_RETROACTIVE_NOTE}
        </p>
      </section>
    </div>
  );
}

function StatusBadge({ isActive }: { readonly isActive: boolean }) {
  return (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-1 text-[11px] font-semibold ${
        isActive
          ? "bg-[var(--crm-success-soft)] text-[var(--crm-success)]"
          : "bg-[var(--crm-surface-subtle)] text-[var(--crm-muted)]"
      }`}
    >
      {isActive ? "Active" : "Inactive"}
    </span>
  );
}

function StatusValue({
  label,
  value,
}: {
  readonly label: string;
  readonly value: string;
}) {
  return (
    <div className="rounded-[8px] border border-[var(--crm-border)] bg-[var(--crm-surface-subtle)] px-3 py-2">
      <dt className="text-[11px] text-[var(--crm-muted)]">{label}</dt>
      <dd className="mt-0.5 text-[13px] font-medium tabular-nums text-[var(--crm-text)]">
        {value}
      </dd>
    </div>
  );
}
