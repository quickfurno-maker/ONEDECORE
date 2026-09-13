import assert from "node:assert/strict";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, test } from "node:test";

import {
  presentMessage,
  presentServiceWindow,
  presentStatus,
  previewForMessage,
  WHATSAPP_MESSAGE_TYPES,
  WHATSAPP_SERVICE_WINDOW_HOURS,
} from "../contracts/message-presentation.ts";
import {
  INBOX_MESSAGE_PUBLIC_KEYS,
  mapMessageRowToItem,
} from "../contracts/conversation-dtos.ts";
import { buildInboxListQueryString, parseInboxListQuery } from "../contracts/inbox-list-query.ts";

const root = process.cwd();
const read = (rel: string) => readFileSync(join(root, rel), "utf8");
/** Source with comments stripped, so prose about a rule is not the rule. */
const code = (src: string) =>
  src.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");

const THREAD = "src/features/whatsapp/components/inbox/InboxThread.tsx";
const LIST = "src/features/whatsapp/components/inbox/InboxConversationList.tsx";
const COMPOSER = "src/features/whatsapp/components/inbox/InboxComposer.tsx";
const SECTION = "src/features/whatsapp/components/inbox/InboxComposerSection.tsx";
const DETAILS = "src/features/whatsapp/components/inbox/ConversationDetailsPanel.tsx";
const HEADER = "src/features/whatsapp/components/inbox/ConversationHeader.tsx";
const PANE = "src/features/whatsapp/components/inbox/InboxListPane.tsx";
const CSS = "src/features/whatsapp/components/whatsapp-workspace.css";
const CONV_ROUTE = "src/app/admin/whatsapp/inbox/[conversationId]/page.tsx";
const LIST_ROUTE = "src/app/admin/whatsapp/inbox/page.tsx";
const LEAD_SUMMARY = "src/features/whatsapp/server/conversation-lead-summary.ts";
const REFRESH = "src/features/whatsapp/components/inbox/InboxManualRefreshButton.tsx";
const REFRESH_ICON = "src/features/whatsapp/components/inbox/InboxRefreshIconButton.tsx";
const SENDING = "src/features/whatsapp/server/whatsapp-sending-status.ts";
const SKELETON = "src/features/whatsapp/components/states/WhatsappLoadingSkeleton.tsx";
const DENIED = "src/features/whatsapp/components/states/WhatsappAccessDenied.tsx";
const ERROR_STATE = "src/app/admin/whatsapp/inbox/error.tsx";
const NOT_FOUND = "src/app/admin/whatsapp/inbox/[conversationId]/not-found.tsx";

const message = (over: Partial<Parameters<typeof presentMessage>[0]> = {}) =>
  presentMessage({
    normalizedMessageType: "text",
    providerMessageType: "text",
    bodyText: "Hello",
    content: {},
    ...over,
  });

/* ========================================================================== */
/* Conversation list                                                          */
/* ========================================================================== */

