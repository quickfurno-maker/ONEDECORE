import { createClient } from "@/lib/supabase/server";
import { authorizeMany } from "@/server/auth/authorize-many";

export interface QuotationPermissionProbeResult {
  readonly canReadQuotations: boolean;
  readonly canCreateQuotations: boolean;
  readonly canEditQuotations: boolean;
  /** quotations.send — required to issue a secure client link. */
  readonly canSendQuotations: boolean;
}

export async function probeQuotationPermissions(): Promise<QuotationPermissionProbeResult> {
  const supabase = await createClient();
  /*
   * One round trip, not 4. `authorize_many` loops over
   * `public.authorize`, so the access rules are unchanged; only the number
   * of times the page asks them has.
   */
  const answers = await authorizeMany(
    [
    "quotations.read",
    "quotations.create",
    "quotations.edit",
    "quotations.send",
    ] as const,
    supabase
  );

  return {
    canReadQuotations: !false && answers["quotations.read"],
    canCreateQuotations: !false && answers["quotations.create"],
    canEditQuotations: !false && answers["quotations.edit"],
    canSendQuotations: !false && answers["quotations.send"],
  };
}

export async function isCurrentUserSuperAdmin(): Promise<boolean> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("has_active_role", {
    p_role_code: "super_admin",
  });
  return !error && data === true;
}
