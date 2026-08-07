import type { InboxConversationListItem } from "../../contracts/conversation-dtos.ts";

interface InboxConversationListProps {
  readonly items: readonly InboxConversationListItem[];
}

function formatTimestamp(value: string | null): string {
  if (!value) return "No activity";
  return new Intl.DateTimeFormat("en-IN", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

export function InboxConversationList({ items }: InboxConversationListProps) {
  return (
    <ul className="divide-y divide-neutral-800 rounded-lg border border-neutral-800 bg-neutral-900/40">
      {items.map((item) => (
        <li key={item.id}>
          <a
            href={`/admin/whatsapp/inbox/${item.id}`}
            className="block px-4 py-4 transition hover:bg-neutral-900/80 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-emerald-400"
          >
            <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="truncate text-sm font-semibold text-neutral-50">
                    {item.displayNameSnapshot ?? item.customerE164}
                  </p>
                  <span
                    className={`rounded px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${
                      item.isLinked
                        ? "bg-emerald-500/10 text-emerald-300"
                        : "bg-amber-500/10 text-amber-300"
                    }`}
                  >
                    {item.isLinked ? "Linked" : "Unlinked"}
                  </span>
                </div>
                <p className="mt-1 text-xs text-neutral-500">{item.customerE164}</p>
                {item.linkedLeadName ? (
                  <p className="mt-1 text-xs text-neutral-400">
                    Lead: {item.linkedLeadName}
                  </p>
                ) : null}
                {item.previewText ? (
                  <p className="mt-2 line-clamp-2 text-sm text-neutral-300">
                    {item.previewText}
                  </p>
                ) : (
                  <p className="mt-2 text-sm italic text-neutral-500">
                    No message preview
                  </p>
                )}
              </div>
              <time
                className="shrink-0 text-xs text-neutral-500"
                dateTime={item.lastMessageAt ?? undefined}
              >
                {formatTimestamp(item.lastMessageAt)}
              </time>
            </div>
          </a>
        </li>
      ))}
    </ul>
  );
}
