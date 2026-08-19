import type { CampaignProviderClickIdentifier } from "./click-identifiers.ts";

export type ConversionFeedbackType =
  | "LeadCreated"
  | "QualifiedLead"
  | "ConsultationScheduled"
  | "ProposalSent"
  | "CommercialConversion";

export interface CampaignConversionFeedbackCommand {
  readonly eventReference: string;
  readonly conversionType: ConversionFeedbackType;
  readonly occurredAt: string;
  readonly runReference: string;
  readonly runTargetReference: string;
  readonly providerChannel: "meta_ads" | "google_ads";
  readonly clickIdentifiers: readonly CampaignProviderClickIdentifier[];
  readonly conversionActionResource: string | null;
  readonly pixelOrDatasetId: string | null;
  readonly valueMinor: number | null;
  readonly currency: string | null;
}

export type CampaignConversionFeedbackOutcome =
  | { readonly kind: "submitted"; readonly providerSubmissionId: string }
  | { readonly kind: "blocked"; readonly errorCode: string }
  | { readonly kind: "rejected"; readonly errorCode: string }
  | { readonly kind: "transient_failure"; readonly errorCode: string }
  | { readonly kind: "timeout_unknown"; readonly errorCode: string };
