import "server-only";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getSafeAdminRedirect } from "@/server/auth/authorize";
import { getStaffClaims } from "@/server/auth/session";
import {
  hasWhatsappInboxReadAccess,
  type WhatsappInboxAccessContext,
} from "../contracts/inbox-access.ts";
import { probeWhatsappInboxPermissions } from "./whatsapp-permissions.ts";

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

export async function requireWhatsappInboxReadAccess(
  currentPath: string = "/admin/whatsapp/inbox"
): Promise<WhatsappInboxAccessContext> {
  const resolution = await resolveWhatsappInboxAccess();

  if (resolution.kind === "unauthenticated") {
    const safeNext = getSafeAdminRedirect(currentPath);
    const loginUrl =
      safeNext !== "/admin"
        ? `/auth/login?next=${encodeURIComponent(safeNext)}`
        : "/auth/login";
    redirect(loginUrl);
  }

  if (resolution.kind === "inactive" || resolution.kind === "denied") {
    redirect("/auth/forbidden");
  }

  return resolution.context;
}

export async function requireWhatsappInboxUseAccess(
  currentPath: string = "/admin/whatsapp/inbox"
): Promise<WhatsappInboxAccessContext> {
  const context = await requireWhatsappInboxReadAccess(currentPath);
  if (!context.canUse) {
    redirect("/auth/forbidden");
  }
  return context;
}
