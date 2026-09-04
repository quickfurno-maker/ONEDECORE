"use client";

import { useActionState } from "react";
import {
  CRM_MANUAL_SALES_TEMPERATURES,
  CRM_MANUAL_SALES_TEMPERATURE_LABELS,
  CRM_SALES_BUCKET_SOURCE_HINTS,
  CRM_SALES_BUCKET_SOURCE_LABELS,
  type CrmManualSalesTemperature,
  type CrmSalesBucketSource,
} from "../../contracts/lead-sales-temperature.ts";
import type { CrmLeadSalesBucket } from "../../contracts/lead-sales-bucket.ts";
import { setLeadSalesTemperatureAction } from "../../server/crm-sales-temperature-actions.ts";
import type { LifecycleActionState } from "../../contracts/lifecycle-contracts.ts";

/**
 * The salesperson's own HOT / WARM / COLD control.
 *
 * ONLY three options. LOST, WON and ON HOLD are lifecycle outcomes and are
 * deliberately absent — offering them here would create a second way to close a
 * deal, bypassing the transition graph that governs it.
 *
 * One click, no modal: a rep reclassifies leads constantly, and a confirmation
 * step would make the control too slow to actually use.
 *
 * The AUTO / MANUAL badge is the point of the whole component. Without it a
 * highlighted COLD is ambiguous — nobody can tell a considered judgement from a
 * machine guess, and the "Use system" reset would look like a no-op.
 */

const INITIAL: LifecycleActionState = { success: false, message: "" };

const TONES: Readonly<Record<CrmManualSalesTemperature, string>> = {
  HOT: "data-[on=true]:border-[var(--crm-danger)] data-[on=true]:bg-[var(--crm-danger-soft)] data-[on=true]:text-[var(--crm-danger)]",
  WARM: "data-[on=true]:border-[var(--crm-warning)] data-[on=true]:bg-[var(--crm-warning-soft)] data-[on=true]:text-[var(--crm-warning)]",
  COLD: "data-[on=true]:border-[var(--crm-info)] data-[on=true]:bg-[var(--crm-info-soft)] data-[on=true]:text-[var(--crm-info)]",
};

interface LeadSalesTemperatureControlProps {
  readonly leadId: string;
  readonly effectiveBucket: CrmLeadSalesBucket;
  readonly source: CrmSalesBucketSource;
  readonly manualTemperature: CrmManualSalesTemperature | null;
  /** False while a lifecycle override owns the classification, or without rights. */
  readonly canEdit: boolean;
  readonly lifecycleReason?: string;
}

export function LeadSalesTemperatureControl({
  leadId,
  effectiveBucket,
  source,
  manualTemperature,
  canEdit,
  lifecycleReason,
}: LeadSalesTemperatureControlProps) {
  const [state, formAction, pending] = useActionState(
    setLeadSalesTemperatureAction,
    INITIAL
  );
  // Derived straight from the action result — no effect, no mirrored state, so
  // there is nothing to fall out of sync with the server response.
  const notice = state.message || null;

  const isManual = source === "manual";

  return (
    <section
      className="rounded-[14px] border border-[var(--crm-border)] bg-[var(--crm-surface)] p-3.5"
      aria-labelledby={`${leadId}-temperature-heading`}
      data-testid="crm-lead-temperature-control"
      data-source={source}
      data-effective={effectiveBucket}
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3
          id={`${leadId}-temperature-heading`}
          className="text-[11px] font-semibold uppercase tracking-[0.08em] text-[var(--crm-muted)]"
        >
          Sales temperature
        </h3>
        <span
          className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.08em] ${
            isManual
              ? "border-[var(--crm-primary)]/40 bg-[var(--crm-primary-soft)] text-[var(--crm-primary)]"
              : "border-[var(--crm-border-strong)] bg-[var(--crm-surface-subtle)] text-[var(--crm-muted)]"
          }`}
          title={CRM_SALES_BUCKET_SOURCE_HINTS[source]}
          data-testid="crm-temperature-source"
        >
          {CRM_SALES_BUCKET_SOURCE_LABELS[source]}
        </span>
      </div>

      {canEdit ? (
        <form action={formAction} className="mt-2.5">
          <input type="hidden" name="leadId" value={leadId} />
          <div
            className="flex flex-wrap gap-1.5"
            role="group"
            aria-label="Set sales temperature"
          >
            {CRM_MANUAL_SALES_TEMPERATURES.map((temperature) => {
              const on = effectiveBucket === temperature;
              return (
                <button
                  key={temperature}
                  type="submit"
                  name="temperature"
                  value={temperature}
                  disabled={pending}
                  data-on={on ? "true" : "false"}
                  aria-pressed={on}
                  data-testid={`crm-temperature-${temperature.toLowerCase()}`}
                  className={`min-h-11 flex-1 rounded-[10px] border border-[var(--crm-border)] bg-[var(--crm-surface-subtle)] px-3 text-[13px] font-semibold text-[var(--crm-text-secondary)] transition disabled:opacity-50 hover:border-[var(--crm-border-strong)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--crm-primary)] sm:flex-none ${TONES[temperature]}`}
                >
                  {CRM_MANUAL_SALES_TEMPERATURE_LABELS[temperature]}
                </button>
              );
            })}

            {isManual ? (
              <button
                type="submit"
                name="temperature"
                value=""
                disabled={pending}
                data-testid="crm-temperature-use-system"
                className="min-h-11 rounded-[10px] border border-dashed border-[var(--crm-border-strong)] px-3 text-[12px] font-medium text-[var(--crm-muted)] transition disabled:opacity-50 hover:text-[var(--crm-text)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--crm-primary)]"
              >
                Use system
              </button>
            ) : null}
          </div>
        </form>
      ) : (
        <p
          className="mt-2.5 text-[12px] text-[var(--crm-text-secondary)]"
          data-testid="crm-temperature-locked"
        >
          {lifecycleReason ??
            "This lead is classified by its lifecycle stage, so the temperature cannot be changed."}
        </p>
      )}

      {manualTemperature && !canEdit ? (
        <p className="mt-1.5 text-[11px] text-[var(--crm-muted)]">
          Saved temperature{" "}
          <span className="font-semibold text-[var(--crm-text-secondary)]">
            {CRM_MANUAL_SALES_TEMPERATURE_LABELS[manualTemperature]}
          </span>{" "}
          returns when the lead resumes.
        </p>
      ) : null}

      {notice ? (
        <p
          className={`mt-2 text-[11px] ${
            state.success ? "text-[var(--crm-success)]" : "text-[var(--crm-danger)]"
          }`}
          role="status"
        >
          {notice}
        </p>
      ) : null}
    </section>
  );
}
