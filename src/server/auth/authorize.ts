import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getStaffClaims, type StaffUserSession } from "./session";
import {
  DEFAULT_LOGIN_PORTAL,
  loginPortalHref,
} from "@/features/staff-admin/contracts/login-portal";
import {
  ADMIN_HOME,
  isSafeStaffRedirect,
} from "@/features/manager-workspace/contracts/manager-home";

/**
 * Sanitises a return path so a redirect can only land inside a staff workspace.
 *
 * TWO WORKSPACES, ONE ALLOWLIST
 *
 * `/admin` is the Super Admin workspace and the historical default; `/manager`
 * is the Sales Manager one. Both are internal staff destinations, so both are
 * allowed — and nothing else is.
 *
 * The `//` guard is what keeps this an allowlist rather than an open redirect:
 * `/admin//evil.example.com` is a protocol-relative URL that a browser resolves
 * to another ORIGIN, so a prefix test alone would happily hand it back.
 * Anything unrecognised collapses to `/admin`, which is itself role-aware and
 * sends a Sales Manager on to `/manager`.
 */
export function getSafeAdminRedirect(pathname?: string | null): string {
  return isSafeStaffRedirect(pathname) ? (pathname as string) : ADMIN_HOME;
}

/**
 * Checks if the current authenticated staff user has the requested permission via public.authorize RPC.
 */
export async function checkPermission(requestedPermission: string): Promise<boolean> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("authorize", {
    requested_permission: requestedPermission,
  });

  if (error || typeof data !== "boolean") {
    return false;
  }

  return data;
}

/**
 * Enforces staff authentication and permission check for Server Components / Layouts.
 * Redirects unauthenticated requests to /auth/login and unauthorized requests to /auth/forbidden.
 */
export async function requireStaffPermission(
  permission: string = "admin.access",
  currentPath: string = "/admin"
): Promise<StaffUserSession> {
  const session = await getStaffClaims();

  if (!session) {
    const safeNext = getSafeAdminRedirect(currentPath);
    // The Super Admin portal: this guard only ever protects /admin.
    const loginUrl = loginPortalHref(DEFAULT_LOGIN_PORTAL, safeNext);
    redirect(loginUrl);
  }

  const hasAccess = await checkPermission(permission);
  if (!hasAccess) {
    redirect("/auth/forbidden");
  }

  return session;
}
