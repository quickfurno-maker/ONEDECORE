import "server-only";

import { getLeadIntakeReadiness } from "../../../../../features/lead-intake/server/lead-intake-readiness.ts";

/**
 * Is the lead form worth showing right now?
 *
 * Evaluated per request in the Node runtime, never cached. Static or revalidated
 * HTML is a photograph of the past, and the incident this endpoint exists to
 * prevent was exactly that: a page that had been built while the backend was
 * healthy, served to somebody after it was not.
 *
 * The response is one boolean and a coarse state word. No mode name, no missing
 * variable, no key length, no stack. A public endpoint that narrates its own
 * misconfiguration tells an attacker which credential to hunt for.
 *
 * GET only, and it accepts nothing. It is not a second submission endpoint —
 * `POST /api/public/lead-intake` remains the only way a lead is created, and it
 * revalidates everything for itself.
 */

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

function json(status: number, body: Record<string, unknown>): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "content-type": "application/json; charset=utf-8",
      // The whole point. A cached readiness answer is the original bug.
      "cache-control": "no-store, no-cache, must-revalidate",
      pragma: "no-cache",
    },
  });
}

export async function GET(): Promise<Response> {
  const readiness = getLeadIntakeReadiness();

  /*
   * 200 either way. "The backend cannot take a lead" is a successful answer to
   * "can the backend take a lead" — a 503 here would make the browser's own
   * error handling treat a correct reply as a transport failure, and would put
   * a red line in monitoring for a system behaving exactly as configured.
   */
  return json(200, {
    available: readiness.available,
    state: readiness.state,
  });
}

const METHOD_NOT_ALLOWED = () =>
  json(405, { error: "Method not allowed." });

export const POST = METHOD_NOT_ALLOWED;
export const PUT = METHOD_NOT_ALLOWED;
export const PATCH = METHOD_NOT_ALLOWED;
export const DELETE = METHOD_NOT_ALLOWED;
