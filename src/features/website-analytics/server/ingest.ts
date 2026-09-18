import "server-only";

import { createAdminClient } from "../../../lib/supabase/admin.ts";
import { AD_CONSENT_VERSION } from "../../marketing/meta/ad-consent.ts";
import { isMetaTrackablePath } from "../../marketing/meta/meta-tracking-config.ts";
import {
  WEBSITE_ANALYTICS_SOURCE_KEYS,
  type WebsiteAnalyticsSourceKey,
} from "../source-resolution.ts";
import { WEBSITE_ANALYTICS_EVENT_TYPES } from "../client/website-analytics-client.ts";

const UUID =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const HOST = /^(?=.{1,253}$)(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)*[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/i;

export interface WebsiteAnalyticsEventInput {
  readonly visitorId: string;
  readonly sessionId: string;
  readonly eventId: string;
  readonly consentVersion: string;
  readonly eventType: (typeof WEBSITE_ANALYTICS_EVENT_TYPES)[number];
  readonly path: string;
  readonly actionKey: string | null;
  readonly occurredAt: string;
  readonly landingPath: string;
  readonly referrerHost: string | null;
  readonly sourceKey: WebsiteAnalyticsSourceKey;
  readonly medium: string | null;
  readonly utmCampaign: string | null;
  readonly utmContent: string | null;
  readonly utmTerm: string | null;
  readonly hasMetaClick: boolean;
  readonly hasGoogleClick: boolean;
}

const KEYS = new Set([
  "visitorId", "sessionId", "eventId", "consentVersion", "eventType",
  "path", "actionKey", "occurredAt", "landingPath", "referrerHost",
  "sourceKey", "medium", "utmCampaign", "utmContent", "utmTerm",
  "hasMetaClick", "hasGoogleClick",
]);

function optionalText(
  value: unknown,
  max: number
): string | null | undefined {
  if (value === null || value === undefined) return null;
  if (typeof value !== "string") return undefined;
  const trimmed = value.trim();
  if (!trimmed || trimmed.length > max || /[\u0000-\u001f\u007f]/.test(trimmed)) {
    return undefined;
  }
  return trimmed;
}

export function parseWebsiteAnalyticsEvent(
  raw: unknown
): WebsiteAnalyticsEventInput | null {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
  const input = raw as Record<string, unknown>;
  if (Object.keys(input).some((key) => !KEYS.has(key))) return null;

  const visitorId = input.visitorId;
  const sessionId = input.sessionId;
  const eventId = input.eventId;
  if (
    typeof visitorId !== "string" || !UUID.test(visitorId) ||
    typeof sessionId !== "string" || !UUID.test(sessionId) ||
    typeof eventId !== "string" || !UUID.test(eventId)
  ) return null;

  if (input.consentVersion !== AD_CONSENT_VERSION) return null;
  if (
    typeof input.eventType !== "string" ||
    !(WEBSITE_ANALYTICS_EVENT_TYPES as readonly string[]).includes(input.eventType)
  ) return null;

  const path = optionalText(input.path, 500);
  const landingPath = optionalText(input.landingPath, 500);
  if (!path || !landingPath || !isMetaTrackablePath(path) || !isMetaTrackablePath(landingPath)) {
    return null;
  }

  const sourceKey = input.sourceKey;
  if (
    typeof sourceKey !== "string" ||
    !(WEBSITE_ANALYTICS_SOURCE_KEYS as readonly string[]).includes(sourceKey)
  ) return null;

  const referrerHost = optionalText(input.referrerHost, 253);
  if (input.referrerHost != null && (!referrerHost || !HOST.test(referrerHost))) return null;
  const actionKey = optionalText(input.actionKey, 120);
  if (input.actionKey != null && actionKey === undefined) return null;
  const medium = optionalText(input.medium, 80);
  const utmCampaign = optionalText(input.utmCampaign, 200);
  const utmContent = optionalText(input.utmContent, 200);
  const utmTerm = optionalText(input.utmTerm, 200);
  if (
    (input.medium != null && medium === undefined) ||
    (input.utmCampaign != null && utmCampaign === undefined) ||
    (input.utmContent != null && utmContent === undefined) ||
    (input.utmTerm != null && utmTerm === undefined)
  ) return null;

  if (typeof input.occurredAt !== "string" || Number.isNaN(Date.parse(input.occurredAt))) {
    return null;
  }
  if (typeof input.hasMetaClick !== "boolean" || typeof input.hasGoogleClick !== "boolean") {
    return null;
  }

  return {
    visitorId, sessionId, eventId,
    consentVersion: AD_CONSENT_VERSION,
    eventType: input.eventType as WebsiteAnalyticsEventInput["eventType"],
    path, actionKey: actionKey ?? null,
    occurredAt: input.occurredAt,
    landingPath,
    referrerHost: referrerHost ?? null,
    sourceKey: sourceKey as WebsiteAnalyticsSourceKey,
    medium: medium ?? null,
    utmCampaign: utmCampaign ?? null,
    utmContent: utmContent ?? null,
    utmTerm: utmTerm ?? null,
    hasMetaClick: input.hasMetaClick,
    hasGoogleClick: input.hasGoogleClick,
  };
}

export async function recordWebsiteAnalyticsEvent(
  input: WebsiteAnalyticsEventInput
): Promise<boolean> {
  const admin = createAdminClient();
  const { error } = await admin.rpc("record_website_analytics_event", {
    p_visitor_id: input.visitorId,
    p_session_id: input.sessionId,
    p_event_id: input.eventId,
    p_consent_version: input.consentVersion,
    p_event_type: input.eventType,
    p_path: input.path,
    p_action_key: input.actionKey ?? undefined,
    p_occurred_at: input.occurredAt,
    p_landing_path: input.landingPath,
    p_referrer_host: input.referrerHost ?? undefined,
    p_source_key: input.sourceKey,
    p_medium: input.medium ?? undefined,
    p_utm_campaign: input.utmCampaign ?? undefined,
    p_utm_content: input.utmContent ?? undefined,
    p_utm_term: input.utmTerm ?? undefined,
    p_has_meta_click: input.hasMetaClick,
    p_has_google_click: input.hasGoogleClick,
  });
  return !error;
}
