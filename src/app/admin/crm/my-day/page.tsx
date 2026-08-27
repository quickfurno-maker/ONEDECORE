import type { Metadata } from "next";
import { CrmPageHeader } from "@/features/crm/components/shell/CrmPageHeader";
import { MyDayWorkspace } from "@/features/crm/components/my-day/MyDayWorkspace";
import { parseMyDayOwnerFilter } from "@/features/crm/contracts/my-day-contracts.ts";
import { requireCrmReadAccess } from "@/features/crm/server/crm-auth";
import { fetchCrmAssigneeDirectory } from "@/features/crm/server/crm-lead-queries";
import { fetchCrmMyDaySnapshot } from "@/features/crm/server/crm-my-day-queries";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "My Day | CRM | ONEDECORE",
  description: "Daily sales execution workspace — tasks and lead attention.",
};

interface MyDayPageProps {
  readonly searchParams: Promise<Record<string, string | string[] | undefined>>;
}

export default async function CrmMyDayPage({ searchParams }: MyDayPageProps) {
  const context = await requireCrmReadAccess("/admin/crm/my-day");
  const raw = await searchParams;
  const ownerFilter = parseMyDayOwnerFilter(raw.owner);

  const [snapshot, assignees] = await Promise.all([
    fetchCrmMyDaySnapshot(context, {
      ownerId: context.canReadBroad ? ownerFilter : context.userId,
    }),
    context.canReadBroad
      ? fetchCrmAssigneeDirectory(context)
      : Promise.resolve([]),
  ]);

  return (
    <div className="space-y-6">
      <CrmPageHeader
        title="My Day"
        description="Primary next actions and lead attention for daily sales execution."
      />
      <MyDayWorkspace
        snapshot={snapshot}
        assignees={assignees}
        canFilterOwner={context.canReadBroad}
        selectedOwnerId={ownerFilter}
      />
    </div>
  );
}
