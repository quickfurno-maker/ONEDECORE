/**
 * Phase 6B-B1 — conversation access resolver (application mirror of DB rules).
 */

import type { WhatsappInboxCapability } from "../contracts/inbox-permissions.ts";

export type InboxAccessContext = {
  actorId: string;
  isActiveStaff: boolean;
  permissions: ReadonlySet<string>;
  roles: ReadonlySet<string>;
};

export type ConversationAccessContext = {
  conversationId: string;
  leadId: string | null;
  assignedTo: string | null;
};

function hasManageScope(ctx: InboxAccessContext): boolean {
  return (
    ctx.permissions.has("whatsapp.inbox.manage") &&
    (ctx.roles.has("super_admin") ||
      ctx.roles.has("sales_manager") ||
      ctx.roles.has("management"))
  );
}

export function canViewWhatsappConversation(
  actor: InboxAccessContext,
  conversation: ConversationAccessContext
): boolean {
  if (!actor.isActiveStaff || !actor.permissions.has("whatsapp.inbox.read")) {
    return false;
  }
  if (conversation.leadId === null) {
    return hasManageScope(actor);
  }
  if (hasManageScope(actor)) {
    return true;
  }
  return (
    conversation.assignedTo !== null && conversation.assignedTo === actor.actorId
  );
}

export function canUseWhatsappConversation(
  actor: InboxAccessContext,
  conversation: ConversationAccessContext
): boolean {
  if (!actor.isActiveStaff || !actor.permissions.has("whatsapp.inbox.use")) {
    return false;
  }
  if (conversation.leadId === null) {
    return hasManageScope(actor);
  }
  if (hasManageScope(actor)) {
    return true;
  }
  return (
    conversation.assignedTo !== null && conversation.assignedTo === actor.actorId
  );
}

export function canManageWhatsappConversation(
  actor: InboxAccessContext,
  conversation: ConversationAccessContext
): boolean {
  return (
    hasManageScope(actor) &&
    conversation.conversationId.length > 0
  );
}

export function resolveWhatsappInboxAccess(
  actor: InboxAccessContext,
  conversation: ConversationAccessContext,
  capability: WhatsappInboxCapability
): boolean {
  switch (capability) {
    case "read":
      return canViewWhatsappConversation(actor, conversation);
    case "use":
      return canUseWhatsappConversation(actor, conversation);
    case "manage":
      return canManageWhatsappConversation(actor, conversation);
    default:
      return false;
  }
}
