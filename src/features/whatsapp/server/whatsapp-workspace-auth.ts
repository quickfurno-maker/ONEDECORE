import "server-only";

import { cache } from "react";
import { createClient } from "@/lib/supabase/server";
import { authorizeMany } from "@/server/auth/authorize-many";
import { getStaffClaims } from "@/server/auth/session";
import {
  visibleWhatsappControlPlaneSections,
  WHATSAPP_CONTROL_PLANE_PERMISSION_CODES,
  type WhatsappControlPlanePermissions,
} from "../contracts/control-plane.ts";

/*
 * The WhatsApp workspace shell's question: is this an active staff member,
 * and which WhatsApp sections does the database let them open?
 *
 * Deliberately NOT an inbox gate. Each page under /admin/whatsapp checks its
 * own exact permission; the shell only decides whether to show the section
 * nav and never lists a section the caller cannot open. The caller's cookie
 * session is the only client; one authorize_many round trip per request.
 */

export type WhatsappWorkspaceAccess =
  | { readonly kind: "unauthenticated" }
  | { readonly kind: "inactive" }
  | { readonly kind: "active"; readonly userId: string; readonly permissions: WhatsappControlPlanePermissions };

export const resolveWhatsappWorkspaceAccess = cache(async (): Promise<WhatsappWorkspaceAccess> => {
  const staff = await getStaffClaims();
  if (!staff) return { kind: "unauthenticated" };
  const supabase = await createClient();
  const { data: profile } = await supabase.from("profiles").select("status").eq("id", staff.userId).maybeSingle();
  if (profile?.status !== "active") return { kind: "inactive" };
  const permissions = await authorizeMany(WHATSAPP_CONTROL_PLANE_PERMISSION_CODES, supabase);
  return { kind: "active", userId: staff.userId, permissions };
});

/** The first section this caller may open, or null when WhatsApp is not theirs at all. */
export function firstWhatsappWorkspaceHref(permissions: WhatsappControlPlanePermissions): string | null {
  return visibleWhatsappControlPlaneSections(permissions)[0]?.href ?? null;
}
