import "server-only";

import { META_EVENT } from "../meta-tracking-config.ts";
import {
  getMetaCapiConfig,
  META_CAPI_TIMEOUT_MS,
  type MetaCapiConfig,
} from "./meta-capi-env.ts";
import {
  buildUserSignals,
  type MetaCapiUserSignals,
} from "./meta-capi-signals.ts";

/**
 * The Conversions API transport.
 *
 * THE ONLY RULE THAT MATTERS HERE
 *
 * Nothing in this file may cause a lead to fail. Every path returns a result
 * object; none throws, none rejects, and the caller is expected to ignore the
 * return value entirely in production. The classification exists for tests and
 * for a sanitized log line, not for control flow.
 */

export interface MetaCapiEvent {
  readonly event_name: string;
  readonly event_time: number;
  readonly event_id: string;
  readonly event_source_url: string;
  readonly action_source: "website";
  readonly user_data: MetaCapiUserSignals;
}

export type MetaCapiResult =
  | { readonly status: "sent"; readonly eventsReceived: number }
  | { readonly status: "not-configured" }
  | { readonly status: "skipped"; readonly reason: string }
  | { readonly status: "rejected"; readonly httpStatus: number }
  | { readonly status: "failed"; readonly reason: "timeout" | "network" | "malformed" };

/**
 * `event_time` in whole seconds.
 *
 * Meta rejects events more than seven days old and anything in the future.
 * Milliseconds are the classic mistake: the value is accepted syntactically and
 * lands decades ahead, so every conversion is dropped and nothing says why.
 */
export function toEventTimeSeconds(nowMs: number): number {
  return Math.floor(nowMs / 1000);
}

export function buildLeadEvent(input: {
  readonly eventId: string;
  readonly eventSourceUrl: string;
  readonly nowMs: number;
  readonly clientIp: string | null;
  readonly userAgent: string | null;
  readonly fbc: string | null;
  readonly fbp: string | null;
}): MetaCapiEvent {
  return {
    event_name: META_EVENT.lead,
    event_time: toEventTimeSeconds(input.nowMs),
    event_id: input.eventId,
    event_source_url: input.eventSourceUrl,
    action_source: "website",
    user_data: buildUserSignals({
      clientIp: input.clientIp,
      userAgent: input.userAgent,
      fbc: input.fbc,
      fbp: input.fbp,
    }),
  };
}

/** The Graph endpoint for a dataset. The token never appears in the URL. */
export function buildCapiEndpoint(config: MetaCapiConfig): string {
  return `https://graph.facebook.com/${config.graphVersion}/${config.pixelId}/events`;
}

interface CapiResponseBody {
  readonly events_received?: number;
}

/**
 * Post one event, best effort.
 *
 * The token goes in the BODY, not the query string. Both are accepted by Meta;
 * only one of them stays out of proxy logs, error messages that echo a URL, and
 * anything that captures the request line.
 */
export async function sendMetaCapiEvent(
  event: MetaCapiEvent,
  options?: {
    readonly config?: MetaCapiConfig | null;
    readonly fetchImpl?: typeof fetch;
    readonly timeoutMs?: number;
  }
): Promise<MetaCapiResult> {
  const config =
    options?.config === undefined ? getMetaCapiConfig() : options.config;
  if (!config) return { status: "not-configured" };

  const fetchImpl = options?.fetchImpl ?? fetch;
  const timeoutMs = options?.timeoutMs ?? META_CAPI_TIMEOUT_MS;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetchImpl(buildCapiEndpoint(config), {
      method: "POST",
      headers: {
        "content-type": "application/json; charset=utf-8",
        accept: "application/json",
      },
      body: JSON.stringify({
        data: [event],
        access_token: config.accessToken,
        ...(config.testEventCode
          ? { test_event_code: config.testEventCode }
          : {}),
      }),
      signal: controller.signal,
      // Analytics must never be served from, or written into, a cache.
      cache: "no-store",
    });

    if (!response.ok) {
      /*
       * The body is deliberately not read. Meta's error payloads echo request
       * context, and this result is destined for a log line — the status code
       * is the whole of what an operator can act on anyway.
       */
      return { status: "rejected", httpStatus: response.status };
    }

    const text = await response.text();
    try {
      const parsed = JSON.parse(text) as CapiResponseBody;
      const received =
        typeof parsed.events_received === "number" ? parsed.events_received : 0;
      return { status: "sent", eventsReceived: received };
    } catch {
      return { status: "failed", reason: "malformed" };
    }
  } catch (error) {
    if (error instanceof Error && error.name === "AbortError") {
      return { status: "failed", reason: "timeout" };
    }
    return { status: "failed", reason: "network" };
  } finally {
    clearTimeout(timer);
  }
}

/**
 * What may be written to the log about a conversion report.
 *
 * Structured, bounded, and containing none of the event: no IP, no user agent,
 * no cookie value, no event id, and above all no token. An operator needs to
 * know that reporting is healthy, which is a status and a count.
 */
export function safeMetaCapiLog(result: MetaCapiResult): Record<string, unknown> {
  switch (result.status) {
    case "sent":
      return { meta: "sent", eventsReceived: result.eventsReceived };
    case "rejected":
      return { meta: "rejected", httpStatus: result.httpStatus };
    case "failed":
      return { meta: "failed", reason: result.reason };
    case "skipped":
      return { meta: "skipped", reason: result.reason };
    default:
      return { meta: "not-configured" };
  }
}
