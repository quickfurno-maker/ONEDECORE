/**
 * What a WhatsApp message looks like in the inbox.
 *
 * WHY THIS IS A SEPARATE, PURE LAYER.
 *
 * `whatsapp_messages.content` is Meta's raw per-type object, copied verbatim by
 * the webhook normaliser — `extractContent` returns `message[message.type]` and
 * nothing renames, validates or reshapes it. That is the right thing for an
 * ingest boundary and the wrong thing to hand a component: the UI would be
 * indexing into attacker-influenced JSON in the middle of JSX.
 *
 * So everything the thread renders is derived here first, into a small closed
 * union with bounded strings. The components receive a `MessagePresentation`
 * and never touch `content` at all.
 *
 * WHAT THIS LAYER REFUSES TO DO.
 *
 * It never invents a media URL. Media bytes are only reachable through the
 * WM-2 governed view route, which re-authorises every open and is offered only
 * when media viewing is enabled in this environment. Without that, the
 * presentation says exactly what it knows — filename, type and caption — and
 * an honest note that the file is not viewable here, rather than rendering a
 * broken `<img>` or a download button that 404s.
 */

/** The twelve types the database constraint allows. */
export const WHATSAPP_MESSAGE_TYPES = [
  "text",
  "image",
  "audio",
  "video",
  "document",
  "sticker",
  "location",
  "contacts",
  "interactive",
  "button",
  "reaction",
  "unknown",
] as const;

export type WhatsappMessageType = (typeof WHATSAPP_MESSAGE_TYPES)[number];

/** Caps every derived string, so no payload can stretch a bubble. */
const MAX_LABEL = 120;
const MAX_BODY = 1200;

function text(value: unknown, limit = MAX_LABEL): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  if (trimmed.length === 0) return null;
  return trimmed.length > limit ? `${trimmed.slice(0, limit - 1)}…` : trimmed;
}

