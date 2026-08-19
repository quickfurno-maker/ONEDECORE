/** Official Graph/Marketing API latest as of 2026-08-19: https://developers.facebook.com/docs/graph-api/changelog/ */
export const META_MARKETING_API_VERSION = "v26.0";
/** Official Google Ads API latest major as of 2026-08-19: https://developers.google.com/google-ads/api/docs/sunset-dates */
export const GOOGLE_ADS_API_VERSION = "v25";

export const CAMPAIGN_PRODUCTION_ENABLED_ENV = "ONEDECORE_CAMPAIGN_PRODUCTION_ENABLED";
export const CAMPAIGN_SANDBOX_TRANSPORT_ENABLED_ENV = "ONEDECORE_CAMPAIGN_SANDBOX_TRANSPORT_ENABLED";
export const PROVIDER_DATA_SHARING_ENABLED_ENV = "ONEDECORE_PROVIDER_DATA_SHARING_ENABLED";

export interface MetaAdsProviderConfig {
  readonly adAccountId: string;
  readonly accessToken: string;
  readonly graphVersion: string;
  readonly pageId: string | null;
  readonly datasetId: string | null;
}

export interface GoogleAdsProviderConfig {
  readonly customerId: string;
  readonly developerToken: string;
  readonly clientId: string;
  readonly clientSecret: string;
  readonly refreshToken: string;
  readonly loginCustomerId: string | null;
  readonly conversionActionResource: string | null;
}

function read(env: Record<string, string | undefined>, name: string): string | null {
  const value = env[name];
  if (value == null || value.trim() === "") return null;
  return value.trim();
}

export function isCampaignProductionEnabled(
  env: NodeJS.ProcessEnv | Record<string, string | undefined> = process.env
): boolean {
  return env[CAMPAIGN_PRODUCTION_ENABLED_ENV] === "true";
}

export function isCampaignSandboxTransportEnabled(
  env: NodeJS.ProcessEnv | Record<string, string | undefined> = process.env
): boolean {
  return env[CAMPAIGN_SANDBOX_TRANSPORT_ENABLED_ENV] === "true";
}

export function resolveMetaAdsProviderConfig(
  env: NodeJS.ProcessEnv | Record<string, string | undefined> = process.env
): { readonly ok: true; readonly config: MetaAdsProviderConfig } | { readonly ok: false; readonly code: string } {
  const adAccountId = read(env, "ONEDECORE_META_ADS_ACCOUNT_ID");
  const accessToken = read(env, "ONEDECORE_META_ADS_ACCESS_TOKEN");
  const graphVersion = read(env, "ONEDECORE_META_ADS_GRAPH_VERSION") ?? META_MARKETING_API_VERSION;
  if (!adAccountId || !accessToken) {
    return { ok: false, code: "CAMPAIGN_PROVIDER_CONFIG_MISSING" };
  }
  return {
    ok: true,
    config: {
      adAccountId,
      accessToken,
      graphVersion,
      pageId: read(env, "ONEDECORE_META_ADS_PAGE_ID"),
      datasetId: read(env, "ONEDECORE_META_ADS_DATASET_ID") ?? read(env, "ONEDECORE_META_ADS_PIXEL_ID"),
    },
  };
}

export function resolveGoogleAdsProviderConfig(
  env: NodeJS.ProcessEnv | Record<string, string | undefined> = process.env
): { readonly ok: true; readonly config: GoogleAdsProviderConfig } | { readonly ok: false; readonly code: string } {
  const customerId = read(env, "ONEDECORE_GOOGLE_ADS_CUSTOMER_ID");
  const developerToken = read(env, "ONEDECORE_GOOGLE_ADS_DEVELOPER_TOKEN");
  const clientId = read(env, "ONEDECORE_GOOGLE_ADS_CLIENT_ID");
  const clientSecret = read(env, "ONEDECORE_GOOGLE_ADS_CLIENT_SECRET");
  const refreshToken = read(env, "ONEDECORE_GOOGLE_ADS_REFRESH_TOKEN");
  const loginCustomerId = read(env, "ONEDECORE_GOOGLE_ADS_LOGIN_CUSTOMER_ID");
  if (!customerId || !developerToken || !clientId || !clientSecret || !refreshToken) {
    return { ok: false, code: "CAMPAIGN_PROVIDER_CONFIG_MISSING" };
  }
  return {
    ok: true,
    config: {
      customerId,
      developerToken,
      clientId,
      clientSecret,
      refreshToken,
      loginCustomerId,
      conversionActionResource: read(env, "ONEDECORE_GOOGLE_ADS_CONVERSION_ACTION"),
    },
  };
}
