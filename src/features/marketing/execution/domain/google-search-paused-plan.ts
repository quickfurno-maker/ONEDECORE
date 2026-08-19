import {
  CAMPAIGN_APPROVED_SNAPSHOT_PROVIDER_INCOMPATIBLE,
  type CampaignApprovedExecutionSpec,
} from "../contracts/approved-execution-spec.ts";
import { spendMinorToGoogleMicros } from "../server/money.ts";

const RSA_HEADLINE_MAX = 30;
const RSA_DESCRIPTION_MAX = 90;
const RSA_MIN_HEADLINES = 3;
const RSA_MIN_DESCRIPTIONS = 2;

export interface GoogleSearchPausedCreatePlan {
  readonly amountMicros: string;
  readonly mutateBody: Record<string, unknown>;
}

export function buildGoogleSearchPausedCreatePlan(
  spec: CampaignApprovedExecutionSpec,
  customerId: string
): { readonly ok: true; readonly plan: GoogleSearchPausedCreatePlan } | { readonly ok: false; readonly code: string } {
  if (spec.providerChannel !== "google_ads") {
    return { ok: false, code: CAMPAIGN_APPROVED_SNAPSHOT_PROVIDER_INCOMPATIBLE };
  }
  if (!spec.destination.finalHttpsUrl) {
    return { ok: false, code: CAMPAIGN_APPROVED_SNAPSHOT_PROVIDER_INCOMPATIBLE };
  }
  const headlines = spec.creative.headlines.filter((text) => text.length >= 1 && text.length <= RSA_HEADLINE_MAX);
  const descriptions = spec.creative.descriptions.filter(
    (text) => text.length >= 1 && text.length <= RSA_DESCRIPTION_MAX
  );
  if (headlines.length < RSA_MIN_HEADLINES || descriptions.length < RSA_MIN_DESCRIPTIONS) {
    return { ok: false, code: CAMPAIGN_APPROVED_SNAPSHOT_PROVIDER_INCOMPATIBLE };
  }
  if (spec.creative.keywords.length < 1) {
    return { ok: false, code: CAMPAIGN_APPROVED_SNAPSHOT_PROVIDER_INCOMPATIBLE };
  }
  if (headlines.some((text) => !spec.creative.headlines.includes(text))) {
    return { ok: false, code: CAMPAIGN_APPROVED_SNAPSHOT_PROVIDER_INCOMPATIBLE };
  }

  const amountMicros = spendMinorToGoogleMicros(spec.budget.dailyBudgetPaise).toString();
  const budgetTemp = `customers/${customerId}/campaignBudgets/-1`;
  const campaignTemp = `customers/${customerId}/campaigns/-2`;
  const adGroupTemp = `customers/${customerId}/adGroups/-3`;

  const campaign: Record<string, unknown> = {
    resourceName: campaignTemp,
    name: `ONEDECORE ${spec.configurationHash.slice(0, 12)}`,
    status: "PAUSED",
    advertisingChannelType: "SEARCH",
    campaignBudget: budgetTemp,
    startDate: spec.intendedWindow.startDate,
  };
  if (spec.intendedWindow.endDate) {
    campaign.endDate = spec.intendedWindow.endDate;
  }

  return {
    ok: true,
    plan: {
      amountMicros,
      mutateBody: {
        mutateOperations: [
          {
            campaignBudgetOperation: {
              create: {
                resourceName: budgetTemp,
                name: `ONEDECORE budget ${spec.configurationHash.slice(0, 12)}`,
                amountMicros,
                explicitlyShared: false,
              },
            },
          },
          { campaignOperation: { create: campaign } },
          {
            adGroupOperation: {
              create: {
                resourceName: adGroupTemp,
                name: `ONEDECORE ad group ${spec.configurationHash.slice(0, 12)}`,
                campaign: campaignTemp,
                status: "PAUSED",
                type: "SEARCH_STANDARD",
              },
            },
          },
          {
            adGroupCriterionOperation: {
              create: {
                adGroup: adGroupTemp,
                status: "PAUSED",
                keyword: { text: spec.creative.keywords[0], matchType: "BROAD" },
              },
            },
          },
          {
            adGroupAdOperation: {
              create: {
                adGroup: adGroupTemp,
                status: "PAUSED",
                ad: {
                  finalUrls: [spec.destination.finalHttpsUrl],
                  responsiveSearchAd: {
                    headlines: headlines.slice(0, 15).map((text) => ({ text })),
                    descriptions: descriptions.slice(0, 4).map((text) => ({ text })),
                  },
                },
              },
            },
          },
        ],
      },
    },
  };
}