function record(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function coordinate(value: unknown): number | null {
  const n = typeof value === "number" ? value : Number(value);
  return Number.isFinite(n) ? n : null;
}

/**
 * A human label for a MIME type.
 *
 * Shown instead of the raw `application/vnd.openxmlformats-officedocument…`
 * string, which is accurate, useless, and forty characters wide.
 */
function mimeLabel(mime: string | null): string | null {
  if (!mime) return null;
  const [type, sub] = mime.split("/");
  if (!sub) return text(mime, 40);
  if (mime === "application/pdf") return "PDF";
  if (sub.includes("wordprocessingml") || sub === "msword") return "Word document";
  if (sub.includes("spreadsheetml") || sub === "vnd.ms-excel") return "Spreadsheet";
  if (sub.includes("presentationml") || sub === "vnd.ms-powerpoint") return "Presentation";
  if (type === "image") return `Image · ${sub.toUpperCase()}`;
  if (type === "audio") return `Audio · ${sub.toUpperCase()}`;
  if (type === "video") return `Video · ${sub.toUpperCase()}`;
  return text(sub.toUpperCase(), 40);
}

export interface MessageAttachment {
  /** "Photo", "Voice message", "Document"… — what the customer sent. */
  readonly kind: string;
  /** Filename when the sender supplied one, else null. */
  readonly filename: string | null;
  /** Readable media type, e.g. "PDF". */
  readonly mediaType: string | null;
  /**
   * Whether the bytes can actually be opened from here.
   *
   * WM-2 added the governed media view route. It is true only when the caller
   * says media viewing is enabled in this environment AND the message is an
   * inbound media message carrying a provider media id. The route still
   * re-authorises every open; this flag only decides whether to offer a link.
   */
  readonly retrievable: boolean;
}

export interface MessageLocation {
  readonly latitude: number;
  readonly longitude: number;
  readonly name: string | null;
  readonly address: string | null;
  /** An external maps link. No tracking parameters, no referrer. */
  readonly mapsUrl: string;
}

export interface MessageContact {
  readonly name: string;
  readonly phones: readonly string[];
}

export type MessagePresentation =
  | {
      readonly kind: "text";
      readonly body: string;
      /** Present only for an outbound approved template; the body is the recorded preview. */
      readonly templateName?: string;
    }
  | {
      readonly kind: "attachment";
      readonly attachment: MessageAttachment;
      readonly caption: string | null;
    }
  | { readonly kind: "location"; readonly location: MessageLocation }
  | { readonly kind: "contacts"; readonly contacts: readonly MessageContact[] }
  | { readonly kind: "choice"; readonly label: string; readonly note: string }
  | { readonly kind: "reaction"; readonly emoji: string | null }
  | { readonly kind: "empty"; readonly note: string }
  | { readonly kind: "unsupported"; readonly providerType: string };

const ATTACHMENT_KIND: Record<string, string> = {
  image: "Photo",
  audio: "Voice message",
  video: "Video",
  document: "Document",
  sticker: "Sticker",
};

/**
 * Turn one stored message into something renderable.
 *
 * `content` is `unknown` on purpose: the caller has a jsonb column, not a
 * typed object, and pretending otherwise is how a malformed payload becomes a
 * runtime crash in a server component.
 */
export function presentMessage(input: {
  readonly normalizedMessageType: string;
  readonly providerMessageType: string | null;
  readonly bodyText: string | null;
  readonly content: unknown;
  /** Set by the server when ONEDECORE_WHATSAPP_MEDIA_MODE is not disabled. */
  readonly mediaViewEnabled?: boolean;
  readonly direction?: "inbound" | "outbound";
}): MessagePresentation {
  const content = record(input.content) ?? {};
  const type = input.normalizedMessageType;

  if (type === "text") {
    const body = text(input.bodyText, MAX_BODY) ?? text(content.body, MAX_BODY);
    if (!body) return { kind: "empty", note: "Empty message" };
    const templateName =
      input.providerMessageType === "template" ? text(record(content.template)?.name, 80) : null;
    return templateName ? { kind: "text", body, templateName } : { kind: "text", body };
  }

  if (type in ATTACHMENT_KIND) {
    /*
     * `caption` is the one field worth surfacing verbatim: the webhook's
     * `extractBodyText` returns null for every non-text type, so a photo's
     * caption lives ONLY here and would otherwise be invisible to staff.
     */
    return {
      kind: "attachment",
      attachment: {
        kind: ATTACHMENT_KIND[type]!,
        filename: text(content.filename),
        mediaType: mimeLabel(text(content.mime_type, 120)),
        retrievable:
          input.mediaViewEnabled === true &&
          input.direction === "inbound" &&
          typeof content.id === "string" &&
          /^[0-9]{1,64}$/.test(content.id),
      },
      caption: text(content.caption, MAX_BODY),
    };
  }

  if (type === "location") {
    const latitude = coordinate(content.latitude);
    const longitude = coordinate(content.longitude);
    if (latitude === null || longitude === null) {
      return { kind: "empty", note: "Location received without coordinates" };
    }
    return {
      kind: "location",
      location: {
        latitude,
        longitude,
        name: text(content.name),
        address: text(content.address, 200),
        // Coordinates only — the customer's own values, nothing appended.
        mapsUrl: `https://www.openstreetmap.org/?mlat=${latitude}&mlon=${longitude}#map=17/${latitude}/${longitude}`,
      },
    };
  }

  if (type === "contacts") {
    /*
     * Meta sends `contacts` as an ARRAY, and `extractContent` only keeps a
     * record — so a contacts message usually arrives here as `{}`. Handled
     * rather than assumed: if the array did survive, it is read; if not, the
     * bubble says a contact card was received instead of rendering nothing.
     */
    const list = Array.isArray(input.content)
      ? (input.content as unknown[])
      : Array.isArray(content.contacts)
        ? (content.contacts as unknown[])
        : [];

    const contacts: MessageContact[] = [];
    for (const entry of list.slice(0, 5)) {
      const item = record(entry);
      if (!item) continue;
      const name =
        text(record(item.name)?.formatted_name) ?? text(item.formatted_name);
      const phones: string[] = [];
      if (Array.isArray(item.phones)) {
        for (const phone of (item.phones as unknown[]).slice(0, 3)) {
          const value = text(record(phone)?.phone, 32);
          if (value) phones.push(value);
        }
      }
      if (name || phones.length > 0) {
        contacts.push({ name: name ?? "Contact", phones });
      }
    }

    return contacts.length > 0
      ? { kind: "contacts", contacts }
      : { kind: "empty", note: "Contact card received" };
  }

  if (type === "interactive" || type === "button") {
    /*
     * What the customer actually chose. Meta nests the answer differently for
     * each interactive flavour, so all three shapes are read and the first
     * that yields a title wins.
     */
    const label =
      text(record(content.button_reply)?.title) ??
      text(record(content.list_reply)?.title) ??
      text(content.text) ??
      text(content.title);

    return label
      ? {
          kind: "choice",
          label,
          note: type === "button" ? "Tapped a button" : "Chose an option",
        }
      : { kind: "empty", note: "Selection received" };
  }

  if (type === "reaction") {
    return { kind: "reaction", emoji: text(content.emoji, 8) };
  }

  return {
    kind: "unsupported",
    providerType: text(input.providerMessageType, 40) ?? type,
  };
}

/**
 * The one-line summary shown in the conversation list.
 *
 * The list's `previewText` comes from `body_text`, which is null for every
 * non-text message — so without this a conversation whose latest message is a
 * photo previews as "No message preview". This says "Photo" instead.
 */
export function previewForMessage(presentation: MessagePresentation): string {
  switch (presentation.kind) {
    case "text":
      return presentation.templateName ? `Template · ${presentation.body}` : presentation.body;
    case "attachment":
      return presentation.caption
        ? `${presentation.attachment.kind} · ${presentation.caption}`
        : presentation.attachment.kind;
    case "location":
      return presentation.location.name
        ? `Location · ${presentation.location.name}`
        : "Location";
    case "contacts":
      return presentation.contacts.length === 1
        ? `Contact · ${presentation.contacts[0]!.name}`
        : `${presentation.contacts.length} contacts`;
    case "choice":
      return presentation.label;
    case "reaction":
      return presentation.emoji ? `Reacted ${presentation.emoji}` : "Reacted";
    case "empty":
      return presentation.note;
    case "unsupported":
      return "Unsupported WhatsApp message";
    default: {
      const never: never = presentation;
      void never;
      return "";
    }
  }
}

/* ------------------------------------------------------------------ status */

export type MessageStatusTone = "pending" | "sent" | "delivered" | "read" | "failed" | "other";

export interface MessageStatusView {
  readonly tone: MessageStatusTone;
  /** Read out by assistive technology — never an icon alone. */
  readonly label: string;
  /** The tick glyph sighted users recognise. */
  readonly glyph: string;
}

/**
 * Map a provider status string to something showable.
 *
 * `whatsapp_messages.latest_status` is free text capped at 32 characters with
 * no enum behind it, so this maps the values Meta actually sends and passes
 * anything else through under a neutral tone. An unrecognised status shows its
 * own name rather than being silently swallowed or guessed at.
 */
export function presentStatus(latestStatus: string | null): MessageStatusView | null {
  if (!latestStatus) return null;
  const value = latestStatus.trim().toLowerCase();
  if (value.length === 0) return null;

  switch (value) {
    case "accepted":
    case "queued":
    case "pending":
      return { tone: "pending", label: "Queued", glyph: "○" };
    case "sent":
      return { tone: "sent", label: "Sent", glyph: "✓" };
    case "delivered":
      return { tone: "delivered", label: "Delivered to phone", glyph: "✓✓" };
    case "read":
      return { tone: "read", label: "Read", glyph: "✓✓" };
    case "failed":
    case "error":
      return { tone: "failed", label: "Failed to send", glyph: "!" };
    default:
      return {
        tone: "other",
        label: text(latestStatus, 32) ?? "Status unknown",
        glyph: "·",
      };
  }
}

/* ------------------------------------------------------- the reply window */

/** How long WhatsApp allows a free-form reply after the customer's message. */
export const WHATSAPP_SERVICE_WINDOW_HOURS = 24;

export interface ServiceWindowView {
  readonly open: boolean;
  readonly label: string;
  readonly detail: string;
}

/**
 * Whether a plain reply is still allowed, from the customer's last message.
 *
 * This mirrors `private.whatsapp_evaluate_service_window_at_dispatch`, which
 * is exactly `last_inbound_at < now() - interval '24 hours'`. Same field, same
 * rule — so for the WINDOW specifically this is accurate rather than a guess.
 *
 * It is deliberately not described as "you may send". The database checks two
 * separate things, and the other one — consent, DNC, an active WhatsApp
 * channel — lives in `whatsapp_evaluate_service_send_eligibility`, which is a
 * `private` function the UI cannot call. So the copy speaks only about the
 * window and leaves the verdict to the send itself.
 */
export function presentServiceWindow(
  lastInboundAt: string | null,
  now: Date = new Date()
): ServiceWindowView {
  if (!lastInboundAt) {
    return {
      open: false,
      label: "No inbound yet",
      detail:
        "WhatsApp only allows a free-form reply within 24 hours of a message from the customer.",
    };
  }

  const last = new Date(lastInboundAt);
  if (Number.isNaN(last.getTime())) {
    return {
      open: false,
      label: "Window unknown",
      detail: "The time of the customer's last message could not be read.",
    };
  }

  const elapsedMs = now.getTime() - last.getTime();
  const windowMs = WHATSAPP_SERVICE_WINDOW_HOURS * 60 * 60 * 1000;

  if (elapsedMs >= windowMs) {
    return {
      open: false,
      label: "Window closed",
      detail:
        "More than 24 hours since the customer last wrote. WhatsApp will reject a free-form reply until they message again.",
    };
  }

  const hoursLeft = Math.max(1, Math.ceil((windowMs - elapsedMs) / (60 * 60 * 1000)));
  return {
    open: true,
    label: `${hoursLeft}h to reply`,
    detail:
      "You can send a normal reply. WhatsApp closes this window 24 hours after the customer's last message.",
  };
}
