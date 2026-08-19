import type { PaidAdsChannel } from "../contracts/run-lifecycle.ts";
import {
  APPROVED_SPEC_HASH_PATTERN,
  CAMPAIGN_APPROVED_SNAPSHOT_PROVIDER_INCOMPATIBLE,
  HTTPS_URL_PATTERN,
  type CampaignApprovedExecutionSpec,
} from "../contracts/approved-execution-spec.ts";

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function asStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value
    .filter((item): item is string => typeof item === "string")
    .map((item) => item.trim())
    .filter((item) => item.length > 0);
}

function readHttpsUrl(value: string | null): string | null {
  if (!value) return null;
  const trimmed = value.trim();
  if (!HTTPS_URL_PATTERN.test(trimmed)) return null;
  try {
    const url = new URL(trimmed);
    if (url.protocol !== "https:") return null;
    return url.toString();
  } catch {
    return null;
  }
}

export function parseCampaignApprovedExecutionSpec(input: {
  readonly campaignVersionId: string;
  readonly versionStatus: string;
  readonly versionConfigurationHash: string;
  readonly runConfigurationHash: string;
  readonly providerChannel: string;
  readonly targetingMode: string;
  readonly audienceRuleHash: string | null;
  readonly budgetSnapshot: unknown;
  readonly creativeSnapshot: unknown;
  readonly intendedWindowSnapshot: unknown;
  readonly destinationReference: string | null;
}):
  | { readonly ok: true; readonly spec: CampaignApprovedExecutionSpec }
  | { readonly ok: false; readonly code: string } {
  if (input.versionStatus !== "approved") {
    return { ok: false, code: CAMPAIGN_APPROVED_SNAPSHOT_PROVIDER_INCOMPATIBLE };
  }
  if (
    !APPROVED_SPEC_HASH_PATTERN.test(input.versionConfigurationHash) ||
    input.versionConfigurationHash !== input.runConfigurationHash
  ) {
    return { ok: false, code: "CAMPAIGN_CONFIGURATION_HASH_MISMATCH" };
  }
  if (input.providerChannel !== "meta_ads" && input.providerChannel !== "google_ads") {
    return { ok: false, code: CAMPAIGN_APPROVED_SNAPSHOT_PROVIDER_INCOMPATIBLE };
  }
  if (input.targetingMode === "direct_or_custom") {
    return { ok: false, code: "PROVIDER_CUSTOM_EXPORT_DISABLED" };
  }
  if (input.targetingMode !== "broad_public") {
    return { ok: false, code: CAMPAIGN_APPROVED_SNAPSHOT_PROVIDER_INCOMPATIBLE };
  }
  if (input.audienceRuleHash != null && input.audienceRuleHash !== "" && !APPROVED_SPEC_HASH_PATTERN.test(input.audienceRuleHash)) {
    return { ok: false, code: CAMPAIGN_APPROVED_SNAPSHOT_PROVIDER_INCOMPATIBLE };
  }

  const budget = asRecord(input.budgetSnapshot);
  const daily = budget.daily_budget_paise;
  if (budget.currency !== "INR" || typeof daily !== "number" || !Number.isInteger(daily) || daily < 1) {
    return { ok: false, code: CAMPAIGN_APPROVED_SNAPSHOT_PROVIDER_INCOMPATIBLE };
  }
  const total = budget.total_budget_paise;
  if (total != null && (typeof total !== "number" || !Number.isInteger(total) || total < 0)) {
    return { ok: false, code: CAMPAIGN_APPROVED_SNAPSHOT_PROVIDER_INCOMPATIBLE };
  }

  const creative = asRecord(input.creativeSnapshot);
  const headline = typeof creative.headline === "string" ? creative.headline.trim() : "";
  const primaryText = typeof creative.primary_text === "string" ? creative.primary_text.trim() : "";
  const callToAction = typeof creative.call_to_action === "string" ? creative.call_to_action.trim() : "";
  if (!headline || !primaryText || !callToAction) {
    return { ok: false, code: CAMPAIGN_APPROVED_SNAPSHOT_PROVIDER_INCOMPATIBLE };
  }

  const window = asRecord(input.intendedWindowSnapshot);
  const startDate = typeof window.start_date === "string" ? window.start_date.trim() : "";
  if (!/^\d{4}-\d{2}-\d{2}$/.test(startDate)) {
    return { ok: false, code: CAMPAIGN_APPROVED_SNAPSHOT_PROVIDER_INCOMPATIBLE };
  }
  const endRaw = typeof window.end_date === "string" ? window.end_date.trim() : "";
  const endDate = endRaw === "" ? null : endRaw;
  if (endDate != null && !/^\d{4}-\d{2}-\d{2}$/.test(endDate)) {
    return { ok: false, code: CAMPAIGN_APPROVED_SNAPSHOT_PROVIDER_INCOMPATIBLE };
  }

  const destinationReference = (input.destinationReference ?? "").trim();
  if (!destinationReference) {
    return { ok: false, code: CAMPAIGN_APPROVED_SNAPSHOT_PROVIDER_INCOMPATIBLE };
  }
  const extraUrl =
    typeof creative.destination_url === "string" ? creative.destination_url : null;
  const finalHttpsUrl = readHttpsUrl(destinationReference) ?? readHttpsUrl(extraUrl);

  const headlines = asStringArray(creative.headlines);
  const descriptions = asStringArray(creative.descriptions);
  const keywords = asStringArray(creative.keywords);
  const geoCountryCodes = asStringArray(creative.geo_country_codes).map((code) => code.toUpperCase());

  return {
    ok: true,
    spec: {
      campaignVersionId: input.campaignVersionId,
      configurationHash: input.versionConfigurationHash,
      providerChannel: input.providerChannel as PaidAdsChannel,
      targetingMode: input.targetingMode,
      budget: {
        currency: "INR",
        dailyBudgetPaise: daily,
        totalBudgetPaise: typeof total === "number" ? total : null,
      },
      creative: {
        headline,
        primaryText,
        callToAction,
        mediaReferences: asStringArray(creative.media_references),
        headlines: headlines.length > 0 ? headlines : [headline],
        descriptions: descriptions.length > 0 ? descriptions : [primaryText],
        keywords,
        geoCountryCodes,
      },
      intendedWindow: { startDate, endDate },
      destination: { reference: destinationReference, finalHttpsUrl },
    },
  };
}
