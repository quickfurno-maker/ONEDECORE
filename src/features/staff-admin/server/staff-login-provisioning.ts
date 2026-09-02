/**
 * Login-identity provisioning over the Auth Admin REST API.
 *
 * This module deliberately knows NOTHING about credentials. It receives an
 * already-authorized `authorizedRequest` from `staff-invite-adapter.ts`, which
 * remains the single audited place where the service-role key is acquired, so
 * the Phase 6D containment rule stays intact.
 *
 * Activation is RETRY-SAFE. Partial activation is a real state: the identity can
 * be created and then the setup email fail to send. Blindly re-creating on retry
 * fails with 422 `email_exists`, so the identity is looked up FIRST and creation
 * is skipped when it already exists.
 *
 *   no identity            -> create with the exact employment id, then send
 *   identity, same email   -> RESEND only, never recreate
 *   identity, other email  -> identity conflict, fail closed
 *
 * Delivery uses `POST /auth/v1/recover`. `admin.generateLink()` mints a link and
 * delivers nothing — verified against Mailpit on GoTrue v2.193.1, where
 * createUser produced 0 messages, generateLink 0, and recover 1.
 */

export interface StaffLoginProvisionRestInput {
  readonly staffId: string;
  readonly email: string;
  readonly displayName: string;
}

export interface AuthorizedResponse {
  readonly ok: boolean;
  readonly status: number;
  json(): Promise<unknown>;
  text(): Promise<string>;
}

/** Performs an already-authorized request against an Auth endpoint path. */
export type AuthorizedRequest = (
  path: string,
  init: { readonly method: "GET" | "POST"; readonly body?: Record<string, unknown> }
) => Promise<AuthorizedResponse>;

export interface StaffLoginProvisionRestDeps {
  readonly authorizedRequest: AuthorizedRequest;
}

export interface StaffLoginProvisionRestResult {
  readonly userId: string;
  readonly email: string;
  /** True only when the email-delivery endpoint accepted the request. */
  readonly deliveryInvoked: boolean;
  /** False when an existing identity was reused, i.e. this was a resend. */
  readonly identityCreated: boolean;
}

/** Endpoint that mints a link but sends nothing. Never used for delivery. */
export const AUTH_GENERATE_LINK_PATH = "/auth/v1/admin/generate_link";

/** Endpoint that actually delivers the set-password email. */
export const AUTH_RECOVER_PATH = "/auth/v1/recover";

export const AUTH_ADMIN_USERS_PATH = "/auth/v1/admin/users";

/** Raised when an existing Auth identity does not match the employment record. */
export class StaffIdentityConflictError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "StaffIdentityConflictError";
  }
}

interface AuthUserShape {
  readonly id?: string;
  readonly email?: string | null;
  readonly last_sign_in_at?: string | null;
}

export async function provisionLoginIdentityViaRest(
  input: StaffLoginProvisionRestInput,
  deps: StaffLoginProvisionRestDeps
): Promise<StaffLoginProvisionRestResult> {
  const email = input.email.trim().toLowerCase();

  // 1. Look the identity up before deciding whether creation is required.
  const lookup = await deps.authorizedRequest(
    `${AUTH_ADMIN_USERS_PATH}/${input.staffId}`,
    { method: "GET" }
  );

  let existing: AuthUserShape | null = null;
  if (lookup.ok) {
    existing = (await lookup.json()) as AuthUserShape;
  } else if (lookup.status !== 404) {
    const detail = await lookup.text();
    throw new Error(`Auth identity lookup failed: ${detail.slice(0, 300)}`);
  }

  if (existing?.id && existing.id !== input.staffId) {
    throw new StaffIdentityConflictError(
      "The existing login identity does not match this employment record."
    );
  }

  if (existing && (existing.email ?? "").toLowerCase() !== email) {
    throw new StaffIdentityConflictError(
      "A login identity already exists for this employee under a different email address."
    );
  }

  // 2. Create only when there is nothing to reuse.
  let identityCreated = false;
  if (!existing) {
    const createResponse = await deps.authorizedRequest(AUTH_ADMIN_USERS_PATH, {
      method: "POST",
      body: {
        id: input.staffId,
        email,
        email_confirm: false,
        user_metadata: { display_name: input.displayName.trim() },
      },
    });

    if (!createResponse.ok) {
      const detail = await createResponse.text();
      throw new Error(`Auth user provisioning failed: ${detail.slice(0, 300)}`);
    }

    const created = (await createResponse.json()) as AuthUserShape;
    if (!created.id) {
      throw new Error("Auth user provisioning returned no id.");
    }
    if (created.id !== input.staffId) {
      throw new StaffIdentityConflictError(
        "Auth provider did not honour the requested user id."
      );
    }
    identityCreated = true;
  }

  // 3. Always send. This is the step that previously failed silently, and it is
  //    also the whole point of a resend.
  const recoverResponse = await deps.authorizedRequest(AUTH_RECOVER_PATH, {
    method: "POST",
    body: { email },
  });

  if (!recoverResponse.ok) {
    const detail = await recoverResponse.text();
    throw new Error(
      `Login identity is available but the set-password email could not be sent: ${detail.slice(0, 300)}`
    );
  }

  return { userId: input.staffId, email, deliveryInvoked: true, identityCreated };
}
