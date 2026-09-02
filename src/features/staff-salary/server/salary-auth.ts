import "server-only";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getStaffClaims } from "@/server/auth/session";

/** Permission codes probed for the salary surfaces. */
export type SalaryPermissionCode = "salary.manage" | "salary.self";


export interface SalaryAccessContext {
  readonly userId: string;
  /** Super Admin: set salary, build/finalize statements, record payments. */
  readonly canManageSalary: boolean;
  /** Any active staff member: read their own salary and payments. */
  readonly canViewOwnSalary: boolean;
}

async function probe(code: SalaryPermissionCode): Promise<boolean> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("authorize", {
    requested_permission: code,
  });
  return !error && data === true;
}

export async function getSalaryAccessContext(): Promise<SalaryAccessContext | null> {
  const staff = await getStaffClaims();
  if (!staff) {
    return null;
  }

  const supabase = await createClient();
  const { data: profile } = await supabase
    .from("profiles")
    .select("status")
    .eq("id", staff.userId)
    .maybeSingle();

  if (profile?.status !== "active") {
    return null;
  }

  const [canManageSalary, canViewOwnSalary] = await Promise.all([
    probe("salary.manage"),
    probe("salary.self"),
  ]);

  return { userId: staff.userId, canManageSalary, canViewOwnSalary };
}

/** Any salary surface requires at least own-salary visibility. */
export async function requireSalaryAccess(
  currentPath: string = "/admin/salary"
): Promise<SalaryAccessContext> {
  const context = await getSalaryAccessContext();

  if (!context) {
    redirect(`/auth/login?next=${encodeURIComponent(currentPath)}`);
  }

  if (!context.canManageSalary && !context.canViewOwnSalary) {
    redirect("/auth/forbidden");
  }

  return context;
}

/** Mutating salary is Super Admin only; the RPCs enforce this again. */
export async function requireSalaryManageAccess(
  currentPath: string = "/admin/salary"
): Promise<SalaryAccessContext> {
  const context = await requireSalaryAccess(currentPath);

  if (!context.canManageSalary) {
    redirect("/auth/forbidden");
  }

  return context;
}
