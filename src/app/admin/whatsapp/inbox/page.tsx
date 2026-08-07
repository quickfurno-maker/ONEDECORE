import type { Metadata } from "next";
import { InboxConversationList } from "@/features/whatsapp/components/inbox/InboxConversationList";
import { InboxLinkFilters } from "@/features/whatsapp/components/inbox/InboxLinkFilters";
import { InboxListPagination } from "@/features/whatsapp/components/inbox/InboxListPagination";
import { InboxManualRefreshButton } from "@/features/whatsapp/components/inbox/InboxManualRefreshButton";
import { InboxSearchForm } from "@/features/whatsapp/components/inbox/InboxSearchForm";
import { WhatsappPageHeader } from "@/features/whatsapp/components/shell/WhatsappPageHeader";
import {
  hasInboxListActiveFilters,
  parseInboxListQuery,
  toInboxListPaginationMeta,
} from "@/features/whatsapp/contracts/inbox-list-query";
import { getWhatsappInboxAccessContext } from "@/features/whatsapp/server/whatsapp-auth";
import { getInboxConversationListPageForCurrentUser } from "@/features/whatsapp/server/whatsapp-inbox-repository";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "WhatsApp Inbox | ONEDECORE",
  description:
    "Role-scoped WhatsApp shared inbox for authorized ONEDECORE staff.",
};

interface WhatsappInboxPageProps {
  readonly searchParams: Promise<Record<string, string | string[] | undefined>>;
}

export default async function WhatsappInboxPage({
  searchParams,
}: WhatsappInboxPageProps) {
  const resolvedSearchParams = await searchParams;
  const query = parseInboxListQuery(resolvedSearchParams);
  const context = await getWhatsappInboxAccessContext();

  if (!context) {
    return null;
  }

  const page = await getInboxConversationListPageForCurrentUser(query);
  const pagination = toInboxListPaginationMeta(page);
  const filtered = hasInboxListActiveFilters(query);

  return (
    <div className="space-y-6">
      <WhatsappPageHeader
        title="Conversations"
        description="Role-scoped WhatsApp inbox with current lead assignment enforcement. Manual refresh only in V1."
        actions={<InboxManualRefreshButton />}
      />

      <InboxLinkFilters
        query={query}
        showUnlinkedTriage={context.canManage}
      />

      <InboxSearchForm query={query} />

      {page.items.length === 0 ? (
        <section
          aria-label="Empty inbox"
          className="rounded-lg border border-neutral-800 bg-neutral-900/40 px-4 py-10 text-center text-sm text-neutral-400"
        >
          {filtered
            ? "No conversations match your filters."
            : "No conversations are visible in your authorized scope."}
        </section>
      ) : (
        <>
          <InboxConversationList items={page.items} />
          <InboxListPagination query={query} pagination={pagination} />
        </>
      )}
    </div>
  );
}
