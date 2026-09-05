"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getSafeAdminRedirect } from "@/server/auth/authorize";
import {
  looksLikeStaffLoginPhone,
  staffLoginAuthAlias,
} from "@/features/staff-admin/contracts/staff-login-phone";

export interface LoginState {
  error?: string | null;
}

/**
 * The ONLY authentication failure message.
 *
 * It must not reveal whether the login exists, whether the password was wrong,
 * or whether access has been revoked — otherwise the form becomes an oracle for
 * enumerating staff mobile numbers.
 */
const GENERIC_ERROR = "Invalid staff credentials.";

/**
 * One identifier field, two credential paths.
 *
 * A bare 10-digit Indian mobile is a WORKFORCE STAFF login. It is the ONLY
 * identifier those staff ever see or type.
 *
 * It is not, however, what Supabase authenticates against. The Phone provider is
 * disabled and stays disabled, and a live stack answered the phone transport
 * with `422 phone_provider_disabled`, so the sign-in below uses the server-side
 * alias derived from that same number. The alias is a transport detail: it is
 * never displayed, never typed, and never treated as an email address.
 *
 * Anything else takes the existing email/password path unchanged, so the Super
 * Admin login keeps working exactly as before. There is deliberately no second
 * username field, no OTP, and no self-service reset — a Super Admin sets every
 * staff password.
 */
export async function loginAction(
  _prevState: LoginState,
  formData: FormData
): Promise<LoginState> {
  // `email` is still accepted so an older cached form post keeps working.
  const identifier = (
    (formData.get("identifier") as string | null) ??
    (formData.get("email") as string | null) ??
    ""
  ).trim();
  const password = (formData.get("password") as string | null) || "";
  const nextRaw = (formData.get("next") as string | null) || "";

  if (!identifier || !password) {
    return { error: "Enter your staff login and password." };
  }

  if (identifier.length > 254 || password.length > 128) {
    return { error: GENERIC_ERROR };
  }

  const supabase = await createClient();

  let signInFailed: boolean;

  if (looksLikeStaffLoginPhone(identifier)) {
    // Derived here, used here, and never returned to the caller. A null alias
    // means the value was not a valid staff login number after all, which is a
    // credential failure like any other — never a distinguishable error.
    const alias = staffLoginAuthAlias(identifier);
    if (!alias) {
      return { error: GENERIC_ERROR };
    }

    const { error } = await supabase.auth.signInWithPassword({
      email: alias,
      password,
    });
    signInFailed = Boolean(error);
  } else {
    const { error } = await supabase.auth.signInWithPassword({
      email: identifier.toLowerCase(),
      password,
    });
    signInFailed = Boolean(error);
  }

  if (signInFailed) {
    return { error: GENERIC_ERROR };
  }

  // A genuine sign-in just happened, so this is the ONLY place that may promote
  // credentials_ready -> active. Issuing credentials never activates anything.
  // It also reports a revoked account, which must not be able to proceed even
  // though the password was correct.
  const { data: loginRecord } = await (
    supabase as unknown as {
      rpc(fn: "record_staff_first_login"): PromiseLike<{
        data: { accessState?: string | null } | null;
        error: unknown;
      }>;
    }
  ).rpc("record_staff_first_login");

  if (loginRecord?.accessState === "revoked") {
    await supabase.auth.signOut();
    return { error: GENERIC_ERROR };
  }

  const { data: hasAccess, error: rpcError } = await supabase.rpc("authorize", {
    requested_permission: "admin.access",
  });

  if (rpcError || !hasAccess) {
    redirect("/auth/forbidden");
  }

  const target = getSafeAdminRedirect(nextRaw);
  redirect(target);
}
