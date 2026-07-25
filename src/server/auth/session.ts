import { createClient } from "@/lib/supabase/server";

export interface StaffUserSession {
  userId: string;
  email: string | null;
}

/**
 * Retrieves verified staff claims from Supabase Auth.
 * Never relies on unverified getSession() calls.
 */
export async function getStaffClaims(): Promise<StaffUserSession | null> {
  const supabase = await createClient();
  const { data, error } = await supabase.auth.getClaims();

  if (error || !data || !data.claims) {
    return null;
  }

  const userId = data.claims.sub;
  const email = typeof data.claims.email === "string" ? data.claims.email : null;

  if (!userId) {
    return null;
  }

  return { userId, email };
}
