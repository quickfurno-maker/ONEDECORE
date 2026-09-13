import Link from "next/link";
import {
  buildInboxListHref,
  INBOX_RECENT_WINDOW_DAYS_DEFAULT,
  type InboxListQuery,
} from "../../contracts/inbox-list-query.ts";
import type { WhatsappInboxAttentionFilter } from "../../contracts/staff-conversation-state.ts";

/**
 * The attention queues.
 *
 * Each tab is a different question asked of the database — the filtering
 * happens in `list_whatsapp_inbox_conversations`, inside the reader's own
 * scope, not here. This component only builds links.
 *
 * NO COUNTS. A number beside "Unread" would need a second query per tab on
 * every poll, and a count that lags the list by one refresh is a count that
 * disagrees with the screen. The queue itself is the answer.
 *
 * On a phone the strip scrolls sideways rather than wrapping into a second
 * and third row above the conversations.
 */

export const INBOX_ATTENTION_TABS: ReadonlyArray<{
  readonly id: WhatsappInboxAttentionFilter;
  readonly label: string;
  readonly title: string;
}> = [
  { id: "all_assigned", label: "All", title: "Every conversation you can see" },
  { id: "unread", label: "Unread", title: "A customer message arrived after you last opened it" },
  { id: "needs_reply", label: "Needs reply", title: "The customer spoke last" },
  { id: "waiting_on_customer", label: "Waiting", title: "You replied last" },
  { id: "follow_up_due", label: "Follow-up", title: "The lead has an open CRM follow-up that is due" },
  {
    id: "recently_active",
    label: "Recent",
    title: `Active in the last ${INBOX_RECENT_WINDOW_DAYS_DEFAULT} days`,
  },
];

interface InboxAttentionFiltersProps {
  readonly query: InboxListQuery;
  readonly basePath: string;
}

export function InboxAttentionFilters({ query, basePath }: InboxAttentionFiltersProps) {
  return (
    <nav aria-label="Conversation attention filters" className="od-wa__tabs od-wa__tabs--scroll">
      {INBOX_ATTENTION_TABS.map((tab) => (
        <Link
          key={tab.id}
          href={buildInboxListHref(basePath, query, { attention: tab.id })}
          className="od-wa__tab"
          title={tab.title}
          aria-current={query.attention === tab.id ? "page" : undefined}
        >
          {tab.label}
        </Link>
      ))}
    </nav>
  );
}
