import Link from "next/link";
import type { InboxConversationListItem } from "../../contracts/conversation-dtos.ts";

/**
 * The conversation list.
 *
 * TWO THINGS CHANGED THAT MATTER MORE THAN THE STYLING.
 *
 * It takes a `selectedId`, because a three-pane inbox without a selected row
 * leaves the reader with no idea which conversation the thread beside it
 * belongs to. And it uses `next/link` instead of a bare `<a>`: every
 * conversation click used to be a full document load, which in a persistent
 * workspace throws away the list scroll position and re-renders the shell.
 *
 * WHAT IS DELIBERATELY ABSENT.
 *
 * No unread dot and no unread count. Nothing in `whatsapp_conversations`
 * records what a member of staff has read — there is no `read_at`, no
 * `last_seen_at`, no per-user marker anywhere in the schema. A blue dot here
 * would be decoration that survives a refresh by accident and disappears by
 * accident, and an inbox that lies about what you have dealt with is worse
 * than one that stays quiet. It is listed as a backend gap instead.
 */

interface InboxConversationListProps {
  readonly items: readonly InboxConversationListItem[];
  readonly selectedId?: string | null;
  /** Carried through so returning to the list keeps the reader's place. */
  readonly listQueryString?: string;
}

const TIME = new Intl.DateTimeFormat("en-IN", { hour: "2-digit", minute: "2-digit", hour12: true });
const DATE = new Intl.DateTimeFormat("en-IN", { day: "numeric", month: "short" });

/**
 * WhatsApp-style relative time: clock today, "Yesterday", then a date.
 *
 * A list scanned for "who wrote most recently" is read vertically and fast,
 * and "12 Sept 2026, 4:05 pm" on every row defeats that.
 */
function activityLabel(value: string | null): string {
  if (!value) return "";
  const at = new Date(value);
  if (Number.isNaN(at.getTime())) return "";
  const now = new Date();
  const startOf = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
  const days = Math.round((startOf(now) - startOf(at)) / 86_400_000);
  if (days === 0) return TIME.format(at);
  if (days === 1) return "Yesterday";
  return DATE.format(at);
}

/** Initials from the display name, falling back to the last phone digits. */
export function conversationInitials(displayName: string | null, phone: string): string {
  const name = (displayName ?? "").trim();
  if (name.length > 0) {
    const parts = name.split(/\s+/).filter(Boolean);
    const first = parts[0]?.[0] ?? "";
    const second = parts.length > 1 ? (parts[parts.length - 1]?.[0] ?? "") : "";
    const initials = `${first}${second}`.toUpperCase();
    if (initials.trim().length > 0) return initials;
  }
  return phone.replace(/\D/g, "").slice(-2) || "··";
}

export function InboxConversationList({
  items,
  selectedId = null,
  listQueryString = "",
}: InboxConversationListProps) {
  const suffix = listQueryString ? `?${listQueryString}` : "";

  return (
    <ul className="od-wa__list" data-testid="whatsapp-conversation-list">
      {items.map((item) => {
        const name = item.displayNameSnapshot ?? item.customerE164;
        const selected = item.id === selectedId;

        return (
          <li key={item.id}>
            <Link
              href={`/admin/whatsapp/inbox/${item.id}${suffix}`}
              className="od-wa__row"
              aria-current={selected}
              data-conversation-id={item.id}
            >
              <span className="od-wa__avatar" aria-hidden="true">
                {conversationInitials(item.displayNameSnapshot, item.customerE164)}
              </span>

              <span style={{ minWidth: 0 }}>
                <span className="od-wa__row-top">
                  <span className="od-wa__row-name">{name}</span>
                  <span className="od-wa__row-time">{activityLabel(item.lastMessageAt)}</span>
                </span>

                <span className="od-wa__row-preview">
                  {item.previewText ?? "No messages yet"}
                </span>

                <span className="od-wa__row-meta">
                  {/*
                    The badge carries a word, not just a colour. Linked and
                    unlinked drive who may act on a conversation, so the state
                    has to survive a monochrome screen and a screen reader.
                  */}
                  <span
                    className={`od-wa__badge ${
                      item.isLinked ? "od-wa__badge--linked" : "od-wa__badge--unlinked"
                    }`}
                  >
                    {item.isLinked ? "Linked" : "Unlinked"}
                  </span>
                  <span className="od-wa__row-time">
                    {item.isLinked && item.linkedLeadName
                      ? item.linkedLeadName
                      : item.customerE164}
                  </span>
                </span>
              </span>
            </Link>
          </li>
        );
      })}
    </ul>
  );
}
