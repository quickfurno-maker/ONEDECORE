import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getStaffClaims, type StaffUserSession } from "./session";

/**
 * Sanitizes return path parameter to ensure redirect target is strictly within /admin boundaries.
 */
export function getSafeAdminRedirect(pathname?: string | null): string {
  if (pathname && pathname.startsWith("/admin") && !pathname.startsWith("/admin//")) {
    return pathname;
  }
  return "/admin";
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
    const loginUrl = safeNext !== "/admin" ? `/auth/login?next=${encodeURIComponent(safeNext)}` : "/auth/login";
    redirect(loginUrl);
  }

  const hasAccess = await checkPermission(permission);
  if (!hasAccess) {
    redirect("/auth/forbidden");
  }

  return session;
}
