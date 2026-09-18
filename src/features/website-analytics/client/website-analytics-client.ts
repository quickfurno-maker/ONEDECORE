"use client";

import {
  AD_CONSENT_VERSION,
  readAdConsent,
} from "../../marketing/meta/ad-consent.ts";
import {
  resolveWebsiteTrafficSource,
  type ResolvedWebsiteTrafficSource,
} from "../source-resolution.ts";

const VISITOR_KEY = "onedecore_analytics_visitor";
const SESSION_KEY = "onedecore_analytics_session";
const ATTRIBUTION_KEY = "onedecore_analytics_attribution";

export const WEBSITE_ANALYTICS_EVENT_TYPES = [
  "page_view",
  "cta_click",
  "contact_whatsapp",
  "contact_phone",
  "lead_form_start",
  "lead_form_submit",
  "lead_submit_success",
] as const;

export type WebsiteAnalyticsEventType =
  (typeof WEBSITE_ANALYTICS_EVENT_TYPES)[number];

interface StoredAttribution extends ResolvedWebsiteTrafficSource {
  readonly landingPath: string;
}

function safeStorage(kind: "local" | "session"): Storage | null {
  if (typeof window === "undefined") return null;
  try {
    return kind === "local" ? window.localStorage : window.sessionStorage;
  } catch {
    return null;
  }
}

function validUuid(value: string | null): value is string {
  return Boolean(
    value &&
      /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
        value
      )
  );
}

function getOrCreateUuid(storage: Storage | null, key: string): string | null {
  if (!storage || typeof crypto === "undefined" || !crypto.randomUUID) return null;
  const existing = storage.getItem(key);
  if (validUuid(existing)) return existing;
  const created = crypto.randomUUID();
  storage.setItem(key, created);
  return created;
}

function externalReferrerHost(): string | null {
  if (typeof document === "undefined" || typeof location === "undefined") return null;
  if (!document.referrer) return null;
  try {
    const ref = new URL(document.referrer);
    return ref.origin === location.origin
      ? null
      : ref.hostname.toLowerCase().slice(0, 253);
  } catch {
    return null;
  }
}

function currentPath(): string {
  if (typeof location === "undefined") return "/";
  // Keep analytics PII-free: campaign/query values are captured only through
  // the bounded attribution fields below, never copied wholesale from the URL.
  return location.pathname.slice(0, 500) || "/";
}

function buildInitialAttribution(): StoredAttribution {
  const params =
    typeof location === "undefined"
      ? new URLSearchParams()
      : new URLSearchParams(location.search);
  return {
    landingPath: currentPath(),
    ...resolveWebsiteTrafficSource({
      utmSource: params.get("utm_source"),
      utmMedium: params.get("utm_medium"),
      utmCampaign: params.get("utm_campaign"),
      utmContent: params.get("utm_content"),
      utmTerm: params.get("utm_term"),
      fbclid: params.get("fbclid"),
      gclid: params.get("gclid"),
      wbraid: params.get("wbraid"),
      gbraid: params.get("gbraid"),
      referrerHost: externalReferrerHost(),
    }),
  };
}

function getOrCreateAttribution(storage: Storage | null): StoredAttribution {
  if (storage) {
    try {
      const parsed = JSON.parse(
        storage.getItem(ATTRIBUTION_KEY) ?? "null"
      ) as StoredAttribution | null;
      if (
        parsed &&
        typeof parsed.landingPath === "string" &&
        typeof parsed.sourceKey === "string"
      ) {
        return parsed;
      }
    } catch {
      // Fall through to a fresh first-touch snapshot.
    }
  }

  const created = buildInitialAttribution();
  try {
    storage?.setItem(ATTRIBUTION_KEY, JSON.stringify(created));
  } catch {
    // Analytics remains best-effort when browser storage is unavailable.
  }
  return created;
}

export function clearWebsiteAnalyticsBrowserState(): void {
  try {
    safeStorage("local")?.removeItem(VISITOR_KEY);
    const session = safeStorage("session");
    session?.removeItem(SESSION_KEY);
    session?.removeItem(ATTRIBUTION_KEY);
  } catch {
    // Withdrawal must not break the page.
  }
}

export function getCurrentWebsiteAnalyticsSessionId(): string | null {
  if (readAdConsent() !== "granted") return null;
  const existing = safeStorage("session")?.getItem(SESSION_KEY) ?? null;
  return validUuid(existing) ? existing : null;
}

export async function trackWebsiteAnalyticsEvent(
  eventType: WebsiteAnalyticsEventType,
  actionKey: string | null = null
): Promise<void> {
  if (typeof window === "undefined" || readAdConsent() !== "granted") return;

  const visitorId = getOrCreateUuid(safeStorage("local"), VISITOR_KEY);
  const sessionStorage = safeStorage("session");
  const sessionId = getOrCreateUuid(sessionStorage, SESSION_KEY);
  if (
    !visitorId ||
    !sessionId ||
    typeof crypto === "undefined" ||
    !crypto.randomUUID
  ) {
    return;
  }

  const attribution = getOrCreateAttribution(sessionStorage);
  const body = {
    visitorId,
    sessionId,
    eventId: crypto.randomUUID(),
    consentVersion: AD_CONSENT_VERSION,
    eventType,
    path: currentPath(),
    actionKey: actionKey?.slice(0, 120) ?? null,
    occurredAt: new Date().toISOString(),
    landingPath: attribution.landingPath,
    referrerHost: attribution.referrerHost,
    sourceKey: attribution.sourceKey,
    medium: attribution.medium,
    utmCampaign: attribution.campaign,
    utmContent: attribution.content,
    utmTerm: attribution.term,
    hasMetaClick: attribution.hasMetaClick,
    hasGoogleClick: attribution.hasGoogleClick,
  };

  try {
    await fetch("/api/public/analytics/event", {
      method: "POST",
      headers: { "content-type": "application/json" },
      credentials: "same-origin",
      keepalive: true,
      cache: "no-store",
      body: JSON.stringify(body),
    });
  } catch {
    // Measurement must never affect the customer journey.
  }
}
