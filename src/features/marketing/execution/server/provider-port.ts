/**
 * Provider-neutral campaign execution port. No Meta/Google SDK types.
 */

import type { PaidAdsChannel } from "../contracts/run-lifecycle.ts";
import type { CampaignOperationType } from "../contracts/run-lifecycle.ts";

export type CampaignProviderOutcome =
  | {
      readonly kind: "success";
      readonly providerCampaignId: string;
      readonly providerAdSetId?: string | null;
      readonly providerAdGroupId?: string | null;
      readonly providerStatus: string;
    }
  | { readonly kind: "transient_failure"; readonly errorCode: string }
  | { readonly kind: "validation_failure"; readonly errorCode: string }
  | { readonly kind: "timeout_unknown"; readonly errorCode: string };

export type CampaignProviderReconcileOutcome =
  | {
      readonly kind: "found";
      readonly providerCampaignId: string;
      readonly providerStatus: string;
    }
  | { readonly kind: "not_found"; readonly errorCode: string };

export interface CampaignProviderCommand {
  readonly operationType: CampaignOperationType;
  readonly operationKey: string;
  readonly providerChannel: PaidAdsChannel;
  readonly runReference: string;
  readonly runTargetReference: string;
  readonly boundProviderCampaignId: string | null;
}

export interface CampaignExecutionProvider {
  readonly code: "mock";
  create(command: CampaignProviderCommand): Promise<CampaignProviderOutcome>;
  activate(command: CampaignProviderCommand): Promise<CampaignProviderOutcome>;
  pause(command: CampaignProviderCommand): Promise<CampaignProviderOutcome>;
  resume(command: CampaignProviderCommand): Promise<CampaignProviderOutcome>;
  cancel(command: CampaignProviderCommand): Promise<CampaignProviderOutcome>;
  getStatus(command: CampaignProviderCommand): Promise<CampaignProviderReconcileOutcome>;
}
