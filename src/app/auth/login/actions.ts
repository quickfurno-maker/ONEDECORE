"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getSafeAdminRedirect } from "@/server/auth/authorize";
import {
  looksLikeStaffLoginPhone,
  normalizeStaffLoginPhone,
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
 * A bare 10-digit Indian mobile is a WORKFORCE STAFF login and is normalized to
 * +91XXXXXXXXXX before it reaches Supabase Auth — verified on a live GoTrue
 * stack, where the un-normalized 10-digit value is rejected outright.
 *
 * Anything else takes the existing email/password path unchanged, so the Super
 * Admin login keeps working exactly as before. There is deliberately no second
 * username field: the future self-service OTP reset uses this same canonical
 * phone identity.
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
    const phone = normalizeStaffLoginPhone(identifier);
    if (!phone.ok) {
      return { error: GENERIC_ERROR };
    }

    const { error } = await supabase.auth.signInWithPassword({
      phone: phone.e164,
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
