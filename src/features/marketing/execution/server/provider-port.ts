import type { CampaignApprovedExecutionSpec } from "../contracts/approved-execution-spec.ts";
import type {
  CampaignConversionFeedbackCommand,
  CampaignConversionFeedbackOutcome,
} from "../contracts/conversion-feedback.ts";
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
  | { readonly kind: "timeout_unknown"; readonly errorCode: string }
  | { readonly kind: "policy_denied"; readonly errorCode: string };

export type CampaignProviderReconcileOutcome =
  | {
      readonly kind: "found";
      readonly providerCampaignId: string;
      readonly providerStatus: string;
    }
  | { readonly kind: "not_found"; readonly errorCode: string }
  | { readonly kind: "transient"; readonly errorCode: string }
  | { readonly kind: "timeout_unknown"; readonly errorCode: string }
  | { readonly kind: "auth_config"; readonly errorCode: string };

export interface CampaignProviderCommand {
  readonly operationType: CampaignOperationType;
  readonly operationKey: string;
  readonly providerChannel: PaidAdsChannel;
  readonly runReference: string;
  readonly runTargetReference: string;
  readonly boundProviderCampaignId: string | null;
  readonly approvedSpec?: CampaignApprovedExecutionSpec | null;
}

export interface CampaignProviderMetricWindow {
  readonly windowStartIso: string;
  readonly windowEndIso: string;
}

export interface CampaignProviderMetricSnapshot {
  readonly spendMinor: number;
  readonly impressions: number;
  readonly clicks: number;
  readonly providerConversions: number;
  readonly currency: string;
  readonly providerRevision: string | null;
}

export type CampaignProviderMetricsOutcome =
  | { readonly kind: "success"; readonly snapshot: CampaignProviderMetricSnapshot }
  | { readonly kind: "transient_failure"; readonly errorCode: string }
  | { readonly kind: "validation_failure"; readonly errorCode: string }
  | { readonly kind: "timeout_unknown"; readonly errorCode: string };

export interface CampaignExecutionProvider {
  readonly code: "mock" | "meta_ads" | "google_ads";
  create(command: CampaignProviderCommand): Promise<CampaignProviderOutcome>;
  activate(command: CampaignProviderCommand): Promise<CampaignProviderOutcome>;
  pause(command: CampaignProviderCommand): Promise<CampaignProviderOutcome>;
  resume(command: CampaignProviderCommand): Promise<CampaignProviderOutcome>;
  cancel(command: CampaignProviderCommand): Promise<CampaignProviderOutcome>;
  getStatus(command: CampaignProviderCommand): Promise<CampaignProviderReconcileOutcome>;
  fetchMetrics(
    command: CampaignProviderCommand,
    window: CampaignProviderMetricWindow
  ): Promise<CampaignProviderMetricsOutcome>;
  buildConversionFeedbackRequest(command: CampaignConversionFeedbackCommand): Record<string, unknown>;
  submitConversionFeedback(
    command: CampaignConversionFeedbackCommand
  ): Promise<CampaignConversionFeedbackOutcome>;
}
