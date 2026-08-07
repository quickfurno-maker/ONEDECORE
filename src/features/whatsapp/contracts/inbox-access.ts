/**
 * WhatsApp inbox workspace access context — normalized server-side authorization shape.
 */

export interface WhatsappInboxAccessContext {
  readonly userId: string;
  readonly email: string | null;
  readonly canRead: boolean;
  readonly canUse: boolean;
  readonly canManage: boolean;
}

export function hasWhatsappInboxReadAccess(
  context: WhatsappInboxAccessContext
): boolean {
  return context.canRead;
}

export function hasWhatsappInboxUseAccess(
  context: WhatsappInboxAccessContext
): boolean {
  return context.canUse;
}
