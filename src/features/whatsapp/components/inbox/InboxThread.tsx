import type { InboxMessageItem } from "../../contracts/conversation-dtos.ts";
import {
  presentStatus,
  previewForMessage,
  type MessagePresentation,
} from "../../contracts/message-presentation.ts";

/**
 * The conversation, as a chat surface.
 *
 * WHAT IT REPLACES.
 *
 * A flat `space-y-3` list in which every message — a photo, a shared location,
 * a tapped button — rendered as the literal string `[image]`, `[location]`,
 * `[button]`, because the only body line was
 * `{message.bodyText ?? \`[${message.normalizedMessageType}]\`}`. Delivery
 * state printed as "Provider status: delivered" on inbound messages too, where
 * it means nothing.
 *
 * WHAT IT WILL NOT DO.
 *
 * Render media it cannot fetch. ONEDECORE has no route that retrieves Meta
 * media bytes and no bucket holding them, so a photo shows its caption, type
 * and filename and says plainly that the file cannot be opened here. An
 * `<img>` pointed at a media id would be a broken image; a download button
 * would be a 404 with a spinner.
 */

interface InboxThreadProps {
  readonly messages: readonly InboxMessageItem[];
  /** Shown above the first message when older pages exist. */
  readonly olderMessagesHref?: string | null;
}

const TIME = new Intl.DateTimeFormat("en-IN", {
  hour: "2-digit",
  minute: "2-digit",
  hour12: true,
});

const DAY = new Intl.DateTimeFormat("en-IN", {
  weekday: "short",
  day: "numeric",
  month: "short",
  year: "numeric",
});

/** "Today" and "Yesterday" beat a date a reader has to decode. */
function daySeparatorLabel(value: Date, now: Date): string {
  const startOf = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
  const days = Math.round((startOf(now) - startOf(value)) / 86_400_000);
  if (days === 0) return "Today";
  if (days === 1) return "Yesterday";
  return DAY.format(value);
}

/**
 * Linkify plain text without ever building HTML.
 *
 * The text is split into an array of strings and anchors and handed to React,
 * which escapes every string node. Nothing here concatenates markup, so there
 * is no path from a customer's message to `dangerouslySetInnerHTML` — the
 * thing an inbox rendering hostile input must never do.
 *
 * Only http(s) links become anchors. A `javascript:` or `data:` URL is left as
 * the plain text it is.
 */
function linkify(body: string): Array<string | { href: string; text: string }> {
  const out: Array<string | { href: string; text: string }> = [];
  const pattern = /https?:\/\/[^\s<>"']+/g;
  let last = 0;
  for (const match of body.matchAll(pattern)) {
    const start = match.index ?? 0;
    if (start > last) out.push(body.slice(last, start));
    const href = match[0].replace(/[.,;:)\]]+$/, "");
    out.push({ href, text: href });
    last = start + match[0].length;
  }
  if (last < body.length) out.push(body.slice(last));
  return out;
}

function MessageBody({ presentation }: { readonly presentation: MessagePresentation }) {
  switch (presentation.kind) {
    case "text":
      return (
        <p className="od-wa__text">
          {linkify(presentation.body).map((part, index) =>
            typeof part === "string" ? (
              part
            ) : (
              <a
                key={`${index}-${part.href}`}
                href={part.href}
                target="_blank"
                rel="noreferrer noopener"
              >
                {part.text}
              </a>
            )
          )}
        </p>
      );

    case "attachment":
      return (
        <>
          <div className="od-wa__attach">
            <span className="od-wa__attach-icon" aria-hidden="true">
              {presentation.attachment.kind === "Photo"
                ? "▣"
                : presentation.attachment.kind === "Voice message"
                  ? "◉"
                  : presentation.attachment.kind === "Video"
                    ? "▶"
                    : presentation.attachment.kind === "Sticker"
                      ? "☺"
                      : "▤"}
            </span>
            <span>
              <span className="od-wa__attach-name">
                {presentation.attachment.filename ?? presentation.attachment.kind}
              </span>
              <span className="od-wa__attach-note">
                {presentation.attachment.mediaType
                  ? `${presentation.attachment.mediaType} · `
                  : ""}
                {presentation.attachment.retrievable
                  ? "Received"
                  : "Received on WhatsApp — open the phone to view"}
              </span>
            </span>
          </div>
          {presentation.caption ? (
            <p className="od-wa__text od-wa__caption">{presentation.caption}</p>
          ) : null}
        </>
      );

    case "location":
      return (
        <div className="od-wa__attach">
          <span className="od-wa__attach-icon" aria-hidden="true">
            ⌖
          </span>
          <span>
            <span className="od-wa__attach-name">
              {presentation.location.name ?? "Shared location"}
            </span>
            <span className="od-wa__attach-note">
              {presentation.location.address ??
                `${presentation.location.latitude.toFixed(5)}, ${presentation.location.longitude.toFixed(5)}`}
            </span>
            <a
              className="od-wa__maps"
              href={presentation.location.mapsUrl}
              target="_blank"
              rel="noreferrer noopener"
            >
              Open in maps
            </a>
          </span>
        </div>
      );

    case "contacts":
      return (
        <>
          {presentation.contacts.map((contact, index) => (
            <div className="od-wa__attach" key={`${index}-${contact.name}`}>
              <span className="od-wa__attach-icon" aria-hidden="true">
                ☏
              </span>
              <span>
                <span className="od-wa__attach-name">{contact.name}</span>
                {contact.phones.length > 0 ? (
                  <span className="od-wa__attach-note">{contact.phones.join(" · ")}</span>
                ) : null}
              </span>
            </div>
          ))}
        </>
      );

    case "choice":
      return (
        <p className="od-wa__text">
          <span className="od-wa__attach-note">{presentation.note}</span>
          <br />
          {presentation.label}
        </p>
      );

    case "reaction":
      return (
        <p className="od-wa__text">
          {presentation.emoji ? `Reacted ${presentation.emoji}` : "Reacted to a message"}
        </p>
      );

    case "empty":
      return <p className="od-wa__text od-wa__attach-note">{presentation.note}</p>;

    case "unsupported":
      /*
       * Named, not hidden. Staff seeing "Unsupported WhatsApp message
       * (order)" can go to their phone; a blank bubble tells them nothing and
       * looks like a bug in the inbox.
       */
      return (
        <p className="od-wa__text od-wa__attach-note">
          Unsupported WhatsApp message
          {presentation.providerType ? ` (${presentation.providerType})` : ""}
        </p>
      );

    default: {
      const never: never = presentation;
      void never;
      return null;
    }
  }
}

