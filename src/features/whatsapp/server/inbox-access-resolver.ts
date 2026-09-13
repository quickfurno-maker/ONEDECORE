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
  /**
   * WM-1: the linked lead carries a tombstone (`leads.deleted_at` is set).
   * Mirrors the database: manage scope keeps historical READ, nobody may USE,
   * and the former assignee no longer passes through `assignedTo`.
   */
  leadDeleted?: boolean;
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
  if (conversation.leadDeleted === true) {
    return false;
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
  // Nobody sends into a deleted enquiry's conversation, manage scope included.
  if (conversation.leadId !== null && conversation.leadDeleted === true) {
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
