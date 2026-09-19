import {
  crmMobileAuthError,
  crmMobileError,
  resolveCrmMobileAuth,
} from "@/features/crm/server/crm-mobile-auth";
import { ONEDECORE_EAS_PROJECT_ID } from "@/features/notifications/server/enquiry-push";
import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

const EXPO_TOKEN_RE =
  /^(ExponentPushToken|ExpoPushToken)\[[A-Za-z0-9_-]+\]$/;
const MAX_BODY_BYTES = 4_096;

type PushTokenPayload = {
  readonly token: string;
  readonly platform: "android" | "ios";
};

function isPushTokenPayload(value: unknown): value is PushTokenPayload {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return false;
  }

  const row = value as Record<string, unknown>;
  return (
    typeof row.token === "string" &&
    EXPO_TOKEN_RE.test(row.token) &&
    (row.platform === "android" || row.platform === "ios")
  );
}

async function readPayload(
  request: Request
): Promise<PushTokenPayload | null> {
  const raw = await request.text();
  if (Buffer.byteLength(raw, "utf8") > MAX_BODY_BYTES) return null;

  try {
    const parsed = JSON.parse(raw) as unknown;
    return isPushTokenPayload(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

type OwnerAuthorization =
  | { readonly kind: "granted"; readonly userId: string }
  | { readonly kind: "denied"; readonly response: Response };

async function authorizeOwner(
  request: Request
): Promise<OwnerAuthorization> {
  const auth = await resolveCrmMobileAuth(request);

  if (auth.kind !== "granted") {
    return { kind: "denied", response: crmMobileAuthError(auth.kind) };
  }

  // This canonical permission is intentionally owner-only in CRM access.
  if (!auth.context.canDeleteLeads) {
    return {
      kind: "denied",
      response: crmMobileError(
        "forbidden",
        "Only the owner account may register enquiry notifications."
      ),
    };
  }

  return { kind: "granted", userId: auth.context.userId };
}

export async function POST(request: Request): Promise<Response> {
  const owner = await authorizeOwner(request);
  if (owner.kind === "denied") return owner.response;

  const payload = await readPayload(request);
  if (!payload) {
    return crmMobileError(
      "invalid_request",
      "Provide a valid Expo push token and platform."
    );
  }

  try {
    const admin = createAdminClient();
    const now = new Date().toISOString();

    const { error } = await admin
      .from("mobile_push_tokens" as never)
      .upsert(
        {
          user_id: owner.userId,
          expo_push_token: payload.token,
          platform: payload.platform,
          project_id: ONEDECORE_EAS_PROJECT_ID,
          enabled: true,
          disabled_at: null,
          last_error_code: null,
          last_registered_at: now,
          updated_at: now,
        } as never,
        { onConflict: "expo_push_token" } as never
      );

    if (error) throw error;

    return Response.json({ ok: true });
  } catch {
    return crmMobileError(
      "unavailable",
      "Notification registration is unavailable right now."
    );
  }
}

export async function DELETE(request: Request): Promise<Response> {
  const owner = await authorizeOwner(request);
  if (owner.kind === "denied") return owner.response;

  const payload = await readPayload(request);
  if (!payload) {
    return crmMobileError(
      "invalid_request",
      "Provide a valid Expo push token and platform."
    );
  }

  try {
    const admin = createAdminClient();
    const now = new Date().toISOString();

    const { error } = await admin
      .from("mobile_push_tokens" as never)
      .update(
        {
          enabled: false,
          disabled_at: now,
          updated_at: now,
        } as never
      )
      .eq("user_id", owner.userId)
      .eq("expo_push_token", payload.token);

    if (error) throw error;

    return Response.json({ ok: true });
  } catch {
    return crmMobileError(
      "unavailable",
      "Notification registration is unavailable right now."
    );
  }
}