interface ThreadRow {
  readonly message: InboxMessageItem;
  readonly at: Date;
  readonly day: string;
  readonly showDay: boolean;
  readonly outbound: boolean;
  /** True when the speaker changed, which earns a wider gap. */
  readonly turn: boolean;
  readonly status: ReturnType<typeof presentStatus>;
  readonly quoted: InboxMessageItem | undefined;
}

/**
 * Day separators, speaker runs and quoted replies, resolved in one pass.
 *
 * A quoted reply is matched on Meta's own `wamid`, because that is what the
 * webhook stores in `context_provider_message_id`. Only messages on the loaded
 * page can be matched — when the original is older than the current window the
 * quote is dropped rather than guessed at, which is the whole reason the
 * renderer never invents quoted text.
 */
export function decorateMessages(
  messages: readonly InboxMessageItem[],
  now: Date
): readonly ThreadRow[] {
  const byProviderId = new Map(messages.map((message) => [message.providerMessageId, message]));
  const rows: ThreadRow[] = [];
  let lastDay = "";
  let lastDirection: string | null = null;

  for (const message of messages) {
    const at = new Date(message.providerTimestamp);
    const day = daySeparatorLabel(at, now);
    const showDay = day !== lastDay;
    lastDay = day;

    const outbound = message.direction === "outbound";
    const turn = lastDirection !== null && lastDirection !== message.direction;
    lastDirection = message.direction;

    rows.push({
      message,
      at,
      day,
      showDay,
      outbound,
      turn,
      /* Delivery state is a property of what WE sent, never of what arrived. */
      status: outbound ? presentStatus(message.latestStatus) : null,
      quoted: message.contextProviderMessageId
        ? byProviderId.get(message.contextProviderMessageId)
        : undefined,
    });
  }

  return rows;
}

export function InboxThread({ messages, olderMessagesHref }: InboxThreadProps) {
  if (messages.length === 0) {
    return (
      <div className="od-wa__scroll">
        <div className="od-wa__empty">
          <p className="od-wa__empty-title">No messages yet</p>
          <p className="od-wa__empty-note">
            Messages appear here once the customer writes in, or once you send
            the first reply.
          </p>
        </div>
      </div>
    );
  }

  /*
   * Grouping is computed once, into an array, before any JSX.
   *
   * The obvious version keeps `lastDay` and `lastDirection` as loop variables
   * reassigned inside `.map()`. That reads fine and the React Compiler rejects
   * it — correctly: a variable mutated while rendering is state the compiler
   * cannot reason about, and it is the shape that breaks the moment the list
   * is memoised or partially re-rendered. A pure pass fixes it and is easier
   * to test besides.
   */
  const rows = decorateMessages(messages, new Date());

  return (
    <div className="od-wa__scroll" data-testid="whatsapp-thread">
      <div className="od-wa__thread">
        {olderMessagesHref ? (
          <a className="od-wa__daysep" href={olderMessagesHref}>
            Load earlier messages
          </a>
        ) : null}

        {rows.map(({ message, at, day, showDay, outbound, turn, status, quoted }) => {
          return (
            <div key={message.id} style={{ display: "contents" }}>
              {showDay ? (
                <div className="od-wa__daysep" role="separator">
                  {day}
                </div>
              ) : null}

              <article
                className={`od-wa__msg ${outbound ? "od-wa__msg--out" : "od-wa__msg--in"}${
                  turn ? " od-wa__msg--turn" : ""
                }`}
                data-direction={message.direction}
                data-type={message.normalizedMessageType}
              >
                <div className="od-wa__bubble">
                  {quoted ? (
                    <span className="od-wa__quote">
                      <span className="od-wa__quote-who">
                        {quoted.direction === "outbound" ? "ONEDECORE" : "Customer"}
                      </span>
                      {/*
                        The same one-line description the conversation list
                        uses. Falling back to the raw type printed "image"
                        inside the quote while the list two panes away called
                        the same message "Photo · This is the living room as it
                        is today" — one of them had to be wrong, and it was
                        this one.
                      */}
                      <span className="od-wa__quote-text">
                        {previewForMessage(quoted.presentation)}
                      </span>
                    </span>
                  ) : null}

                  <MessageBody presentation={message.presentation} />

                  <div className="od-wa__meta">
                    <time dateTime={message.providerTimestamp}>{TIME.format(at)}</time>
                    {status ? (
                      <span
                        className={`od-wa__status od-wa__status--${status.tone}`}
                        title={status.label}
                      >
                        {/*
                          The glyph is decorative; the label is the message.
                          A tick alone communicates by shape and colour only,
                          which a screen reader cannot pass on.
                        */}
                        <span aria-hidden="true">{status.glyph}</span>
                        <span className="sr-only">{status.label}</span>
                      </span>
                    ) : null}
                  </div>
                </div>
              </article>
            </div>
          );
        })}
      </div>
    </div>
  );
}
