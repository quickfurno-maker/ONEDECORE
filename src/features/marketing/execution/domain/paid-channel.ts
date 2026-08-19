import type { MarketingChannel } from "../../contracts/channel.ts";
import {
  isPaidAdsChannel,
  type DeferredMarketingChannel,
  type PaidAdsChannel,
} from "../contracts/run-lifecycle.ts";

export const MULTI_PROVIDER_EXECUTION_REQUIRES_SEPARATE_APPROVED_VERSIONS =
  "MULTI_PROVIDER_EXECUTION_REQUIRES_SEPARATE_APPROVED_VERSIONS";

export const CAMPAIGN_NO_PAID_ADS_CHANNEL = "CAMPAIGN_NO_PAID_ADS_CHANNEL";

export type PaidChannelResolution =
  | {
      readonly ok: true;
      readonly providerChannel: PaidAdsChannel;
      readonly deferredChannels: readonly DeferredMarketingChannel[];
    }
  | {
      readonly ok: false;
      readonly code:
        | typeof MULTI_PROVIDER_EXECUTION_REQUIRES_SEPARATE_APPROVED_VERSIONS
        | typeof CAMPAIGN_NO_PAID_ADS_CHANNEL;
      readonly message: string;
    };

export function resolvePaidAdsExecutionChannel(
  intendedChannels: readonly MarketingChannel[] | readonly string[]
): PaidChannelResolution {
  const paid = intendedChannels.filter((channel) => isPaidAdsChannel(channel));
  const deferred = intendedChannels.filter(
    (channel): channel is DeferredMarketingChannel =>
      channel === "email" || channel === "whatsapp"
  );

  if (paid.length === 0) {
    return {
      ok: false,
      code: CAMPAIGN_NO_PAID_ADS_CHANNEL,
      message: "Approved version has no paid Ads channel to execute.",
    };
  }
  if (paid.length > 1) {
    return {
      ok: false,
      code: MULTI_PROVIDER_EXECUTION_REQUIRES_SEPARATE_APPROVED_VERSIONS,
      message:
        "Both Meta Ads and Google Ads are on this approved version. Create separate approved versions — one Ads provider per run.",
    };
  }
  const providerChannel = paid[0];
  if (!providerChannel || !isPaidAdsChannel(providerChannel)) {
    return {
      ok: false,
      code: CAMPAIGN_NO_PAID_ADS_CHANNEL,
      message: "Approved version has no paid Ads channel to execute.",
    };
  }
  return {
    ok: true,
    providerChannel,
    deferredChannels: deferred as readonly DeferredMarketingChannel[],
  };
}

export function describeDeferredChannels(
  deferredChannels: readonly string[]
): string {
  if (deferredChannels.length === 0) {
    return "No deferred email/WhatsApp intent on this version.";
  }
  return `${deferredChannels.join(", ")} remain NOT EXECUTED / OUT OF 9C MVP.`;
}
