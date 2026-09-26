import Link from "next/link";
import type { WhatsappLeadConversationSummary } from "@/features/whatsapp/server/whatsapp-crm-integration.ts";

const STAMP = new Intl.DateTimeFormat("en-IN", {
  dateStyle: "medium",
  timeStyle: "short",
});

function formatStamp(value: string | null): string {
  if (!value) return "No messages yet";
  const at = new Date(value);
  return Number.isNaN(at.getTime()) ? "No messages yet" : STAMP.format(at);
}

export function LeadWhatsappPanel({
  conversation,
}: {
  readonly conversation: WhatsappLeadConversationSummary;
}) {
  const attention = conversation.needsReply
    ? "Needs reply"
    : conversation.followUpDue
      ? "Follow-up due"
      : conversation.unread
        ? "Unread"
        : conversation.waitingOnCustomer
          ? "Waiting on customer"
          : "Up to date";

  return (
    <section
      className="crm-panel p-4"
      data-testid="crm-lead-whatsapp-panel"
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-[var(--crm-muted)]">
            WhatsApp
          </p>
          <h2 className="mt-1 text-sm font-semibold text-[var(--crm-text)]">
            {conversation.displayName ?? conversation.customerE164}
          </h2>
          <p className="mt-0.5 text-[12px] text-[var(--crm-muted)]">
            {conversation.customerE164}
          </p>
        </div>
        <span className="crm-badge crm-badge-neutral">{attention}</span>
      </div>

      <dl className="mt-3 grid grid-cols-2 gap-3">
        <div>
          <dt className="text-[10px] uppercase tracking-wide text-[var(--crm-muted)]">
            Last message
          </dt>
          <dd className="mt-0.5 text-[12px] text-[var(--crm-text-secondary)]">
            {formatStamp(conversation.lastMessageAt)}
          </dd>
        </div>
        <div>
          <dt className="text-[10px] uppercase tracking-wide text-[var(--crm-muted)]">
            Attention
          </dt>
          <dd className="mt-0.5 text-[12px] text-[var(--crm-text-secondary)]">
            {attention}
          </dd>
        </div>
      </dl>

      <Link
        href={`/admin/whatsapp/inbox/${conversation.conversationId}`}
        className="crm-btn crm-btn-secondary mt-3 w-full justify-center"
      >
        Open WhatsApp conversation
      </Link>
    </section>
  );
}
