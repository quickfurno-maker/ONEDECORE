export const CRM_NURTURE_STAGES = [
  "long_horizon",
  "dormant_30",
  "dormant_60",
  "dormant_90",
  "re_engaged",
] as const;
export type CrmNurtureStage = (typeof CRM_NURTURE_STAGES)[number];

const DAY_MS = 86_400_000;

function latestMs(values: readonly (string | null | undefined)[]): number {
  let latest = Number.NEGATIVE_INFINITY;
  for (const value of values) {
    if (!value) continue;
    const parsed = Date.parse(value);
    if (Number.isFinite(parsed)) latest = Math.max(latest, parsed);
  }
  return latest;
}

export interface CrmNurtureStageInput {
  readonly createdAt: string;
  readonly lastMeaningfulActivityAt: string | null;
  readonly lastInboundAt: string | null;
  readonly lastNurtureAt: string | null;
  readonly reengagedAt: string | null;
}

export function resolveCrmNurtureStage(
  input: CrmNurtureStageInput,
  now = new Date()
): CrmNurtureStage {
  const lastNurtureMs = input.lastNurtureAt ? Date.parse(input.lastNurtureAt) : Number.NaN;
  const reengagedMs = input.reengagedAt ? Date.parse(input.reengagedAt) : Number.NaN;
  if (
    Number.isFinite(lastNurtureMs) &&
    Number.isFinite(reengagedMs) &&
    reengagedMs >= lastNurtureMs
  ) {
    return "re_engaged";
  }

  const lastEngagement = latestMs([
    input.createdAt,
    input.lastMeaningfulActivityAt,
    input.lastInboundAt,
  ]);
  const ageDays = Math.max(0, Math.floor((now.getTime() - lastEngagement) / DAY_MS));
  if (ageDays >= 90) return "dormant_90";
  if (ageDays >= 60) return "dormant_60";
  if (ageDays >= 30) return "dormant_30";
  return "long_horizon";
}

export function crmNurtureStageLabel(stage: CrmNurtureStage): string {
  switch (stage) {
    case "long_horizon":
      return "Long horizon";
    case "dormant_30":
      return "Dormant · 30d";
    case "dormant_60":
      return "Dormant · 60d";
    case "dormant_90":
      return "Dormant · 90d";
    case "re_engaged":
      return "Re-engaged";
  }
}

export function isCrmNurtureTemporarilySuppressed(
  suppressedUntil: string | null,
  now = new Date()
): boolean {
  if (!suppressedUntil) return false;
  const until = Date.parse(suppressedUntil);
  return Number.isFinite(until) && until > now.getTime();
}
