import "server-only";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getSafeAdminRedirect } from "@/server/auth/authorize";
import { getStaffClaims } from "@/server/auth/session";
import {
  probeCanManageStaff,
  probeCanReadStaff,
} from "./staff-permissions.ts";
import {
  DEFAULT_LOGIN_PORTAL,
  loginPortalHref,
} from "@/features/staff-admin/contracts/login-portal";

export interface StaffAdminAccessContext {
  readonly userId: string;
  readonly email: string | null;
  readonly canManageStaff: boolean;
  readonly canReadStaff: boolean;
}

export type StaffAdminAccessResolution =
  | { readonly kind: "granted"; readonly context: StaffAdminAccessContext }
  | { readonly kind: "unauthenticated" }
  | { readonly kind: "inactive" }
  | { readonly kind: "denied" };

async function isActiveStaff(userId: string): Promise<boolean> {
  const supabase = await createClient();
  const { data: profile } = await supabase
    .from("profiles")
    .select("status")
    .eq("id", userId)
    .maybeSingle();

  return profile?.status === "active";
}

export function hasStaffReadAccess(context: StaffAdminAccessContext): boolean {
  return context.canReadStaff;
}

export function hasStaffManageAccess(context: StaffAdminAccessContext): boolean {
  return context.canManageStaff;
}

/**
 * Resolves staff administration access using getClaims-aligned session probes.
 */
export async function resolveStaffAdminAccess(): Promise<StaffAdminAccessResolution> {
  const staff = await getStaffClaims();
  if (!staff) {
    return { kind: "unauthenticated" };
  }

  if (!(await isActiveStaff(staff.userId))) {
    return { kind: "inactive" };
  }

  const [canManageStaff, canReadStaff] = await Promise.all([
    probeCanManageStaff(),
    probeCanReadStaff(),
  ]);

  const context: StaffAdminAccessContext = {
    userId: staff.userId,
    email: staff.email,
    canManageStaff,
    canReadStaff,
  };

  if (!hasStaffReadAccess(context) && !hasStaffManageAccess(context)) {
    return { kind: "denied" };
  }

  return { kind: "granted", context };
}

export async function getStaffAdminAccessContext(): Promise<StaffAdminAccessContext | null> {
  const resolution = await resolveStaffAdminAccess();
  return resolution.kind === "granted" ? resolution.context : null;
}

export async function requireStaffAdminAccess(
  currentPath: string = "/admin/staff"
): Promise<StaffAdminAccessContext> {
  const resolution = await resolveStaffAdminAccess();

  if (resolution.kind === "unauthenticated") {
    const safeNext = getSafeAdminRedirect(currentPath);
    // The Super Admin portal: this guard only ever protects /admin.
    const loginUrl = loginPortalHref(DEFAULT_LOGIN_PORTAL, safeNext);
    redirect(loginUrl);
  }

  if (resolution.kind === "inactive") {
    redirect("/auth/forbidden");
  }

  if (resolution.kind === "denied" || !resolution.context.canManageStaff) {
    redirect("/auth/forbidden");
  }

  return resolution.context;
}

export async function requireStaffReadAccess(
  currentPath: string = "/admin/staff"
): Promise<StaffAdminAccessContext> {
  const resolution = await resolveStaffAdminAccess();

  if (resolution.kind === "unauthenticated") {
    const safeNext = getSafeAdminRedirect(currentPath);
    // The Super Admin portal: this guard only ever protects /admin.
    const loginUrl = loginPortalHref(DEFAULT_LOGIN_PORTAL, safeNext);
    redirect(loginUrl);
  }

  if (resolution.kind === "inactive") {
    redirect("/auth/forbidden");
  }

  if (resolution.kind === "denied" || !hasStaffReadAccess(resolution.context)) {
    redirect("/auth/forbidden");
  }

  return resolution.context;
}
