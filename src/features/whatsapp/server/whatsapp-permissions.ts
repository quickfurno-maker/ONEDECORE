import "server-only";

import { createClient } from "@/lib/supabase/server";
import type { WhatsappInboxPermissionCode } from "../contracts/inbox-permissions.ts";
import { authorizeMany } from "@/server/auth/authorize-many";

export type WhatsappInboxPermissionMap = Record<
  WhatsappInboxPermissionCode,
  boolean
>;


export async function probeWhatsappInboxPermissions(): Promise<WhatsappInboxPermissionMap> {
  /*
   * One round trip, not three. `authorize_many` loops over `public.authorize`,
   * so the access rules are unchanged; only the number of times this request
   * asks them has.
   */
  const supabase = await createClient();
  const answers = await authorizeMany(
    ["whatsapp.inbox.read", "whatsapp.inbox.use", "whatsapp.inbox.manage"] as const,
    supabase
  );
  const canRead = answers["whatsapp.inbox.read"];
  const canUse = answers["whatsapp.inbox.use"];
  const canManage = answers["whatsapp.inbox.manage"];

  return {
    "whatsapp.inbox.read": canRead,
    "whatsapp.inbox.use": canUse,
    "whatsapp.inbox.manage": canManage,
  };
}

export async function hasAnyWhatsappInboxReadPermission(): Promise<boolean> {
  const permissions = await probeWhatsappInboxPermissions();
  return permissions["whatsapp.inbox.read"];
}
