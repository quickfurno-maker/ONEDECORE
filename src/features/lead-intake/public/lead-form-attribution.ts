/**
 * Browser-only attribution collection for public lead intake.
 */

import { isSafeSameSitePath } from "../same-site-path.ts";

export interface LeadFormAttribution {
  readonly landingPath: string;
  readonly referrerPath?: string;
  readonly utmSource?: string;
  readonly utmMedium?: string;
  readonly utmCampaign?: string;
  readonly utmTerm?: string;
  readonly utmContent?: string;
}

const UTM_KEYS = [
  ["utm_source", "utmSource"],
  ["utm_medium", "utmMedium"],
  ["utm_campaign", "utmCampaign"],
  ["utm_term", "utmTerm"],
  ["utm_content", "utmContent"],
] as const;

function readUtmParams(searchParams: URLSearchParams): Partial<
  Pick<
    LeadFormAttribution,
    "utmSource" | "utmMedium" | "utmCampaign" | "utmTerm" | "utmContent"
  >
> {
  const out: Record<string, string> = {};
  for (const [queryKey, fieldKey] of UTM_KEYS) {
    const value = searchParams.get(queryKey)?.trim();
    if (value) out[fieldKey] = value;
  }
  return out;
}

function sameOriginReferrerPath(referrer: string): string | undefined {
  if (typeof window === "undefined") return undefined;
  try {
    const ref = new URL(referrer);
    if (ref.origin !== window.location.origin) return undefined;
    const path = `${ref.pathname}${ref.search}${ref.hash}`;
    return isSafeSameSitePath(path, 200) ? path : undefined;
  } catch {
    return undefined;
  }
}

/**
 * Collect same-site landing path and optional referrer / UTM parameters.
 * Safe to call only in the browser.
 */
export function collectLeadFormAttribution(
  location: Pick<Location, "pathname" | "search" | "hash"> = window.location,
  documentRef: Pick<Document, "referrer"> = document
): LeadFormAttribution {
  const landingPath = `${location.pathname}${location.search}${location.hash}`;
  if (!isSafeSameSitePath(landingPath, 500)) {
    return { landingPath: "/" };
  }

  const referrerPath = documentRef.referrer
    ? sameOriginReferrerPath(documentRef.referrer)
    : undefined;

  const utm = readUtmParams(new URLSearchParams(location.search));

  return {
    landingPath,
    ...(referrerPath ? { referrerPath } : {}),
    ...utm,
  };
}
