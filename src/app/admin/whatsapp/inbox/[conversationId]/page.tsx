import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { InboxComposer } from "@/features/whatsapp/components/inbox/InboxComposer";
import { InboxManualRefreshButton } from "@/features/whatsapp/components/inbox/InboxManualRefreshButton";
import { InboxThread } from "@/features/whatsapp/components/inbox/InboxThread";
import { WhatsappPageHeader } from "@/features/whatsapp/components/shell/WhatsappPageHeader";
import { parseInboxMessageListQuery } from "@/features/whatsapp/contracts/inbox-list-query";
import { getWhatsappInboxAccessContext } from "@/features/whatsapp/server/whatsapp-auth";
import { canCurrentUserAccessConversation } from "@/features/whatsapp/server/whatsapp-inbox-queries";
import { getInboxConversationDetailForCurrentUser } from "@/features/whatsapp/server/whatsapp-inbox-repository";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "WhatsApp Conversation | ONEDECORE",
};

interface WhatsappConversationPageProps {
  readonly params: Promise<{ conversationId: string }>;
  readonly searchParams: Promise<Record<string, string | string[] | undefined>>;
}

export default async function WhatsappConversationPage({
  params,
  searchParams,
}: WhatsappConversationPageProps) {
  const { conversationId } = await params;
  const resolvedSearchParams = await searchParams;
  const messageQuery = parseInboxMessageListQuery(
    conversationId,
    resolvedSearchParams
  );
  const context = await getWhatsappInboxAccessContext();

  if (!context) {
    return null;
  }

  const canRead = await canCurrentUserAccessConversation(conversationId, "read");
  if (!canRead) {
    notFound();
  }

  const detail = await getInboxConversationDetailForCurrentUser(
    conversationId,
    messageQuery
  );

  if (!detail) {
    notFound();
  }

  const canUse = await canCurrentUserAccessConversation(conversationId, "use");
  const displayName = detail.displayNameSnapshot ?? detail.customerE164;

  return (
    <div className="space-y-6">
      <WhatsappPageHeader
        title={displayName}
        description={`${detail.customerE164}${detail.isLinked && detail.linkedLeadName ? ` · Lead: ${detail.linkedLeadName}` : ""}`}
        actions={
          <div className="flex flex-wrap gap-2">
            <Link
              href="/admin/whatsapp/inbox"
              className="inline-flex min-h-11 items-center rounded-md border border-neutral-700 px-4 py-2 text-sm font-medium text-neutral-200 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-400"
            >
              Back to inbox
            </Link>
            <InboxManualRefreshButton />
          </div>
        }
      />

      <div className="flex flex-wrap gap-2 text-xs">
        <span
          className={`rounded px-2 py-1 font-semibold uppercase tracking-wide ${
            detail.isLinked
              ? "bg-emerald-500/10 text-emerald-300"
              : "bg-amber-500/10 text-amber-300"
          }`}
        >
          {detail.isLinked ? "Linked conversation" : "Unlinked triage"}
        </span>
        {detail.linkedLeadAssignedTo ? (
          <span className="rounded bg-neutral-800 px-2 py-1 text-neutral-400">
            Assigned executive scope enforced server-side
          </span>
        ) : null}
      </div>

      <InboxThread messages={detail.messages} />
      <InboxComposer conversationId={conversationId} canUse={canUse} />
    </div>
  );
}
