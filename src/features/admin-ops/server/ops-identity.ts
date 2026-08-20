import "server-only";

import { cache } from "react";
import { createClient } from "@/lib/supabase/server";
import { formatCrmCodeLabel } from "@/features/crm/contracts/crm-labels.ts";
import type { OpsIdentity } from "../types.ts";

const ROLE_PRIORITY = [
  "super_admin",
  "sales_manager",
  "sales_executive",
  "project_manager",
  "designer",
] as const;

export const fetchOpsIdentity = cache(async function fetchOpsIdentity(
  userId: string,
  email: string | null
): Promise<OpsIdentity> {
  const supabase = await createClient();
  const [{ data: profile }, { data: roleRows }] = await Promise.all([
    supabase.from("profiles").select("display_name").eq("id", userId).maybeSingle(),
    supabase.from("user_roles").select("roles(code)").eq("user_id", userId),
  ]);

  const displayName =
    profile?.display_name?.trim() ||
    email?.split("@")[0] ||
    "Staff";
  const firstName = displayName.split(/\s+/)[0] ?? displayName;
  const codes = ((roleRows ?? []) as Array<{ roles: { code: string } | null }>)
    .map((row) => row.roles?.code)
    .filter((code): code is string => Boolean(code));
  const primary =
    ROLE_PRIORITY.find((code) => codes.includes(code)) ?? codes[0] ?? null;

  return {
    userId,
    email,
    displayName,
    firstName,
    roleLabel: primary ? formatCrmCodeLabel(primary.replaceAll("_", "-")) : null,
  };
});
