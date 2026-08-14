import { createClient } from "@/lib/supabase/server";

export interface QuotationPermissionProbeResult {
  readonly canReadQuotations: boolean;
  readonly canCreateQuotations: boolean;
  readonly canEditQuotations: boolean;
}

export async function probeQuotationPermissions(): Promise<QuotationPermissionProbeResult> {
  const supabase = await createClient();
  const [readRes, createRes, editRes] = await Promise.all([
    supabase.rpc("authorize", { requested_permission: "quotations.read" }),
    supabase.rpc("authorize", { requested_permission: "quotations.create" }),
    supabase.rpc("authorize", { requested_permission: "quotations.edit" }),
  ]);

  return {
    canReadQuotations: !readRes.error && readRes.data === true,
    canCreateQuotations: !createRes.error && createRes.data === true,
    canEditQuotations: !editRes.error && editRes.data === true,
  };
}

export async function isCurrentUserSuperAdmin(): Promise<boolean> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("has_active_role", {
    p_role_code: "super_admin",
  });
  return !error && data === true;
}
