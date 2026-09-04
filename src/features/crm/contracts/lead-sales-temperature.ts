/**
 * CRM — the MANUAL sales temperature.
 *
 * The salesperson controls the working temperature; the system supplies
 * intelligence, not authority.
 *
 * Only three values are humanly selectable: HOT, WARM, COLD. LOST, WON and
 * ON_HOLD are lifecycle OUTCOMES — they are read from `leads.status` and can
 * never be chosen here or persisted here. Letting someone tick "LOST" as a
 * temperature would create a second, competing source of truth for whether a
 * deal is dead.
 *
 * NULL is meaningful: it means "no human has judged this lead yet", and the
 * effective bucket falls back to the advisory system score. It is deliberately
 * not a fourth temperature.
 */

import type { CrmLeadSalesBucket } from "./lead-sales-bucket.ts";

export const CRM_MANUAL_SALES_TEMPERATURES = ["HOT", "WARM", "COLD"] as const;

export type CrmManualSalesTemperature =
  (typeof CRM_MANUAL_SALES_TEMPERATURES)[number];

export const CRM_MANUAL_SALES_TEMPERATURE_LABELS: Readonly<
  Record<CrmManualSalesTemperature, string>
> = {
  HOT: "Hot",
  WARM: "Warm",
  COLD: "Cold",
};

/** Stored lowercase, matching the database CHECK constraint. */
export const CRM_MANUAL_SALES_TEMPERATURE_VALUES: Readonly<
  Record<CrmManualSalesTemperature, string>
> = {
  HOT: "hot",
  WARM: "warm",
  COLD: "cold",
};

/**
 * Where the effective bucket came from. Shown in the UI so a salesperson can
 * always tell their own judgement from a machine suggestion.
 */
export const CRM_SALES_BUCKET_SOURCES = [
  "lifecycle",
  "manual",
  "system",
] as const;

export type CrmSalesBucketSource = (typeof CRM_SALES_BUCKET_SOURCES)[number];

export const CRM_SALES_BUCKET_SOURCE_LABELS: Readonly<
  Record<CrmSalesBucketSource, string>
> = {
  lifecycle: "Lifecycle",
  manual: "Manual",
  system: "Auto",
};

export const CRM_SALES_BUCKET_SOURCE_HINTS: Readonly<
  Record<CrmSalesBucketSource, string>
> = {
  lifecycle: "Set by the lead's lifecycle stage, not by temperature.",
  manual: "Set by a person on your team.",
  system: "Using the system suggestion until someone chooses.",
};

/**
 * Parses a stored value. Anything outside hot/warm/cold — including the
 * lifecycle words — reads as "no override" rather than being coerced, so a bad
 * row degrades to the system suggestion instead of inventing a temperature.
 */
export function parseManualSalesTemperature(
  value: unknown
): CrmManualSalesTemperature | null {
  if (value == null) {
    return null;
  }
  const raw = String(value).trim().toUpperCase();
  return (CRM_MANUAL_SALES_TEMPERATURES as readonly string[]).includes(raw)
    ? (raw as CrmManualSalesTemperature)
    : null;
}

/** The wire value for the mutation. `null` clears the override. */
export function manualSalesTemperatureValue(
  temperature: CrmManualSalesTemperature | null
): string | null {
  return temperature === null
    ? null
    : CRM_MANUAL_SALES_TEMPERATURE_VALUES[temperature];
}

/** Every manual temperature is also a bucket; the reverse is not true. */
export function manualTemperatureAsBucket(
  temperature: CrmManualSalesTemperature
): CrmLeadSalesBucket {
  return temperature;
}

/**
 * True while the lifecycle owns the classification, so the temperature control
 * must be disabled: editing it would change nothing visible.
 */
export function isLifecycleControlledBucket(
  bucket: CrmLeadSalesBucket
): boolean {
  return bucket === "LOST" || bucket === "WON" || bucket === "ON_HOLD";
}
