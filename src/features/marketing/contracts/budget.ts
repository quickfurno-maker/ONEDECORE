/**
 * Phase 9 migration-independent — campaign budget config (validators only).
 */

export interface CampaignBudgetConfig {
  readonly currency: "INR";
  readonly dailyBudgetPaise: number;
  readonly totalBudgetPaise: number | null;
  readonly startDate: string;
  readonly endDate: string | null;
}

export function validateCampaignBudgetConfig(
  config: CampaignBudgetConfig
): string | null {
  if (config.dailyBudgetPaise < 0) return "Daily budget must be nonnegative.";
  if (config.totalBudgetPaise != null && config.totalBudgetPaise < 0) {
    return "Total budget must be nonnegative.";
  }
  if (config.startDate > (config.endDate ?? "9999-12-31")) {
    return "Start date must be on or before end date.";
  }
  return null;
}
