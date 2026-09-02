/**
 * Login-identity provisioning over the Auth Admin REST API.
 *
 * This module deliberately knows NOTHING about credentials. It receives an
 * already-authorized `authorizedFetch` from `staff-invite-adapter.ts`, which
 * remains the single audited place where the service-role key is acquired. That
 * keeps the Phase 6D containment rule intact — privileged credentials have one
 * acquisition point — while still letting the delivery step be unit tested with
 * an injected fetch.
 *
 * Two calls, and both matter:
 *
 *  1. `POST /auth/v1/admin/users` with an explicit `id` — creates the login
 *     identity using the pre-allocated EMPLOYMENT id, so
 *     `profiles.id === auth.users.id` and no RLS policy or foreign key moves.
 *     The typed SDK's `AdminUserAttributes` does not expose `id`, which is why
 *     this goes over REST. Verified honoured on GoTrue v2.193.1.
 *
 *  2. `POST /auth/v1/recover` — ACTUALLY SENDS the set-password email.
 *     `admin.generateLink()` only mints a link and delivers nothing. Verified
 *     against Mailpit: createUser produced 0 messages, generateLink produced 0,
 *     and recover produced 1 ("Reset your password"). Without this step the
 *     staff member would never receive anything.
 */

export interface StaffLoginProvisionRestInput {
  readonly staffId: string;
  readonly email: string;
  readonly displayName: string;
}

/** Performs an already-authorized request against an Auth endpoint path. */
export type AuthorizedFetch = (
  path: string,
  body: Record<string, unknown>
) => Promise<{ ok: boolean; json: () => Promise<unknown>; text: () => Promise<string> }>;

export interface StaffLoginProvisionRestDeps {
  readonly authorizedFetch: AuthorizedFetch;
}

export interface StaffLoginProvisionRestResult {
  readonly userId: string;
  readonly email: string;
  /** True only when the email-delivery endpoint accepted the request. */
  readonly deliveryInvoked: boolean;
}

/** Endpoint that mints a link but sends nothing. Never used for delivery. */
export const AUTH_GENERATE_LINK_PATH = "/auth/v1/admin/generate_link";

/** Endpoint that actually delivers the set-password email. */
export const AUTH_RECOVER_PATH = "/auth/v1/recover";

export const AUTH_ADMIN_USERS_PATH = "/auth/v1/admin/users";

export async function provisionLoginIdentityViaRest(
  input: StaffLoginProvisionRestInput,
  deps: StaffLoginProvisionRestDeps
): Promise<StaffLoginProvisionRestResult> {
  const email = input.email.trim().toLowerCase();

  const createResponse = await deps.authorizedFetch(AUTH_ADMIN_USERS_PATH, {
    id: input.staffId,
    email,
    email_confirm: false,
    user_metadata: { display_name: input.displayName.trim() },
  });

  if (!createResponse.ok) {
    const detail = await createResponse.text();
    throw new Error(`Auth user provisioning failed: ${detail.slice(0, 300)}`);
  }

  const created = (await createResponse.json()) as { id?: string };
  if (!created.id) {
    throw new Error("Auth user provisioning returned no id.");
  }

  // Delivery. A failure here leaves a usable login identity behind, so the
  // caller must report that the record HAS changed and a retry only resends.
  const recoverResponse = await deps.authorizedFetch(AUTH_RECOVER_PATH, { email });

  if (!recoverResponse.ok) {
    const detail = await recoverResponse.text();
    throw new Error(
      `Login identity created but the set-password email could not be sent: ${detail.slice(0, 300)}`
    );
  }

  return { userId: created.id, email, deliveryInvoked: true };
}