describe("the conversation list is scannable and honest", () => {
  test("a row shows who, when, what and whether it is linked", () => {
    const list = read(LIST);
    assert.match(list, /item\.displayNameSnapshot \?\? item\.customerE164/);
    assert.match(list, /activityLabel\(item\.lastMessageAt\)/);
    assert.match(list, /item\.previewText \?\? "No messages yet"/);
    assert.match(list, /item\.isLinked \? "Linked" : "Unlinked"/);
  });

  test("the linked state is a word, not only a colour", () => {
    // A colour-only badge is invisible to a screen reader and to anyone who
    // cannot separate the two hues.
    const list = read(LIST);
    assert.match(list, /\{item\.isLinked \? "Linked" : "Unlinked"\}/);
  });

  test("the selected row is marked for assistive technology too", () => {
    const list = read(LIST);
    assert.match(list, /aria-current=\{selected\}/);
    assert.match(read(CSS), /\.od-wa__row\[aria-current="true"\]/);
  });

  test("rows navigate client-side, keeping the workspace mounted", () => {
    /*
     * The list used to use a bare <a>, so every conversation click was a full
     * document load that discarded the list scroll position.
     */
    const list = read(LIST);
    assert.match(list, /^import Link from "next\/link";/m);
    assert.doesNotMatch(code(list), /<a\s/);
  });

  test("search, filter and page survive opening a conversation", () => {
    const query = parseInboxListQuery({ q: "rhea", link: "linked", page: "3" });
    const qs = buildInboxListQueryString(query);
    assert.match(qs, /q=rhea/);
    assert.match(qs, /link=linked/);
    assert.match(qs, /page=3/);
    // Defaults stay out of the URL.
    assert.equal(buildInboxListQueryString(parseInboxListQuery({})), "");
    assert.match(read(LIST), /listQueryString/);
  });

  test("the unread marker is the database's per-staff boolean, never a count", () => {
    /*
     * WM-1 replaced "no unread marker at all" (there was no staff read state
     * to base one on) with a dot driven by `item.unread`, which the read model
     * derives from this reader's own watermark. It is still never a number.
     */
    const list = code(read(LIST));
    assert.match(list, /\{item\.unread === true \? \(/);
    assert.match(list, /<span className="sr-only">Unread<\/span>/);
    assert.doesNotMatch(list, /unreadCount|unread_count|\{item\.unread\}/);
    assert.doesNotMatch(code(read(PANE)), /unreadCount|unread_count/);
  });

  test("the list pane offers real empty states", () => {
    const pane = read(PANE);
    assert.match(pane, /Nothing matches/);
    assert.match(pane, /No conversations yet/);
    assert.match(pane, /hasActiveFilters/);
  });
});

/* ========================================================================== */
/* Message types                                                              */
/* ========================================================================== */

describe("every stored message type renders as something truthful", () => {
  test("plain text comes through as text", () => {
    const p = message({ bodyText: "Need a quote" });
    assert.deepEqual(p, { kind: "text", body: "Need a quote" });
  });

  test("a photo keeps its caption, which lives nowhere else", () => {
    /*
     * `extractBodyText` returns null for every non-text type, so an image's
     * caption exists only inside `content` and was previously invisible.
     */
    const p = message({
      normalizedMessageType: "image",
      providerMessageType: "image",
      bodyText: null,
      content: { id: "media-1", mime_type: "image/jpeg", caption: "Living room today" },
    });
    assert.equal(p.kind, "attachment");
    if (p.kind !== "attachment") return;
    assert.equal(p.attachment.kind, "Photo");
    assert.equal(p.caption, "Living room today");
    assert.equal(p.attachment.mediaType, "Image · JPEG");
  });

  test("a document keeps its filename and a readable type", () => {
    const p = message({
      normalizedMessageType: "document",
      providerMessageType: "document",
      bodyText: null,
      content: { id: "m", mime_type: "application/pdf", filename: "plan.pdf" },
    });
    assert.equal(p.kind, "attachment");
    if (p.kind !== "attachment") return;
    assert.equal(p.attachment.filename, "plan.pdf");
    assert.equal(p.attachment.mediaType, "PDF");
  });

  test("audio, video and stickers each say what they are", () => {
    for (const [type, kind] of [
      ["audio", "Voice message"],
      ["video", "Video"],
      ["sticker", "Sticker"],
    ] as const) {
      const p = message({
        normalizedMessageType: type,
        providerMessageType: type,
        bodyText: null,
        content: { id: "m" },
      });
      assert.equal(p.kind, "attachment");
      if (p.kind === "attachment") assert.equal(p.attachment.kind, kind);
    }
  });

  test("NO media is ever claimed to be retrievable", () => {
    /*
     * THE RULE THIS ENFORCES.
     *
     * There is no route in ONEDECORE that fetches Meta media bytes and no
     * bucket holding them. Until one exists, every attachment must report
     * itself as not retrievable so the thread cannot render a broken <img> or
     * a download button that 404s.
     */
    for (const type of ["image", "audio", "video", "document", "sticker"]) {
      const p = message({
        normalizedMessageType: type,
        providerMessageType: type,
        bodyText: null,
        content: { id: "m" },
      });
      if (p.kind === "attachment") assert.equal(p.attachment.retrievable, false);
    }
    const thread = code(read(THREAD));
    assert.doesNotMatch(thread, /<img/);
    assert.doesNotMatch(thread, /<audio|<video/);
    assert.doesNotMatch(thread, /graph\.facebook/i);
  });

  test("a location renders coordinates and a link with no tracking", () => {
    const p = message({
      normalizedMessageType: "location",
      providerMessageType: "location",
      bodyText: null,
      content: { latitude: 18.5204, longitude: 73.8567, name: "Kalyani Nagar" },
    });
    assert.equal(p.kind, "location");
    if (p.kind !== "location") return;
    assert.equal(p.location.name, "Kalyani Nagar");
    assert.match(p.location.mapsUrl, /^https:\/\/www\.openstreetmap\.org\//);
    assert.doesNotMatch(p.location.mapsUrl, /utm_|fbclid|gclid/);
  });

  test("a location without coordinates does not pretend to have them", () => {
    const p = message({
      normalizedMessageType: "location",
      providerMessageType: "location",
      bodyText: null,
      content: { name: "Somewhere" },
    });
    assert.equal(p.kind, "empty");
  });

  test("a contact card renders bounded name and phones", () => {
    const p = message({
      normalizedMessageType: "contacts",
      providerMessageType: "contacts",
      bodyText: null,
      content: {
        contacts: [
          { name: { formatted_name: "Nikhil Rao" }, phones: [{ phone: "+91 98123 45010" }] },
        ],
      },
    });
    assert.equal(p.kind, "contacts");
    if (p.kind !== "contacts") return;
    assert.equal(p.contacts[0]!.name, "Nikhil Rao");
    assert.deepEqual(p.contacts[0]!.phones, ["+91 98123 45010"]);
  });

  test("an interactive reply shows what the customer chose", () => {
    const p = message({
      normalizedMessageType: "interactive",
      providerMessageType: "interactive",
      bodyText: null,
      content: { button_reply: { id: "b", title: "Yes, call me today" } },
    });
    assert.equal(p.kind, "choice");
    if (p.kind === "choice") assert.equal(p.label, "Yes, call me today");
  });

  test("a reaction renders the emoji and nothing invented", () => {
    const p = message({
      normalizedMessageType: "reaction",
      providerMessageType: "reaction",
      bodyText: null,
      content: { emoji: "👍", message_id: "wamid.X" },
    });
    assert.deepEqual(p, { kind: "reaction", emoji: "👍" });
  });

  test("an unknown type is named, not hidden", () => {
    const p = message({
      normalizedMessageType: "unknown",
      providerMessageType: "order",
      bodyText: null,
      content: {},
    });
    assert.deepEqual(p, { kind: "unsupported", providerType: "order" });
    assert.match(read(THREAD), /Unsupported WhatsApp message/);
  });

  test("every database-allowed type produces a presentation", () => {
    for (const type of WHATSAPP_MESSAGE_TYPES) {
      const p = message({ normalizedMessageType: type, bodyText: null, content: {} });
      assert.ok(p.kind, `${type} produced nothing`);
    }
  });

  test("hostile content cannot become markup", () => {
    /*
     * The message body is customer-controlled. It is handed to React as text
     * nodes and an anchor array — never concatenated into HTML — so there is no
     * path from a message to injected markup.
     */
    const thread = read(THREAD);
    assert.doesNotMatch(code(thread), /dangerouslySetInnerHTML/);
    assert.match(thread, /function linkify/);

    const p = message({ bodyText: "<script>alert(1)</script> see https://x.test" });
    assert.equal(p.kind, "text");
    if (p.kind !== "text") return;
    // The text is preserved verbatim; escaping is React's job at render.
    assert.match(p.body, /<script>/);
  });

  test("only http(s) links are linkified", () => {
    const thread = read(THREAD);
    assert.match(thread, /https\?:\\\/\\\//);
    assert.doesNotMatch(code(thread), /javascript:|data:/);
  });

  test("the preview line describes non-text messages", () => {
    // Otherwise a conversation whose latest message is a photo previews as
    // "No message preview", because body_text is null for every media type.
    assert.equal(
      previewForMessage(
        message({
          normalizedMessageType: "image",
          bodyText: null,
          content: { caption: "Living room" },
        })
      ),
      "Photo · Living room"
    );
    assert.equal(
      previewForMessage(message({ normalizedMessageType: "unknown", bodyText: null })),
      "Unsupported WhatsApp message"
    );
  });
});

/* ========================================================================== */
/* Delivery status                                                            */
/* ========================================================================== */

describe("delivery status is reported, never invented", () => {
  test("the four states WhatsApp actually reports are mapped", () => {
    assert.equal(presentStatus("sent")?.tone, "sent");
    assert.equal(presentStatus("delivered")?.tone, "delivered");
    assert.equal(presentStatus("read")?.tone, "read");
    assert.equal(presentStatus("failed")?.tone, "failed");
  });

  test("an unrecognised status shows itself rather than being guessed", () => {
    /*
     * `latest_status` is free text with no enum behind it, so a value this
     * code has never seen must survive to the screen instead of being mapped
     * to the nearest familiar tick.
     */
    const view = presentStatus("deleted");
    assert.equal(view?.tone, "other");
    assert.equal(view?.label, "deleted");
  });

  test("no status means no tick", () => {
    assert.equal(presentStatus(null), null);
    assert.equal(presentStatus("   "), null);
  });

  test("a tick always carries readable text", () => {
    for (const value of ["sent", "delivered", "read", "failed", "queued"]) {
      const view = presentStatus(value)!;
      assert.ok(view.label.length > 0, value);
      assert.ok(view.glyph.length > 0, value);
    }
    const thread = read(THREAD);
    assert.match(thread, /<span aria-hidden="true">\{status\.glyph\}<\/span>/);
    assert.match(thread, /<span className="sr-only">\{status\.label\}<\/span>/);
  });

  test("status is shown on outbound messages only", () => {
    // An inbound message has no delivery state that means anything to us; the
    // old thread printed "Provider status:" on both.
    assert.match(read(THREAD), /status: outbound \? presentStatus\(message\.latestStatus\) : null/);
  });
});

/* ========================================================================== */
/* Thread structure                                                           */
/* ========================================================================== */

describe("the thread reads as a conversation", () => {
  test("messages are grouped by day, with Today and Yesterday named", () => {
    const thread = read(THREAD);
    assert.match(thread, /if \(days === 0\) return "Today";/);
    assert.match(thread, /if \(days === 1\) return "Yesterday";/);
    assert.match(thread, /role="separator"/);
  });

  test("inbound and outbound are on opposite sides", () => {
    const thread = read(THREAD);
    assert.match(thread, /od-wa__msg--out/);
    assert.match(thread, /od-wa__msg--in/);
    const css = read(CSS);
    assert.match(css, /\.od-wa__msg--in \{\s*\n\s*align-self: flex-start;/);
    assert.match(css, /\.od-wa__msg--out \{\s*\n\s*align-self: flex-end;/);
  });

  test("grouping is a pure pass, not variables mutated mid-render", () => {
    /*
     * The obvious version reassigns `lastDay` inside `.map()`. The React
     * Compiler rejects it, correctly: a variable mutated while rendering is
     * state it cannot reason about.
     */
    const thread = read(THREAD);
    assert.match(thread, /export function decorateMessages\(/);
    assert.match(thread, /const rows = decorateMessages\(messages, new Date\(\)\);/);
  });

  test("a quoted reply is resolved, never fabricated", () => {
    const thread = read(THREAD);
    assert.match(thread, /byProviderId\.get\(message\.contextProviderMessageId\)/);
    // When the quoted message is not on this page, no quote is drawn.
    assert.match(thread, /\{quoted \? \(/);
  });

  test("a quote describes the message the same way the list does", () => {
    /*
     * It used to fall back to the raw type, so a quoted photo read "image"
     * inside the bubble while the conversation list called the same message
     * "Photo · This is the living room as it is today". One description of one
     * message, from one function.
     */
    assert.match(read(THREAD), /\{previewForMessage\(quoted\.presentation\)\}/);
    assert.doesNotMatch(
      code(read(THREAD)),
      /\{quoted\.presentation\.kind === "text"/
    );
  });

  test("an empty conversation says so", () => {
    assert.match(read(THREAD), /No messages yet/);
  });
});

/* ========================================================================== */
/* Composer                                                                   */
/* ========================================================================== */

describe("the composer sends through the one governed path", () => {
  test("the canonical server action is still what submits", () => {
    const composer = read(COMPOSER);
    assert.match(composer, /createWhatsappServiceSendIntentAction/);
    assert.match(composer, /useActionState\(/);
  });

  test("nothing here talks to Meta", () => {
    const composer = code(read(COMPOSER));
    assert.doesNotMatch(composer, /graph\.facebook/i);
    assert.doesNotMatch(composer, /fetch\(/);
    assert.doesNotMatch(composer, /META_WHATSAPP/);
  });

  test("a fresh idempotency key per send", () => {
    /*
     * THE BUG THIS FIXES.
     *
     * The key was memoised once per mount, so the second message of a session
     * reused the first one's key against a different body — a conflicting
     * replay. In a persistent three-pane inbox that is the normal case, not an
     * edge one.
     */
    const composer = read(COMPOSER);
    assert.match(composer, /formData\.set\("idempotencyKey", crypto\.randomUUID\(\)\)/);
    // The comment above it explains the old shape, so match the code alone.
    assert.doesNotMatch(code(composer), /useMemo\(\(\) => crypto\.randomUUID\(\), \[\]\)/);
  });

  test("the box clears only after the server accepted the message", () => {
    // Clearing optimistically would discard text that was never sent.
    assert.match(read(COMPOSER), /key=\{state\.intentId \?\? "compose"\}/);
  });

  test("Enter sends, Shift+Enter is a new line, and IME input is safe", () => {
    const composer = read(COMPOSER);
    assert.match(composer, /event\.key !== "Enter" \|\| event\.shiftKey \|\| event\.nativeEvent\.isComposing/);
    assert.match(composer, /requestSubmit\(\)/);
  });

  test("the 4096 limit is enforced in the control and the button", () => {
    const composer = read(COMPOSER);
    assert.match(composer, /const MAX_BODY = 4096;/);
    assert.match(composer, /maxLength=\{MAX_BODY\}/);
    assert.match(composer, /disabled=\{pending \|\| length === 0 \|\| over\}/);
  });

  test("no send permission produces a reason, not a dead button", () => {
    const composer = read(COMPOSER);
    assert.match(composer, /if \(!canUse\)/);
    assert.match(composer, /cannot reply to it/i);
    assert.doesNotMatch(composer, /WHATSAPP_SERVICE reply \(text only\)/);
  });

  test("it does not claim delivery or read state", () => {
    const composer = read(COMPOSER);
    assert.doesNotMatch(composer, /delivered/i);
    assert.doesNotMatch(composer, /message (was )?read/i);
    assert.match(composer, /fabricating delivery or read status/i);
  });

  test("the textarea stays uncontrolled, so Kriti's insert survives", () => {
    /*
     * Kriti assigns `textarea.value` and dispatches a NATIVE input event.
     * React does not observe native events for value tracking, so a controlled
     * value would be restored on the next render and the draft would vanish.
     */
    const composer = read(COMPOSER);
    assert.doesNotMatch(composer, /value=\{[a-zA-Z]+\}\s*\n?\s*onChange/);
    assert.match(
      read("src/features/kriti/integrations/kriti-inbox-integration.ts"),
      /textarea\.value = text/
    );
  });

  test("AI assist never sends", () => {
    const section = code(read(SECTION));
    assert.doesNotMatch(section, /createWhatsappServiceSendIntentAction/);
    assert.match(section, /InboxKritiAssist/);
    // One ref bridges the two; the human still presses Send.
    assert.match(section, /textareaRef=\{textareaRef\}/);
  });

  test("assist is collapsed by default rather than owning the pane", () => {
    const section = read(SECTION);
    assert.match(section, /<details className="od-wa__assist">/);
    assert.match(section, /AI assist/);
  });
});

/* ========================================================================== */
/* Reply window                                                               */
/* ========================================================================== */

describe("the reply window states a window, not a verdict", () => {
  const base = new Date("2026-09-12T12:00:00.000Z");

  test("open inside 24 hours of the customer's last message", () => {
    const view = presentServiceWindow("2026-09-12T06:00:00.000Z", base);
    assert.equal(view.open, true);
    assert.match(view.label, /to reply/);
  });

  test("closed after 24 hours — the same rule the dispatch check applies", () => {
    assert.equal(WHATSAPP_SERVICE_WINDOW_HOURS, 24);
    const view = presentServiceWindow("2026-09-11T06:00:00.000Z", base);
    assert.equal(view.open, false);
    assert.match(view.detail, /24 hours/);
  });

  test("no inbound message at all is closed, not unknown-but-hopeful", () => {
    assert.equal(presentServiceWindow(null, base).open, false);
  });

  test("an unreadable timestamp fails closed", () => {
    assert.equal(presentServiceWindow("not-a-date", base).open, false);
  });

  test("it never promises the send will succeed", () => {
    /*
     * The window is one of TWO gates. The other — consent, DNC, an active
     * WhatsApp channel — lives in a `private` function the UI cannot call, so
     * this copy speaks only about the window.
     */
    const open = presentServiceWindow("2026-09-12T11:00:00.000Z", base);
    const closed = presentServiceWindow(null, base);
    for (const view of [open, closed]) {
      assert.doesNotMatch(view.label, /you (can|may) send|will be delivered/i);
      assert.doesNotMatch(view.detail, /guaranteed|will be delivered/i);
    }
  });
});

/* ========================================================================== */
/* CRM panel                                                                  */
/* ========================================================================== */

describe("the details panel cannot bypass CRM permissions", () => {
  test("lead fields come through the CRM's own authorised accessor", () => {
    const summary = read(LEAD_SUMMARY);
    assert.match(summary, /^import "server-only";/m);
    assert.match(summary, /getLeadDetailForCurrentUser/);
    // Never a direct read of the leads table from this feature.
    assert.doesNotMatch(code(summary), /from\("leads"\)|\.from\('leads'\)/);
  });

  test("a refused lead is reported as hidden, not as an error page", () => {
    const summary = read(LEAD_SUMMARY);
    assert.match(summary, /return \{ lead: null, hidden: true \};/);
    assert.match(read(DETAILS), /do not have access to/i);
  });

  test("an unlinked conversation says so plainly", () => {
    assert.match(read(DETAILS), /Not linked to a CRM lead/);
  });

  test("the lead link is formed correctly", () => {
    assert.match(read(DETAILS), /\/admin\/crm\/leads\/\$\{lead\.leadId\}/);
  });

  test("no internal identifier is printed on screen", () => {
    /*
     * Conversation ids, contact ids and the provider's phone-number id are
     * plumbing. The lead id travels inside an href and nowhere else.
     */
    const details = code(read(DETAILS));
    assert.doesNotMatch(details, /\{detail\.id\}/);
    assert.doesNotMatch(details, /\{detail\.contactId\}/);
    assert.doesNotMatch(details, /phoneNumberId|phone_number_id/);
    assert.doesNotMatch(details, />\{lead\.leadId\}</);
  });
});

/* ========================================================================== */
/* Layout and access                                                          */
/* ========================================================================== */

describe("the workspace layout and its guards", () => {
  test("three panes on a wide screen", () => {
    const css = read(CSS);
    assert.match(css, /@media \(min-width: 1280px\)[\s\S]{0,220}grid-template-columns:/);
    assert.match(css, /--od-wa-list-w: 340px;/);
    assert.match(css, /--od-wa-details-w: 320px;/);
  });

  test("one pane at a time below 1024px, chosen by the route", () => {
    const css = read(CSS);
    assert.match(css, /\.od-wa\[data-conversation-open="true"\] \.od-wa__pane--list \{\s*\n\s*display: none;/);
    assert.match(css, /\.od-wa:not\(\[data-conversation-open="true"\]\) \.od-wa__pane--chat \{\s*\n\s*display: none;/);
    assert.match(read(CONV_ROUTE), /data-conversation-open="true"/);
    assert.doesNotMatch(read(LIST_ROUTE), /data-conversation-open/);
  });

  test("customer details is reachable below 1280px and has a return path", () => {
    const route = read(CONV_ROUTE);
    const css = read(CSS);
    assert.match(route, /const showDetails = typeof detailsRaw === "string" && detailsRaw === "1";/);
    assert.match(route, /detailsParams\.set\("details", "1"\)/);
    assert.match(route, /detailsHref=\{detailsHref\}/);
    assert.match(route, /aria-label="Back to conversation"/);
    assert.match(read(HEADER), /aria-label="Customer details"/);
    assert.match(css, /\.od-wa--details-route \.od-wa__pane--list,[\s\S]{0,180}\.od-wa--details-route \.od-wa__pane--chat \{[\s\S]{0,80}display: none !important;/);
    assert.match(css, /\.od-wa--details-route \.od-wa__pane--details \{[\s\S]{0,100}display: flex;[\s\S]{0,100}grid-column: 1 \/ -1;/);
  });

  test("each region scrolls on its own, and the composer stays put", () => {
    const css = read(CSS);
    assert.match(css, /\.od-wa__scroll \{[\s\S]*?overflow-y: auto;/);
    assert.match(css, /\.od-wa__composer \{\s*\n\s*flex: none;/);
    assert.match(css, /min-height: 0;/);
  });

  test("tracks may shrink, so a long URL cannot widen the page", () => {
    assert.match(read(CSS), /grid-template-columns: minmax\(0, 1fr\);/);
  });

  test("primary controls clear a 44px target", () => {
    const css = read(CSS);
    assert.match(css, /\.od-wa__btn \{[\s\S]*?min-height: 44px;/);
    assert.match(css, /\.od-wa__icon \{[\s\S]*?width: 44px;\s*\n\s*height: 44px;/);
    assert.match(css, /\.od-wa__input \{[\s\S]*?min-height: 44px;/);
  });

  test("icon-only controls carry labels", () => {
    const header = read(HEADER);
    assert.match(header, /aria-label="Back to conversations"/);
  });

  test("standalone actions clear 44px; links inside a sentence do not have to", () => {
    /*
     * Measured in a phone-sized browser rather than assumed. Two things were
     * under the line and are now not: "Open in maps", and the customer's
     * number in the chat header — a tel: link, so tapping it starts a call.
     *
     * What is left under 44px is correct. The auto-refresh checkbox is 16px
     * inside a 44px <label>, which is the thing you tap; and a linkified URL
     * inside message text is an inline link in running text, which is exempt
     * for the obvious reason that padding it would break the paragraph apart.
     */
    const css = read(CSS);
    assert.match(css, /\.od-wa__maps \{[\s\S]*?min-height: 44px;/);
    assert.match(css, /\.od-wa__tel \{[\s\S]*?min-height: 44px;/);
    assert.match(read(THREAD), /className="od-wa__maps"/);
    assert.match(read(HEADER), /className="od-wa__tel"/);
    // The label carries the height for the checkbox it wraps.
    assert.match(css, /\.od-wa__toggle \{[\s\S]*?min-height: 44px;/);
    assert.match(read(REFRESH), /<label\s*\n\s*className="od-wa__toggle"/);
  });

  test("the routes keep their dynamic rendering and access checks", () => {
    for (const rel of [LIST_ROUTE, CONV_ROUTE]) {
      assert.match(read(rel), /export const dynamic = "force-dynamic";/);
    }
    const conv = read(CONV_ROUTE);
    assert.match(conv, /canCurrentUserAccessConversation\(conversationId, "read"\)/);
    assert.match(conv, /canCurrentUserAccessConversation\(conversationId, "use"\)/);
    assert.match(conv, /notFound\(\);/);
  });

  test("the message DTO's allowlist still describes what crosses the boundary", () => {
    const item = mapMessageRowToItem({
      id: "m1",
      direction: "inbound",
      normalized_message_type: "image",
      provider_message_type: "image",
      provider_message_id: "wamid.A",
      body_text: null,
      content: { id: "media", mime_type: "image/png", caption: "hi" },
      context_provider_message_id: null,
      provider_timestamp: "2026-09-12T10:00:00.000Z",
      latest_status: null,
    });
    for (const key of INBOX_MESSAGE_PUBLIC_KEYS) {
      assert.ok(key in item, `${key} missing from the mapped item`);
    }
    // The raw provider payload stops at the mapper.
    assert.equal("content" in item, false);
    assert.equal(item.presentation.kind, "attachment");
  });
});

/* ========================================================================== */
/* Security and encoding                                                      */
/* ========================================================================== */

describe("secrets stay on the server and the source stays clean", () => {
  test("no Meta credential appears in any WhatsApp UI file", () => {
    const dir = "src/features/whatsapp/components";
    const walk = (rel: string): string[] => {
      const full = join(root, rel);
      return statSync(full).isDirectory()
        ? readdirSync(full).flatMap((entry) => walk(join(rel, entry)))
        : [rel];
    };
    for (const file of walk(dir)) {
      const src = read(file);
      assert.doesNotMatch(src, /META_WHATSAPP_ACCESS_TOKEN/, file);
      assert.doesNotMatch(src, /META_WHATSAPP_APP_SECRET/, file);
      assert.doesNotMatch(src, /SUPABASE_SERVICE_ROLE_KEY/, file);
      assert.doesNotMatch(src, /graph\.facebook/i, file);
    }
  });

  test("the WhatsApp source carries no mojibake", () => {
    /*
     * Double-encoded dashes and stray replacement glyphs have appeared in this
     * tree before. This fails on the byte sequences rather than the rendered
     * characters, because that is how they survive review.
     */
    const walk = (rel: string): string[] => {
      const full = join(root, rel);
      return statSync(full).isDirectory()
        ? readdirSync(full).flatMap((entry) => walk(join(rel, entry)))
        : [rel];
    };
    const files = [
      ...walk("src/features/whatsapp"),
      ...walk("src/app/admin/whatsapp"),
    ].filter((file) => /\.(ts|tsx|css)$/.test(file));

    assert.ok(files.length > 10, "the sweep found suspiciously few files");
    /*
     * The needles are built from byte values, not written as characters.
     *
     * Spelling them out would put the very sequences this test hunts for into
     * the file doing the hunting, and the sweep would flag itself. It did,
     * the first time it ran.
     */
    const needles = [
      [[0xc3, 0x82], "double-encoded U+00C2"],
      [[0xc3, 0xa2, 0xe2, 0x82, 0xac], "double-encoded dash or quote"],
      [[0xef, 0xbf, 0xbd], "U+FFFD replacement character"],
    ] as const;

    for (const file of files) {
      const raw = readFileSync(join(root, file));
      for (const [bytes, label] of needles) {
        assert.equal(
          raw.includes(Buffer.from(bytes)),
          false,
          `${label} in ${file}`
        );
      }
    }
  });
});

/* ========================================================================== */
/* Staying current                                                            */
/* ========================================================================== */

describe("the inbox refreshes by polling, and says so", () => {
  test("it never calls itself live or real-time", () => {
    /*
     * THE RULE THIS ENFORCES.
     *
     * Supabase Realtime is not available to this application: `connect-src`
     * carries no websocket scheme, no table is published to
     * `supabase_realtime`, and nothing in src/ opens a channel. A reader who
     * believes the pane is a live socket will read silence as "no new
     * messages" rather than "this has not polled yet".
     */
    const refresh = code(read(REFRESH));

    /*
     * Matched against visible strings rather than the whole file. A blanket
     * ban on the word would also reject the sentence that does the work here
     * — "This is not a live connection" — which is the opposite of the rule.
     */
    assert.doesNotMatch(refresh, /[>"]\s*(Live|Real-?time)\b/i);
    assert.match(refresh, /Auto · \{POLL_MS \/ 1000\}s/);
    assert.match(refresh, /This is not a live connection/);
  });

  test("no websocket is opened, and the CSP would not allow one", () => {
    assert.doesNotMatch(read(REFRESH), /new WebSocket|\.channel\(/);
    const csp = read("src/config/http-security.ts");
    assert.match(csp, /\["connect-src", "'self'", supabaseOrigin, META_PIXEL_BEACON_ORIGIN\]/);
    assert.doesNotMatch(csp, /wss:/);
  });

  test("polling is bounded, and a hidden tab polls nothing", () => {
    const refresh = read(REFRESH);
    assert.match(refresh, /const POLL_MS = 10_000;/);
    assert.match(refresh, /if \(document\.visibilityState !== "visible"\) return;/);
    assert.match(refresh, /document\.addEventListener\("visibilitychange", onVisible\)/);
    // And it is torn down, so a navigation does not leave a timer behind.
    assert.match(refresh, /window\.clearInterval\(id\)/);
    assert.match(refresh, /document\.removeEventListener\("visibilitychange", onVisible\)/);
  });

  test("auto-refresh can be turned off, and manual refresh always remains", () => {
    const refresh = read(REFRESH);
    assert.match(refresh, /type="checkbox"/);
    assert.match(refresh, /onClick=\{\(\) => router\.refresh\(\)\}/);
  });

  test("exactly one component owns the timer", () => {
    /*
     * THE BUG THIS PREVENTS.
     *
     * The chat header used to render the same control as the list pane. Both
     * mount on the conversation route, so two intervals ran and the inbox
     * polled at twice its stated rate — invisible on screen, visible only in
     * the server log. The header's button now owns no timer.
     */
    const icon = read(REFRESH_ICON);
    assert.doesNotMatch(icon, /setInterval|useEffect/);
    assert.match(icon, /onClick=\{\(\) => router\.refresh\(\)\}/);
    assert.match(icon, /aria-label="Refresh this conversation"/);

    assert.match(read(HEADER), /<InboxRefreshIconButton \/>/);
    assert.doesNotMatch(read(HEADER), /<InboxManualRefreshButton \/>/);

    // The polling control is rendered once per route, by the list pane.
    for (const rel of [LIST_ROUTE, CONV_ROUTE]) {
      const route = read(rel);
      assert.equal(
        (route.match(/<InboxManualRefreshButton \/>/g) ?? []).length,
        1,
        rel
      );
    }
  });

  test("a phone still polls, because the hidden list pane is still mounted", () => {
    /*
     * Below 1024px the conversation route hides the list pane with
     * `display: none` — it is not unmounted, so its effects still run. That is
     * what keeps a phone conversation current now that the timer lives there.
     * Measured in the browser at 390px: pane display none, control mounted,
     * one request in thirteen seconds.
     */
    const css = read(CSS);
    assert.match(
      css,
      /\.od-wa\[data-conversation-open="true"\] \.od-wa__pane--list \{\s*\n\s*display: none;/
    );
    assert.doesNotMatch(read(CONV_ROUTE), /\{!isMobile && <InboxListPane/);
  });
});

/* ========================================================================== */
/* Sending mode                                                               */
/* ========================================================================== */

describe("the workspace says whether a reply will actually arrive", () => {
  test("the three modes are named, and only one of them reaches a customer", () => {
    /*
     * All three modes return `success: true` from the send action and all
     * three put the message in the thread. Without this, the composer in a
     * `disabled` environment is a button that pretends to work.
     */
    const sending = read(SENDING);
    assert.match(sending, /^import "server-only";/m);
    for (const mode of ["enabled", "local-test", "disabled"]) {
      assert.ok(sending.includes(mode), `${mode} is not handled`);
    }
    assert.match(sending, /tone: "live",[\s\S]{0,300}reaches: true,/);
    assert.match(sending, /tone: "test",[\s\S]{0,360}reaches: false,/);
    assert.match(sending, /tone: "off",[\s\S]{0,360}reaches: false,/);
  });

  test("it reports configuration and never claims a health check", () => {
    const sending = code(read(SENDING));
    assert.doesNotMatch(sending, /connected|online|healthy|reachable/i);
  });

  test("it discloses no account identifier", () => {
    // The comment above the function names what it withholds, so match code.
    const sending = code(read(SENDING));
    assert.doesNotMatch(sending, /waba|phone_number_id|phoneNumberId|accessToken|appSecret/i);
    // It reads one variable and maps it to one of three known words.
    assert.match(sending, /const mode = getWhatsappOutboundMode\(\);/);
  });

  test("the warning is drawn where the button is, not only at the top", () => {
    assert.match(read(COMPOSER), /\{sending && !sending\.reaches \? \(/);
    assert.match(read(PANE), /\{sending && !sending\.reaches \? \(/);
  });

  test("a working environment gets no banner", () => {
    // A notice that is always on screen is a notice nobody reads.
    assert.match(read(PANE), /!sending\.reaches/);
  });

  test("both routes compute it on the server", () => {
    for (const rel of [LIST_ROUTE, CONV_ROUTE]) {
      assert.match(read(rel), /const sending = getWhatsappSendingStatus\(\);/, rel);
    }
    // The client components name the type only, and take it from contracts.
    for (const rel of [COMPOSER, SECTION, PANE]) {
      assert.match(
        read(rel),
        /import type \{ SendingStatusView \} from "\.\.\/\.\.\/contracts\/sending-status\.ts";/,
        rel
      );
    }
  });
});

/* ========================================================================== */
/* Loading, error, refusal                                                    */
/* ========================================================================== */

describe("the surrounding states match the workspace", () => {
  test("the skeleton draws the real frame, so nothing jumps on load", () => {
    const skeleton = read(SKELETON);
    assert.match(skeleton, /className="od-wa"/);
    assert.match(skeleton, /od-wa__pane--list/);
    assert.match(skeleton, /od-wa__pane--chat/);
    assert.match(skeleton, /aria-hidden="true"/);
  });

  test("the shimmer stops for anyone who asked for less motion", () => {
    assert.match(
      read(CSS),
      /@media \(prefers-reduced-motion: reduce\) \{\s*\n\s*\.od-wa__sk \{\s*\n\s*animation: none;/
    );
  });

  test("an error offers a way out and a reference to report", () => {
    const state = read(ERROR_STATE);
    assert.match(state, /role="alert"/);
    assert.match(state, /no message was sent/);
    assert.match(state, /Reference: \{error\.digest\}/);
    assert.match(state, /onClick=\{reset\}/);
  });

  test("a refused conversation does not confirm that it exists", () => {
    /*
     * `page.tsx` calls notFound() both when the row is missing and when it is
     * out of scope. Saying "that exists but is not yours" would confirm a
     * customer is in the system, which is what the scope rule prevents.
     */
    const state = read(NOT_FOUND);
    assert.match(state, /Conversation not available/);
    assert.match(state, /does not exist or is outside/);
  });

  test("no route paints a blank screen when access is missing", () => {
    for (const rel of [LIST_ROUTE, CONV_ROUTE]) {
      const route = read(rel);
      assert.match(route, /return <WhatsappAccessDenied \/>;/, rel);
      assert.doesNotMatch(code(route), /if \(!context\) \{\s*\n\s*return null;/, rel);
    }
    assert.match(read(DENIED), /A manager can grant it\./);
  });
});
