import "server-only";

import { cache } from "react";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getStaffClaims } from "@/server/auth/session";
import { MANAGER_HOME } from "../contracts/manager-home.ts";

/**
 * Who is allowed into the Manager workspace, decided on the server.
 *
 * The workspace is gated by ROLE, not by a permission, and that is deliberate.
 * Every permission a Sales Manager holds is also held by the Super Admin, so a
 * permission gate would let the owner in — harmless — but it would also open
 * the workspace to any future role that happens to be granted the same sales
 * permissions. `/manager` is the Sales Manager's own place; membership of that
 * role is exactly the question being asked.
 *
 * The individual features inside it stay permission-guarded as they already
 * are. This gate decides who sees the workspace, not what they can do in it.
 */
export interface ManagerWorkspaceAccess {
  readonly userId: string;
  readonly email: string | null;
  readonly isSalesManager: boolean;
  readonly isSuperAdmin: boolean;
}

export type ManagerAccessResolution =
  | { readonly kind: "unauthenticated" }
  | { readonly kind: "denied" }
  | { readonly kind: "granted"; readonly access: ManagerWorkspaceAccess };

/**
 * Resolves the caller's standing against the Manager workspace.
 *
 * `has_active_role` is SECURITY INVOKER over `private.has_role`, which already
 * requires an active profile, an active role assignment and a login that has
 * not been revoked. So a suspended or revoked manager resolves to `denied`
 * here for the same reason they would be refused anywhere else, rather than
 * because this module re-implements the check.
 */
export const resolveManagerAccess = cache(
  async (): Promise<ManagerAccessResolution> => {
    const staff = await getStaffClaims();
    if (!staff) {
      return { kind: "unauthenticated" };
    }

    const supabase = await createClient();
    const [managerRes, ownerRes] = await Promise.all([
      supabase.rpc("has_active_role", { p_role_code: "sales_manager" }),
      supabase.rpc("has_active_role", { p_role_code: "super_admin" }),
    ]);

    const isSalesManager = !managerRes.error && managerRes.data === true;
    const isSuperAdmin = !ownerRes.error && ownerRes.data === true;

    if (!isSalesManager) {
      // Sales executives, project managers, designers and revoked accounts all
      // arrive here. None of them get a reason: the workspace simply is not
      // theirs, and naming which check failed would describe the role model to
      // someone who is not in it.
      return { kind: "denied" };
    }

    return {
      kind: "granted",
      access: {
        userId: staff.userId,
        email: staff.email,
        isSalesManager,
        isSuperAdmin,
      },
    };
  }
);

/**
 * Enforces Manager workspace access for a Server Component.
 *
 * An unauthenticated visitor goes to the login page carrying `/manager` as the
 * destination, so they return here after signing in. Anyone authenticated but
 * not a Sales Manager gets the ordinary forbidden page — they already have a
 * session, so bouncing them back to a login form they just satisfied would be
 * a loop, not an answer.
 */
export async function requireSalesManager(): Promise<ManagerWorkspaceAccess> {
  const resolution = await resolveManagerAccess();

  if (resolution.kind === "unauthenticated") {
    redirect(
      `/auth/login?portal=staff&next=${encodeURIComponent(MANAGER_HOME)}`
    );
  }

  if (resolution.kind === "denied") {
    redirect("/auth/forbidden");
  }

  return resolution.access;
}
