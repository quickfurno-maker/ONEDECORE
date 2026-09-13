import Link from "next/link";
import type { InboxLinkFilter, InboxListQuery } from "../../contracts/inbox-list-query.ts";

interface InboxLinkFiltersProps {
  readonly query: InboxListQuery;
  readonly showUnlinkedTriage: boolean;
}

function buildHref(query: InboxListQuery, linkFilter: InboxLinkFilter): string {
  const params = new URLSearchParams();
  if (query.q) params.set("q", query.q);
  if (linkFilter !== "all") params.set("link", linkFilter);
  if (query.pageSize !== 25) params.set("pageSize", String(query.pageSize));
  const value = params.toString();
  return value ? `/admin/whatsapp/inbox?${value}` : "/admin/whatsapp/inbox";
}



export function InboxLinkFilters({
  query,
  showUnlinkedTriage,
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
          href={buildHref(query, tab.id)}
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
