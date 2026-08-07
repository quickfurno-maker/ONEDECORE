import "server-only";

import { createClient } from "@/lib/supabase/server";
import type { WhatsappInboxPermissionCode } from "../contracts/inbox-permissions.ts";

export type WhatsappInboxPermissionMap = Record<
  WhatsappInboxPermissionCode,
  boolean
>;

async function probePermission(code: WhatsappInboxPermissionCode): Promise<boolean> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("authorize", {
    requested_permission: code,
  });

  if (error) {
    return false;
  }

  return data === true;
}

export async function probeWhatsappInboxPermissions(): Promise<WhatsappInboxPermissionMap> {
  const [canRead, canUse, canManage] = await Promise.all([
    probePermission("whatsapp.inbox.read"),
    probePermission("whatsapp.inbox.use"),
    probePermission("whatsapp.inbox.manage"),
  ]);

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
