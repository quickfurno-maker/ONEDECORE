import type { Metadata } from "next";
import { CrmPageHeader } from "@/features/crm/components/shell/CrmPageHeader";
import { AssignmentRulesPanel } from "@/features/crm/components/settings/AssignmentRulesPanel";
import { requireCrmAssignmentRuleAccess } from "@/features/crm/server/crm-auth";
import {
  fetchActiveLeadSources,
  fetchCrmAssigneeDirectory,
} from "@/features/crm/server/crm-lead-queries";
import { fetchLeadAssignmentRulesForCurrentUser } from "@/features/crm/server/crm-assignment-rule-service";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Assignment Rules | ONEDECORE",
  description: "Configure source-based lead assignment rules for bulk imports.",
};

export default async function CrmAssignmentRulesPage() {
  const context = await requireCrmAssignmentRuleAccess();
  const [rules, sources, assignees] = await Promise.all([
    fetchLeadAssignmentRulesForCurrentUser(),
    fetchActiveLeadSources(),
    fetchCrmAssigneeDirectory(context),
  ]);

  return (
    <div className="space-y-6">
      <CrmPageHeader
        title="Assignment rules"
        description="Rules resolve assignees during bulk import validation. More specific matches win; unmatched leads remain unassigned."
      />
      <AssignmentRulesPanel
        rules={rules}
        sources={sources}
        assignees={assignees}
      />
    </div>
  );
}
