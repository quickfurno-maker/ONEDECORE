import "server-only";

import { readBoundedRequestBody } from "@/features/lead-intake/server/bounded-request-body";
import {
  readAdConsentFromHeader,
} from "@/features/marketing/meta/ad-consent";
import {
  parseWebsiteAnalyticsEvent,
  recordWebsiteAnalyticsEvent,
} from "@/features/website-analytics/server/ingest";
import { websiteAnalyticsNoContentResponse } from "@/features/website-analytics/server/analytics-http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function json(status: number, body: Record<string, unknown>): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "cache-control": "no-store",
    },
  });
}

function sameOrigin(request: Request): boolean {
  const origin = request.headers.get("origin");
  const host = request.headers.get("host");
  if (!origin || !host) return false;
  try {
    return new URL(origin).host.toLowerCase() === host.toLowerCase();
  } catch {
    return false;
  }
}

export async function POST(request: Request): Promise<Response> {
  if (!sameOrigin(request)) {
    return json(403, { ok: false, code: "ORIGIN_DENIED" });
  }
  if (readAdConsentFromHeader(request.headers.get("cookie")) !== "granted") {
    return websiteAnalyticsNoContentResponse();
  }

  const bounded = await readBoundedRequestBody(request, 8 * 1024);
  if (!bounded.ok) {
    return json(413, { ok: false, code: "BODY_TOO_LARGE" });
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(bounded.text);
  } catch {
    return json(400, { ok: false, code: "INVALID_JSON" });
  }
  const event = parseWebsiteAnalyticsEvent(parsed);
  if (!event) {
    return json(400, { ok: false, code: "INVALID_ANALYTICS_EVENT" });
  }

  const recorded = await recordWebsiteAnalyticsEvent(event);
  if (!recorded) {
    return json(503, { ok: false, code: "ANALYTICS_UNAVAILABLE" });
  }
  return json(202, { ok: true });
}

export async function GET(): Promise<Response> {
  return json(405, { ok: false, code: "METHOD_NOT_ALLOWED" });
}
