import "server-only";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getSafeAdminRedirect } from "@/server/auth/authorize";
import { getStaffClaims } from "@/server/auth/session";
import {
  hasWhatsappInboxReadAccess,
  type WhatsappInboxAccessContext,
} from "../contracts/inbox-access.ts";
import { WHATSAPP_ADMIN_INBOX_BASE_PATH } from "../contracts/inbox-surface.ts";
import { probeWhatsappInboxPermissions } from "./whatsapp-permissions.ts";
import {
  DEFAULT_LOGIN_PORTAL,
  loginPortalHref,
} from "@/features/staff-admin/contracts/login-portal";

export type WhatsappInboxAccessResolution =
  | { readonly kind: "granted"; readonly context: WhatsappInboxAccessContext }
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

export async function resolveWhatsappInboxAccess(): Promise<WhatsappInboxAccessResolution> {
  const staff = await getStaffClaims();
  if (!staff) {
    return { kind: "unauthenticated" };
  }

  if (!(await isActiveStaff(staff.userId))) {
    return { kind: "inactive" };
  }

  const permissions = await probeWhatsappInboxPermissions();
  const context: WhatsappInboxAccessContext = {
    userId: staff.userId,
    email: staff.email,
    canRead: permissions["whatsapp.inbox.read"],
    canUse: permissions["whatsapp.inbox.use"],
    canManage: permissions["whatsapp.inbox.manage"],
  };

  if (!hasWhatsappInboxReadAccess(context)) {
    return { kind: "denied" };
  }

  return { kind: "granted", context };
}

export async function getWhatsappInboxAccessContext(): Promise<WhatsappInboxAccessContext | null> {
  const resolution = await resolveWhatsappInboxAccess();
  return resolution.kind === "granted" ? resolution.context : null;
}

/**
 * What a route wrapper decides, and the inbox domain does not.
 *
 * `resolveWhatsappInboxAccess()` above is surface-agnostic: it asks who the
 * caller is and what the database lets them do. Where an anonymous visitor is
 * sent, and which path they come back to, belongs to the surface that mounted
 * the inbox — the admin workspace today, a Sales Representative dashboard
 * later — so it is passed in rather than assumed.
 */
export type WhatsappInboxRouteGuard = {
  readonly currentPath: string;
  readonly loginHref: (currentPath: string) => string;
};

export const ADMIN_WHATSAPP_INBOX_ROUTE_GUARD: WhatsappInboxRouteGuard = {
  currentPath: WHATSAPP_ADMIN_INBOX_BASE_PATH,
  // The Super Admin portal, with a return path that must stay under /admin.
  loginHref: (currentPath) =>
    loginPortalHref(DEFAULT_LOGIN_PORTAL, getSafeAdminRedirect(currentPath)),
};

export async function requireWhatsappInboxReadAccess(
  guard: WhatsappInboxRouteGuard = ADMIN_WHATSAPP_INBOX_ROUTE_GUARD
): Promise<WhatsappInboxAccessContext> {
  const resolution = await resolveWhatsappInboxAccess();

  if (resolution.kind === "unauthenticated") {
    redirect(guard.loginHref(guard.currentPath));
  }

  if (resolution.kind === "inactive" || resolution.kind === "denied") {
    redirect("/auth/forbidden");
  }

  return resolution.context;
}

export async function requireWhatsappInboxUseAccess(
  guard: WhatsappInboxRouteGuard = ADMIN_WHATSAPP_INBOX_ROUTE_GUARD
): Promise<WhatsappInboxAccessContext> {
  const context = await requireWhatsappInboxReadAccess(guard);
  if (!context.canUse) {
    redirect("/auth/forbidden");
  }
  return context;
}
