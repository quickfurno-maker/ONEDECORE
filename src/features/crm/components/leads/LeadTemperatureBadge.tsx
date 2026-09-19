import {
  CRM_MANUAL_SALES_TEMPERATURE_LABELS,
  displayLeadTemperature,
  type CrmManualSalesTemperature,
} from "../../contracts/lead-sales-temperature.ts";

const TEMPERATURE_STYLES: Readonly<
  Record<CrmManualSalesTemperature, string>
> = {
  HOT: "border-[var(--crm-danger)]/35 bg-[var(--crm-danger-soft)] text-[var(--crm-danger)]",
  WARM: "border-[var(--crm-warning)]/35 bg-[var(--crm-warning-soft)] text-[var(--crm-warning)]",
  COLD: "border-[var(--crm-border-strong)] bg-[var(--crm-surface-subtle)] text-[var(--crm-muted)]",
};

interface LeadTemperatureBadgeProps {
  readonly temperature: CrmManualSalesTemperature | null;
}

export function LeadTemperatureBadge({
  temperature,
}: LeadTemperatureBadgeProps) {
  const displayed =
    displayLeadTemperature(temperature);
  const isDefault = temperature === null;

  return (
    <span
      className={`inline-flex items-center rounded-md border px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide ${TEMPERATURE_STYLES[displayed]}`}
      data-testid="crm-lead-temperature"
      data-temperature={displayed}
      data-default={isDefault ? "true" : "false"}
      title={
        isDefault
          ? "Not manually marked yet; treated as Cold."
          : "Lead temperature"
      }
    >
      {CRM_MANUAL_SALES_TEMPERATURE_LABELS[displayed]}
    </span>
  );
}

