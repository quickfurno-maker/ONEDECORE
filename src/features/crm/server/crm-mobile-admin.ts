import "server-only";

import { isUuid } from "../contracts/assignment-contracts.ts";
import { CrmError } from "./crm-errors.ts";
import { crmMobileError, type CrmMobileErrorCode } from "./crm-mobile-auth.ts";

/**
 * The shared translation layer between the canonical CRM admin services and the
 * mobile HTTP boundary.
 *
 * CRM-M9A adds no admin rules. Every route under `/api/mobile/crm/admin` runs
 * the same permission assertion, the same validator and the same RPC the web
 * workspace runs, then answers with the mobile error envelope. That leaves
 * exactly one thing for this module to own: turning a `CrmError` into a status
 * code without letting anything internal escape with it.
 *
 * WHY `details` IS NEVER READ HERE
 *
 * `crmErrorFromPostgresMessage` keeps the raw Postgres text in `details` and
 * puts a written, user-safe sentence in `message`. Its fallback branch says
 * only "CRM operation failed". So `message` is safe to forward and `details`
 * never is — it can name columns, policies, constraints and grants. Nothing
 * below reads it, and nothing downstream should start.
 */

/**
 * Maps the canonical HTTP status a `CrmError` already carries onto the mobile
 * error vocabulary.
 *
 * The statuses are decided by the canonical layer — `422` by the contract
 * validators, `409` by the revision-mismatch and stale-revision branches, `404`
 * by the not-found branches. This is a translation, not a second opinion: a
 * status this table does not recognise degrades to `unavailable` rather than
 * being guessed at.
 */
function mobileCodeForHttpStatus(status: number): CrmMobileErrorCode {
  switch (status) {
    case 401:
      return "unauthenticated";
    case 403:
      return "forbidden";
    case 404:
      return "not_found";
    case 409:
      return "conflict";
    case 400:
    case 422:
      return "invalid_request";
    default:
      return "unavailable";
  }
}

/**
 * Answers a failed canonical call.
 *
 * A `CrmError` below 500 carries a message written for a person — the
 * validation sentences in the contracts, "This target was updated elsewhere",
 * "Import batch not found" — so it is forwarded verbatim. At 500 and above, and
 * for anything that is not a `CrmError` at all, the message is replaced with a
 * fixed sentence: a thrown PostgrestError or a TypeError has no user-safe text
 * to forward, and its `message` would be exactly the internal detail this
 * boundary exists to withhold.
 *
 * The raw error is logged, never returned. `label` identifies the route; the
 * bearer token is not part of it and is never logged anywhere in this slice.
 */
export function crmMobileAdminFailure(error: unknown, label: string): Response {
  if (error instanceof CrmError && error.httpStatus < 500) {
    return crmMobileError(mobileCodeForHttpStatus(error.httpStatus), error.message);
  }

  console.error(`[mobile/crm/admin] ${label}`, error);

  return crmMobileError(
    "unavailable",
    "This CRM admin action is unavailable right now. Try again."
  );
}

/**
 * Reads a JSON request body.
 *
 * A body that is not a JSON object is refused as `invalid_request` rather than
 * coerced: `null`, an array and a bare string would all otherwise reach the
 * action dispatch as something with no `action` property, and the resulting
 * "unknown action" answer would describe the wrong mistake.
 */
export async function readCrmMobileJsonObject(
  request: Request
): Promise<Record<string, unknown> | null> {
  let parsed: unknown;

  try {
    parsed = await request.json();
  } catch {
    return null;
  }

  if (parsed === null || typeof parsed !== "object" || Array.isArray(parsed)) {
    return null;
  }

  return parsed as Record<string, unknown>;
}

export const CRM_MOBILE_INVALID_JSON_BODY = "Send a JSON object body.";

/**
 * Whether a path segment is shaped like an admin resource id, checked BEFORE
 * any query runs.
 *
 * Postgres rejects a malformed uuid with `22P02`, which would surface through
 * the mapper above as an opaque 503 and turn a client mistake into a reported
 * server fault. Guarding first also means a probe with a junk id never reaches
 * a query at all.
 *
 * This is the canonical `isUuid` from the assignment contracts, re-exported
 * rather than re-implemented — a second copy of this regex would drift, and the
 * looser copy would become the way in.
 */
export function isCrmMobileAdminId(value: string | null | undefined): boolean {
  return typeof value === "string" && isUuid(value.trim());
}

/** Reads a required string field from a parsed JSON action payload. */
export function readStringField(
  body: Record<string, unknown>,
  field: string
): string | null {
  const value = body[field];
  return typeof value === "string" ? value : null;
}

/**
 * Reads an OPTIONAL text field, distinguishing "not given" from "given wrong".
 *
 * Absent, `null` and empty all mean the same thing — no value — and normalise
 * to `null`. Anything present that is not a string returns `false`, and the
 * caller refuses the request.
 *
 * The distinction matters on a rule filter. A non-string `serviceCode` quietly
 * turned into `null` would not be a narrower rule, it would be a WIDER one: a
 * rule meant to match a single service becomes a rule matching every service.
 * Refusing is the only direction that cannot silently grant more than was asked
 * for. Whether a given string is an ALLOWED code is not decided here — that is
 * the canonical validator's job, and it rejects unknown codes rather than
 * dropping them.
 */
export function readOptionalText(
  body: Record<string, unknown>,
  field: string
): string | null | false {
  const value = body[field];

  if (value === undefined || value === null) {
    return null;
  }

  if (typeof value !== "string") {
    return false;
  }

  const trimmed = value.trim();
  return trimmed.length === 0 ? null : trimmed;
}

/**
 * Reads a required integer field.
 *
 * `expectedRevision` travels through here, and it must be preserved EXACTLY:
 * a coerced or defaulted revision would defeat the optimistic-concurrency check
 * it exists to perform. A missing or non-integer value is refused, never
 * replaced with a guess.
 */
export function readIntegerField(
  body: Record<string, unknown>,
  field: string
): number | null {
  const value = body[field];
  return typeof value === "number" && Number.isInteger(value) ? value : null;
}
