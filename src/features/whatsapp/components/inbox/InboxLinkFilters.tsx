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

function tabClass(active: boolean): string {
  return active
    ? "border-emerald-400 text-emerald-300"
    : "border-transparent text-neutral-400 hover:text-neutral-200";
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
      className="flex flex-wrap gap-2 border-b border-neutral-800"
    >
      {tabs.map((tab) => (
        <Link
          key={tab.id}
          href={buildHref(query, tab.id)}
          className={`inline-flex min-h-11 items-center border-b-2 px-3 py-2 text-sm font-medium transition ${tabClass(query.linkFilter === tab.id)}`}
          aria-current={query.linkFilter === tab.id ? "page" : undefined}
        >
          {tab.label}
        </Link>
      ))}
    </nav>
  );
}
