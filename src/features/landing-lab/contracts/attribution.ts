/**
 * Phase 9 migration-independent — traffic destination and attribution contracts.
 */

export interface TrafficDestination {
  readonly publicationReference: string;
  readonly pageVersion: {
    readonly pageReference: string;
    readonly versionNumber: number;
  };
  readonly experimentReference: string | null;
  readonly variantKey: string | null;
}

export interface AttributionTouchpoint {
  readonly touchpointId: string;
  readonly occurredAt: string;
  readonly landingPageReference: string;
  readonly pageVersionNumber: number;
  readonly publicationReference: string;
  readonly experimentReference: string | null;
  readonly variantKey: string | null;
  readonly campaignReference: string | null;
  readonly campaignVersionNumber: number | null;
  readonly leadReference: string | null;
  readonly utmSource: string | null;
  readonly utmMedium: string | null;
  readonly utmCampaign: string | null;
  readonly utmContent: string | null;
  readonly utmTerm: string | null;
  readonly fbclid: string | null;
  readonly gclid: string | null;
  readonly auxiliary: Readonly<Record<string, string>>;
}

export interface NormalizedAttributionParams {
  readonly utmSource: string | null;
  readonly utmMedium: string | null;
  readonly utmCampaign: string | null;
  readonly utmContent: string | null;
  readonly utmTerm: string | null;
  readonly fbclid: string | null;
  readonly gclid: string | null;
}
