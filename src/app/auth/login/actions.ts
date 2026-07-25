"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getSafeAdminRedirect } from "@/server/auth/authorize";

export interface LoginState {
  error?: string | null;
}

export async function loginAction(
  _prevState: LoginState,
  formData: FormData
): Promise<LoginState> {
  const email = (formData.get("email") as string | null)?.trim() || "";
  const password = (formData.get("password") as string | null) || "";
  const nextRaw = (formData.get("next") as string | null) || "";

  if (!email || !password) {
    return { error: "Please enter both email address and password." };
  }

  if (email.length > 254 || password.length > 128) {
    return { error: "Invalid staff credentials." };
  }

  const supabase = await createClient();

  const { error: signInError } = await supabase.auth.signInWithPassword({
    email,
    password,
  });

  if (signInError) {
    return { error: "Invalid staff credentials. Please check your details and try again." };
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
