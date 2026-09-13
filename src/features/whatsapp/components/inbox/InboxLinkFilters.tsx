import Link from "next/link";
import {
  buildInboxListHref,
  type InboxLinkFilter,
  type InboxListQuery,
} from "../../contracts/inbox-list-query.ts";

interface InboxLinkFiltersProps {
  readonly query: InboxListQuery;
  readonly showUnlinkedTriage: boolean;
  readonly basePath: string;
}

export function InboxLinkFilters({
  query,
  showUnlinkedTriage,
  basePath,
}: InboxLinkFiltersProps) {
  const tabs: Array<{ id: InboxLinkFilter; label: string }> = [
    { id: "all", label: "All" },
    { id: "linked", label: "Linked" },
  ];

  if (showUnlinkedTriage) {
    tabs.push({ id: "unlinked", label: "Unlinked triage" });
  }

  return (
    <nav
      aria-label="Conversation link filters"
      className="od-wa__tabs"
    >
      {tabs.map((tab) => (
        <Link
          key={tab.id}
          /* Search and attention ride along; the page resets to 1. */
          href={buildInboxListHref(basePath, query, { linkFilter: tab.id })}
          className="od-wa__tab"
          /*
            `aria-current` is also what the stylesheet keys the active tab
            off, so the state cannot be shown to a sighted reader and withheld
            from a screen reader, or the other way round.
          */
          aria-current={query.linkFilter === tab.id ? "page" : undefined}
        >
          {tab.label}
        </Link>
      ))}
    </nav>
  );
}
