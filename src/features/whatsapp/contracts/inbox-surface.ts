/**
 * WM-1 — where an inbox is mounted, as data rather than as string literals
 * scattered through components.
 *
 * THE MOUNT CONTRACT
 *
 * The inbox domain (components under `components/inbox`, the repository and
 * queries under `server/`) is surface-agnostic. A surface that mounts it
 * supplies exactly two things:
 *
 *   1. a route-level guard of its own — which login portal an anonymous
 *      visitor is sent to and which path they return to — using
 *      `resolveWhatsappInboxAccess()` / `requireWhatsappInboxReadAccess()`;
 *   2. a `basePath`, passed to the list pane and used for every list,
 *      filter, pagination and conversation link.
 *
 * It supplies NO scope. Which conversations appear is decided by the database
 * from the caller's own session (`leads.assigned_to`, M19 manage scope), so a
 * future Sales Representative dashboard mounting the same components at its
 * own path shows that salesperson exactly their assigned chats without a line
 * of filtering in React.
 *
 * `/admin/whatsapp/inbox` is the only surface that exists in WM-1.
 */

export const WHATSAPP_ADMIN_INBOX_BASE_PATH = "/admin/whatsapp/inbox";

/**
 * WM-2 — the governed inbound media view route. Session-scoped and
 * re-authorised per open, so every surface mounting the inbox can share it.
 */
export const WHATSAPP_MEDIA_VIEW_BASE_PATH = "/api/admin/whatsapp/media";

export function buildWhatsappMediaViewHref(messageId: string): string {
  return `${WHATSAPP_MEDIA_VIEW_BASE_PATH}/${encodeURIComponent(messageId)}`;
}

export const WHATSAPP_ADMIN_TEMPLATES_PATH = "/admin/whatsapp/templates";

export function buildInboxConversationHref(
  basePath: string,
  conversationId: string,
  listQueryString = ""
): string {
  const path = `${basePath}/${conversationId}`;
  return listQueryString ? `${path}?${listQueryString}` : path;
}
