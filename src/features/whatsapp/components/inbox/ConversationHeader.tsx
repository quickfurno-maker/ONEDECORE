import Link from "next/link";
import type { InboxConversationDetail } from "../../contracts/conversation-dtos.ts";
import type { ServiceWindowView } from "../../contracts/message-presentation.ts";
import { conversationInitials } from "./InboxConversationList.tsx";
import { InboxRefreshIconButton } from "./InboxRefreshIconButton.tsx";

/**
 * The bar above the thread.
 *
 * Every field here is one the read model already carries. There is no "online"
 * dot, no "typing…", no last-seen: WhatsApp Business does not report presence
 * to a business account, so any of those would be an invention sitting at the
 * top of the screen all day.
 */

interface ConversationHeaderProps {
  readonly detail: InboxConversationDetail;
  readonly serviceWindow: ServiceWindowView;
  /** Back to the list on mobile, where the list is a separate screen. */
  readonly backHref: string;
  /** Details is a route below 1280px and a pane above it. */
  readonly detailsHref: string | null;
}

export function ConversationHeader({
  detail,
  serviceWindow,
  backHref,
  detailsHref,
}: ConversationHeaderProps) {
  const name = detail.displayNameSnapshot ?? detail.customerE164;

  return (
    <header className="od-wa__head">
      <Link
        href={backHref}
        className="od-wa__icon lg:hidden"
        aria-label="Back to conversations"
      >
        <span aria-hidden="true">←</span>
      </Link>

      <span className="od-wa__avatar" aria-hidden="true">
        {conversationInitials(detail.displayNameSnapshot, detail.customerE164)}
      </span>

      <div style={{ minWidth: 0, flex: "1 1 auto" }}>
        <h2 className="od-wa__head-title">{name}</h2>
        <p className="od-wa__head-sub">
          {/*
            A real action, so a real target. Tapping the number on a phone
            starts a call, and at the size of the subtitle text it was 16px
            tall — a link staff would miss and hit the conversation behind it.
            The padding gives it height without moving the line.
          */}
          <a className="od-wa__tel" href={`tel:${detail.customerE164}`}>
            {detail.customerE164}
          </a>
          {detail.isLinked && detail.linkedLeadName ? ` · ${detail.linkedLeadName}` : ""}
        </p>
      </div>

      {/*
        The reply window, stated as a window and nothing more.
        It mirrors the same 24-hour rule the dispatch check applies to
        `last_inbound_at`, so it is accurate about the window — but consent and
        channel status are evaluated separately, inside a private function the
        UI cannot call, so this never claims a send will succeed.
      */}
      <span
        className={`od-wa__badge ${
          serviceWindow.open ? "od-wa__badge--open" : "od-wa__badge--closed"
        }`}
        title={serviceWindow.detail}
      >
        {serviceWindow.label}
      </span>

      <InboxRefreshIconButton />

      {detailsHref ? (
        <Link href={detailsHref} className="od-wa__icon xl:hidden" aria-label="Customer details">
          <span aria-hidden="true">ⓘ</span>
        </Link>
      ) : null}
    </header>
  );
}
