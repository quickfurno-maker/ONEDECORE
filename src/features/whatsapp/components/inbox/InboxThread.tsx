import type { InboxMessageItem } from "../../contracts/conversation-dtos.ts";

interface InboxThreadProps {
  readonly messages: readonly InboxMessageItem[];
}

function formatTimestamp(value: string): string {
  return new Intl.DateTimeFormat("en-IN", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

export function InboxThread({ messages }: InboxThreadProps) {
  if (messages.length === 0) {
    return (
      <section
        aria-label="Message history"
        className="rounded-lg border border-neutral-800 bg-neutral-900/40 px-4 py-10 text-center text-sm text-neutral-400"
      >
        No messages in this conversation yet.
      </section>
    );
  }

  return (
    <section
      aria-label="Message history"
      className="space-y-3 rounded-lg border border-neutral-800 bg-neutral-900/40 p-4"
    >
      {messages.map((message) => {
        const isOutbound = message.direction === "outbound";
        return (
          <article
            key={message.id}
            className={`max-w-[85%] rounded-lg px-3 py-2 text-sm ${
              isOutbound
                ? "ml-auto bg-emerald-500/10 text-emerald-50"
                : "bg-neutral-800 text-neutral-100"
            }`}
          >
            <header className="mb-1 flex items-center justify-between gap-3 text-[11px] uppercase tracking-wide text-neutral-500">
              <span>{isOutbound ? "Outbound" : "Inbound"}</span>
              <time dateTime={message.providerTimestamp}>
                {formatTimestamp(message.providerTimestamp)}
              </time>
            </header>
            <p className="whitespace-pre-wrap break-words">
              {message.bodyText ?? `[${message.normalizedMessageType}]`}
            </p>
            {message.latestStatus ? (
              <p className="mt-2 text-[11px] text-neutral-500">
                Provider status: {message.latestStatus}
              </p>
            ) : null}
          </article>
        );
      })}
    </section>
  );
}
