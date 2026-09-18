export const WEBSITE_ANALYTICS_SOURCE_KEYS = [
  "direct", "facebook_ads", "instagram_ads", "meta_ads", "google_ads",
  "google_organic", "facebook_organic", "instagram_organic", "referral",
  "email", "whatsapp", "other_campaign",
] as const;

export type WebsiteAnalyticsSourceKey =
  (typeof WEBSITE_ANALYTICS_SOURCE_KEYS)[number];

export interface WebsiteTrafficSignals {
  readonly utmSource?: string | null;
  readonly utmMedium?: string | null;
  readonly utmCampaign?: string | null;
  readonly utmContent?: string | null;
  readonly utmTerm?: string | null;
  readonly fbclid?: string | null;
  readonly gclid?: string | null;
  readonly wbraid?: string | null;
  readonly gbraid?: string | null;
  readonly referrerHost?: string | null;
}

export interface ResolvedWebsiteTrafficSource {
  readonly sourceKey: WebsiteAnalyticsSourceKey;
  readonly medium: string | null;
  readonly campaign: string | null;
  readonly content: string | null;
  readonly term: string | null;
  readonly referrerHost: string | null;
  readonly hasMetaClick: boolean;
  readonly hasGoogleClick: boolean;
}

const PAID_MEDIA = new Set([
  "cpc", "ppc", "paid", "paid_social", "paid-social",
  "social_paid", "display", "retargeting",
]);

function clean(value: string | null | undefined, max = 200): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  return trimmed.replace(/[\u0000-\u001f\u007f]/g, "").slice(0, max) || null;
}

function lower(value: string | null | undefined, max = 200): string | null {
  return clean(value, max)?.toLowerCase() ?? null;
}

function sourceFromKnownPlatform(
  source: string | null,
  paid: boolean
): WebsiteAnalyticsSourceKey | null {
  if (source === "instagram" || source === "ig") {
    return paid ? "instagram_ads" : "instagram_organic";
  }
  if (source === "facebook" || source === "fb") {
    return paid ? "facebook_ads" : "facebook_organic";
  }
  if (source === "meta" || source === "meta_ads") {
    return paid ? "meta_ads" : "other_campaign";
  }
  if (source === "google" || source === "google_ads" || source === "googleads") {
    return paid ? "google_ads" : "google_organic";
  }
  return null;
}

export function resolveWebsiteTrafficSource(
  input: WebsiteTrafficSignals
): ResolvedWebsiteTrafficSource {
  const source = lower(input.utmSource, 80);
  const medium = lower(input.utmMedium, 80);
  const campaign = clean(input.utmCampaign);
  const content = clean(input.utmContent);
  const term = clean(input.utmTerm);
  const referrerHost = lower(input.referrerHost, 253);
  const hasMetaClick = Boolean(clean(input.fbclid, 200));
  const hasGoogleClick = Boolean(
    clean(input.gclid, 200) || clean(input.wbraid, 200) || clean(input.gbraid, 200)
  );
  const paid = Boolean(medium && PAID_MEDIA.has(medium)) || hasMetaClick || hasGoogleClick;

  const known = sourceFromKnownPlatform(source, paid);
  if (known) {
    return { sourceKey: known, medium, campaign, content, term, referrerHost, hasMetaClick, hasGoogleClick };
  }
  if (hasGoogleClick) {
    return { sourceKey: "google_ads", medium, campaign, content, term, referrerHost, hasMetaClick, hasGoogleClick };
  }
  if (hasMetaClick) {
    return { sourceKey: "meta_ads", medium, campaign, content, term, referrerHost, hasMetaClick, hasGoogleClick };
  }
  if (medium === "email" || source === "email" || source === "newsletter") {
    return { sourceKey: "email", medium, campaign, content, term, referrerHost, hasMetaClick, hasGoogleClick };
  }
  if (source === "whatsapp" || medium === "whatsapp") {
    return { sourceKey: "whatsapp", medium, campaign, content, term, referrerHost, hasMetaClick, hasGoogleClick };
  }
  if (source || medium || campaign) {
    return { sourceKey: "other_campaign", medium, campaign, content, term, referrerHost, hasMetaClick, hasGoogleClick };
  }
  if (referrerHost?.includes("google.")) {
    return { sourceKey: "google_organic", medium, campaign, content, term, referrerHost, hasMetaClick, hasGoogleClick };
  }
  if (referrerHost?.includes("instagram.")) {
    return { sourceKey: "instagram_organic", medium, campaign, content, term, referrerHost, hasMetaClick, hasGoogleClick };
  }
  if (referrerHost?.includes("facebook.") || referrerHost?.includes("fb.")) {
    return { sourceKey: "facebook_organic", medium, campaign, content, term, referrerHost, hasMetaClick, hasGoogleClick };
  }
  if (referrerHost) {
    return { sourceKey: "referral", medium, campaign, content, term, referrerHost, hasMetaClick, hasGoogleClick };
  }
  return { sourceKey: "direct", medium, campaign, content, term, referrerHost, hasMetaClick, hasGoogleClick };
}
