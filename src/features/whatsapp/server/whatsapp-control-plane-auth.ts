import "server-only";

import type { WhatsappControlPlanePermissions } from "../contracts/control-plane.ts";
import { resolveWhatsappWorkspaceAccess } from "./whatsapp-workspace-auth.ts";

/*
 * Who is asking, and what the database lets them do in the WhatsApp control
 * plane (Contacts, Templates, Campaigns, Segments, Automations, Forms / Flows,
 * Analytics, Settings & Compliance).
 *
 * Independent of inbox access: every page and action answers to its own
 * `whatsapp.*` permission. The session is the caller's cookie session; there
 * is no service-role client anywhere on this path. Shares the workspace
 * shell's per-request answer, so one request asks the database once.
 */

export type WhatsappControlPlaneAccess = {
  readonly userId: string;
  readonly permissions: WhatsappControlPlanePermissions;
};

export async function resolveWhatsappControlPlaneAccess(): Promise<WhatsappControlPlaneAccess | null> {
  const access = await resolveWhatsappWorkspaceAccess();
  return access.kind === "active" ? { userId: access.userId, permissions: access.permissions } : null;
}
