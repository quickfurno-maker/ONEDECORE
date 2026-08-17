/**
 * Phase 9A — campaign budget approval snapshot (no spend/execution).
 */

export interface CampaignBudgetSnapshot {
  readonly currency: "INR";
  readonly dailyBudgetPaise: number;
  readonly totalBudgetPaise: number | null;
}

/** @deprecated Window is a separate approval snapshot. Kept for fixture compatibility. */
export type CampaignBudgetConfig = CampaignBudgetSnapshot & {
  readonly startDate: string;
  readonly endDate: string | null;
};

export function validateCampaignBudgetSnapshot(
  config: CampaignBudgetSnapshot
): string | null {
  if (config.currency !== "INR") return "Budget currency must be INR.";
  if (!Number.isInteger(config.dailyBudgetPaise) || config.dailyBudgetPaise < 0) {
    return "Daily budget must be a nonnegative integer paise amount.";
  }
  if (
    config.totalBudgetPaise != null &&
    (!Number.isInteger(config.totalBudgetPaise) || config.totalBudgetPaise < 0)
  ) {
    return "Total budget must be a nonnegative integer paise amount.";
  }
  return null;
}

export function validateCampaignBudgetConfig(
  config: CampaignBudgetConfig
): string | null {
  const budgetError = validateCampaignBudgetSnapshot(config);
  if (budgetError) return budgetError;
  if (config.startDate > (config.endDate ?? "9999-12-31")) {
    return "Start date must be on or before end date.";
  }
  return null;
}

export interface CampaignIntendedWindowSnapshot {
  readonly startDate: string;
  readonly endDate: string | null;
}

export function validateCampaignIntendedWindowSnapshot(
  window: CampaignIntendedWindowSnapshot
): string | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(window.startDate)) {
    return "Intended window start date must be YYYY-MM-DD.";
  }
  if (window.endDate != null && !/^\d{4}-\d{2}-\d{2}$/.test(window.endDate)) {
    return "Intended window end date must be YYYY-MM-DD.";
  }
  if (window.endDate != null && window.startDate > window.endDate) {
    return "Start date must be on or before end date.";
  }
  return null;
}
