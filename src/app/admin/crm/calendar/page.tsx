import type { Metadata } from "next";
import { CrmPageHeader } from "@/features/crm/components/shell/CrmPageHeader";
import { CrmCalendarWorkspace } from "@/features/crm/components/calendar/CrmCalendarWorkspace";
import {
  parseCalendarAnchorDate,
  parseCalendarView,
} from "@/features/crm/contracts/calendar-contracts";
import { parseMyDayOwnerFilter } from "@/features/crm/contracts/my-day-contracts";
import { requireCrmReadAccess } from "@/features/crm/server/crm-auth";
import { fetchCrmCalendarSnapshot } from "@/features/crm/server/crm-calendar-queries";
import { fetchCrmAssigneeDirectory } from "@/features/crm/server/crm-lead-queries";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Calendar | CRM | ONEDECORE",
  description: "Internal CRM activity calendar — day, week and month views.",
};

interface CrmCalendarPageProps {
  readonly searchParams: Promise<Record<string, string | string[] | undefined>>;
}

export default async function CrmCalendarPage({
  searchParams,
}: CrmCalendarPageProps) {
  const context = await requireCrmReadAccess("/admin/crm/calendar");
  const raw = await searchParams;

  const view = parseCalendarView(raw.view);
  const anchorDate = parseCalendarAnchorDate(raw.date);
  const ownerFilter = parseMyDayOwnerFilter(raw.owner);

  const [snapshot, assignees] = await Promise.all([
    fetchCrmCalendarSnapshot(context, { view, anchorDate, ownerId: ownerFilter }),
    context.canReadBroad
      ? fetchCrmAssigneeDirectory(context)
      : Promise.resolve([]),
  ]);

  return (
    <div className="space-y-5">
      <CrmPageHeader
        title="Calendar"
        description="Scheduled CRM activities across the day, week and month."
      />
      <CrmCalendarWorkspace
        snapshot={snapshot}
        assignees={assignees}
        canFilterOwner={context.canReadBroad}
        canReschedule={context.canManageLeadFollowUps}
      />
    </div>
  );
}
