import {
  CAMPAIGN_APPROVED_SNAPSHOT_PROVIDER_INCOMPATIBLE,
  type CampaignApprovedExecutionSpec,
} from "../contracts/approved-execution-spec.ts";

export interface MetaPausedCreatePlan {
  readonly urlPath: string;
  readonly params: Record<string, string>;
}

export function buildMetaPausedCreatePlan(
  spec: CampaignApprovedExecutionSpec,
  input: { readonly pageId: string }
): { readonly ok: true; readonly plan: MetaPausedCreatePlan } | { readonly ok: false; readonly code: string } {
  if (spec.providerChannel !== "meta_ads") {
    return { ok: false, code: CAMPAIGN_APPROVED_SNAPSHOT_PROVIDER_INCOMPATIBLE };
  }
  if (!spec.destination.finalHttpsUrl) {
    return { ok: false, code: CAMPAIGN_APPROVED_SNAPSHOT_PROVIDER_INCOMPATIBLE };
  }
  if (!input.pageId.trim()) {
    return { ok: false, code: "CAMPAIGN_PROVIDER_CONFIG_MISSING" };
  }
  if (spec.creative.geoCountryCodes.length < 1) {
    return { ok: false, code: CAMPAIGN_APPROVED_SNAPSHOT_PROVIDER_INCOMPATIBLE };
  }
  if (!/^[A-Z]{2}$/.test(spec.creative.geoCountryCodes[0] ?? "")) {
    return { ok: false, code: CAMPAIGN_APPROVED_SNAPSHOT_PROVIDER_INCOMPATIBLE };
  }
  const ctaType = spec.creative.callToAction.trim().toUpperCase().replace(/\s+/g, "_");
  if (!/^(LEARN_MORE|SHOP_NOW|SIGN_UP|CONTACT_US|APPLY_NOW|GET_QUOTE)$/.test(ctaType)) {
    return { ok: false, code: CAMPAIGN_APPROVED_SNAPSHOT_PROVIDER_INCOMPATIBLE };
  }

  const startTime = `${spec.intendedWindow.startDate}T00:00:00+0000`;
  const adsetSpec: Record<string, unknown> = {
    name: `ONEDECORE ad set ${spec.configurationHash.slice(0, 12)}`,
    daily_budget: spec.budget.dailyBudgetPaise,
    billing_event: "IMPRESSIONS",
    optimization_goal: "LANDING_PAGE_VIEWS",
    bid_strategy: "LOWEST_COST_WITHOUT_CAP",
    targeting: { geo_locations: { countries: spec.creative.geoCountryCodes } },
    start_time: startTime,
    status: "PAUSED",
    campaign_spec: {
      name: `ONEDECORE ${spec.configurationHash.slice(0, 12)}`,
      objective: "OUTCOME_TRAFFIC",
      status: "PAUSED",
      special_ad_categories: [],
      buying_type: "AUCTION",
    },
  };
  if (spec.intendedWindow.endDate) {
    adsetSpec.end_time = `${spec.intendedWindow.endDate}T00:00:00+0000`;
  }

  return {
    ok: true,
    plan: {
      urlPath: "/ads",
      params: {
        name: `ONEDECORE ad ${spec.configurationHash.slice(0, 12)}`,
        status: "PAUSED",
        adset_spec: JSON.stringify(adsetSpec),
        creative: JSON.stringify({
          object_story_spec: {
            page_id: input.pageId.trim(),
            link_data: {
              message: spec.creative.primaryText,
              name: spec.creative.headline,
              link: spec.destination.finalHttpsUrl,
              call_to_action: { type: ctaType, value: { link: spec.destination.finalHttpsUrl } },
            },
          },
        }),
      },
    },
  };
}
