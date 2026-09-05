import "server-only";

import { createBearerClient, readBearerToken } from "@/lib/supabase/bearer";
import type { CrmAccessContext } from "../contracts/crm-access.ts";
import { resolveCrmAccess } from "./crm-auth.ts";
import type { CrmDb } from "./crm-db.ts";

/**
 * CRM access for a native caller presenting its own Supabase access token.
 *
 * This is the SAME resolution the browser workspace uses. The only difference is
 * where the caller comes from: cookies there, an Authorization header here.
 * After the user is identified, `resolveCrmAccess` runs the identical active-staff
 * check and the identical permission probes against a client scoped to that user,
 * so the mobile app can never see more than the same person sees on the web.
 *
 * There is no service-role path here, and adding one would defeat the point.
 */

export type CrmMobileAuth =
  | {
      readonly kind: "granted";
      readonly context: CrmAccessContext;
      readonly db: CrmDb;
    }
  | { readonly kind: "unauthenticated" }
  | { readonly kind: "inactive" }
  | { readonly kind: "denied" };

export async function resolveCrmMobileAuth(
  request: Request
): Promise<CrmMobileAuth> {
  const token = readBearerToken(request);

  if (!token) {
    return { kind: "unauthenticated" };
  }

  const db = createBearerClient(token) as unknown as CrmDb;

  /*
   * `getUser` verifies the token with the auth server rather than trusting its
   * claims locally, so a forged or expired token is rejected here and never
   * reaches a query.
   */
  const { data, error } = await db.auth.getUser();

  if (error || !data.user) {
    return { kind: "unauthenticated" };
  }

  const resolution = await resolveCrmAccess({
    db,
    staff: {
      userId: data.user.id,
      email: data.user.email ?? null,
    },
  });

  if (resolution.kind !== "granted") {
    return { kind: resolution.kind };
  }

  return {
    kind: "granted",
    context: resolution.context,
    db,
  };
}

/**
 * The stable error envelope every mobile CRM endpoint answers with.
 *
 * Categories, not messages: the mobile client branches on `error`, and nothing
 * here leaks SQL, stack traces or internal identifiers.
 */
export type CrmMobileErrorCode =
  | "unauthenticated"
  | "forbidden"
  | "invalid_request"
  | "not_found"
  | "conflict"
  | "unavailable";

const STATUS_BY_CODE: Record<CrmMobileErrorCode, number> = {
  unauthenticated: 401,
  forbidden: 403,
  invalid_request: 400,
  /*
   * Used by the single-lead reads, where an RLS-hidden lead and a lead that
   * does not exist MUST answer identically. Distinguishing them would let a
   * caller enumerate leads they cannot see.
   */
  not_found: 404,
  conflict: 409,
  unavailable: 503,
};

export function crmMobileError(
  code: CrmMobileErrorCode,
  message: string
): Response {
  return Response.json(
    { error: code, message },
    { status: STATUS_BY_CODE[code] }
  );
}

/**
 * Maps a failed auth resolution onto the shared error envelope. `inactive` and
 * `denied` both answer 403: the caller is authenticated but not entitled, and
 * distinguishing the two would tell an unauthorised caller why.
 */
export function crmMobileAuthError(
  kind: "unauthenticated" | "inactive" | "denied"
): Response {
  if (kind === "unauthenticated") {
    return crmMobileError(
      "unauthenticated",
      "Sign in again to continue."
    );
  }

  return crmMobileError(
    "forbidden",
    "Your account is not authorized for the CRM workspace."
  );
}
