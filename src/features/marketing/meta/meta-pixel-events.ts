/**
 * Browser-side Meta events.
 *
 * EVERY FUNCTION HERE IS A NO-OP WHEN ANYTHING IS MISSING
 *
 * `fbq` is absent far more often than people expect: no pixel id configured, a
 * content blocker, a privacy-hardened browser, a corporate proxy, the script
 * still in flight when a fast typist submits. Measurement is not allowed to
 * care. Nothing in this module throws, and the caller never has to guard —
 * which is the only way a tracking call can sit inside a lead-submission
 * success path without becoming a way to lose a lead.
 */

import { META_EVENT } from "./meta-tracking-config.ts";

type Fbq = ((...args: readonly unknown[]) => void) & {
  callMethod?: (...args: readonly unknown[]) => void;
  queue?: unknown[];
  loaded?: boolean;
  version?: string;
};

declare global {
  // eslint-disable-next-line no-var
  var fbq: Fbq | undefined;
}

function getFbq(): Fbq | null {
  if (typeof window === "undefined") return null;
  const candidate = (window as { fbq?: unknown }).fbq;
  return typeof candidate === "function" ? (candidate as Fbq) : null;
}

/**
 * A Meta `eventID` for browser/server deduplication.
 *
 * Meta collapses a browser event and a server event into one conversion when
 * the event name and this id both match. It is an opaque correlation token, so
 * the only requirements are high entropy and stability across a retry of the
 * SAME submission — which is exactly what the public form's idempotency key
 * already is.
 *
 * It must never be derived from customer data. A phone number or an email hash
 * would turn a deduplication key into an identifier that follows a person
 * across events, which is precisely the matching this integration is not
 * approved to do.
 */
export function isValidMetaEventId(value: unknown): value is string {
  return (
    typeof value === "string" &&
    /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/.test(
      value
    )
  );
}

function safeTrack(eventName: string, eventId?: string): void {
  const fbq = getFbq();
  if (!fbq) return;
  try {
    if (eventId && isValidMetaEventId(eventId)) {
      fbq("track", eventName, {}, { eventID: eventId });
      return;
    }
    fbq("track", eventName);
  } catch {
    /*
     * Swallowed on purpose, and this is the load-bearing line of the module.
     * `fbq` is third-party code that can throw for reasons entirely outside
     * this application — a blocked beacon, a stubbed global injected by an
     * extension. A lead that reached the database must not be reported to the
     * customer as a failure because a marketing script had a bad day.
     */
  }
}

/**
 * PageView.
 *
 * No parameters: the URL is what a PageView is about, and Meta reads that from
 * the document itself.
 */
export function trackMetaPageView(): void {
  safeTrack(META_EVENT.pageView);
}

/**
 * Lead — ONE meaning only.
 *
 * "A real customer enquiry, submitted through the public consultation form, was
 * ACCEPTED by the backend." Not opened, not typed into, not submitted, not
 * validated: accepted and durable. Everything else would teach Meta to optimise
 * for people who start a form and leave.
 *
 * `eventId` is the same idempotency key the server sends to the Conversions
 * API, so the two arrive as one conversion rather than two.
 */
export function trackMetaLead(eventId: string): void {
  safeTrack(META_EVENT.lead, eventId);
}

/**
 * Contact — a deliberate move to a human channel.
 *
 * Browser-only by design. A WhatsApp or call tap leaves the page for another
 * application, so there is no server request to hang a Conversions API event
 * on, and nothing durable to confirm it happened. Sending one anyway would
 * mean inventing a server-side event from a click the server never saw.
 *
 * No `eventID`: with no server counterpart there is nothing to deduplicate
 * against, and a fabricated one would only add noise.
 */
export function trackMetaContact(): void {
  safeTrack(META_EVENT.contact);
}
