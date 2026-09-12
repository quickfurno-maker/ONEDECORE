import "server-only";

import { isValidMetaEventId } from "../meta-pixel-events.ts";
import { getMetaCapiConfig } from "./meta-capi-env.ts";
import {
  buildLeadEvent,
  sendMetaCapiEvent,
  type MetaCapiResult,
} from "./meta-capi-client.ts";
import {
  buildEventSourceUrl,
  deriveFbc,
  readCookie,
  readFbp,
  resolveClientIp,
  resolveUserAgent,
} from "./meta-capi-signals.ts";

/**
 * Report an ACCEPTED lead to the Conversions API.
 *
 * WHERE THIS SITS IN THE REQUEST
 *
 * After the lead is durable and before the response is written. That ordering
 * is the point: a conversion must never be reported for a lead that was
 * rejected, rate-limited or lost, and the only moment the server knows a lead
 * is real is after persistence returned success.
 *
 * WHY IT IS AWAITED AT ALL
 *
 * Next's `after()` exists and would be the tidier home for this, but its
 * behaviour under this deployment's long-lived Node server is not something to
 * take on trust for a path that must never affect a lead. A bounded await with
 * a 1.5s ceiling is the conservative choice: the worst case is a response that
 * is 1.5s slower, and the failure mode is a missing conversion rather than a
 * lost enquiry. If `after()` is adopted later this function does not change —
 * only its call site does.
 *
 * IT CANNOT THROW
 *
 * Every branch returns a result. The caller is free to ignore it, and does.
 */
export async function reportLeadConversion(
  input: {
    /** The validated idempotency key, reused as Meta's dedup `event_id`. */
    readonly eventId: string | null;
    /** Raw `Cookie:` header from the incoming request. */
    readonly cookieHeader: string | null;
    readonly userAgent: string | null;
    readonly forwardedFor: string | null;
    /** Whether this deployment trusts forwarded client addresses. */
    readonly trustProxy: boolean;
    /** Same-site path the form was submitted from, for `event_source_url`. */
    readonly landingPath: string | null;
    /** `fbclid` as captured by the form, used only to derive `fbc`. */
    readonly fbclid: string | null;
  },
  deps?: {
    readonly now?: () => number;
    readonly send?: typeof sendMetaCapiEvent;
    readonly getConfig?: typeof getMetaCapiConfig;
  }
): Promise<MetaCapiResult> {
  try {
    const config = (deps?.getConfig ?? getMetaCapiConfig)();
    if (!config) return { status: "not-configured" };

    /*
     * No event id, no event.
     *
     * Sending one without a dedup key would double-count every lead that also
     * fired in the browser, and inventing one here would guarantee it — the
     * browser and the server would each mint their own. Skipping is the only
     * outcome that leaves the numbers honest.
     */
    if (!isValidMetaEventId(input.eventId)) {
      return { status: "skipped", reason: "missing-event-id" };
    }

    const nowMs = (deps?.now ?? Date.now)();

    const event = buildLeadEvent({
      eventId: input.eventId,
      eventSourceUrl: buildEventSourceUrl(input.landingPath),
      nowMs,
      clientIp: resolveClientIp({
        forwardedFor: input.forwardedFor,
        trustProxy: input.trustProxy,
      }),
      userAgent: resolveUserAgent(input.userAgent),
      fbc: deriveFbc(
        readCookie(input.cookieHeader, "_fbc"),
        input.fbclid,
        Math.floor(nowMs / 1000)
      ),
      fbp: readFbp(readCookie(input.cookieHeader, "_fbp")),
    });

    return await (deps?.send ?? sendMetaCapiEvent)(event, { config });
  } catch {
    /*
     * Nothing above is expected to throw — every helper is total — but this
     * function's contract to the lead pipeline is that it cannot. A guarantee
     * that depends on the current implementation of five other modules is not
     * a guarantee.
     */
    return { status: "failed", reason: "network" };
  }
}
