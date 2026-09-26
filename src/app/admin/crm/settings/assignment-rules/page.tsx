import type { Metadata } from "next";
import { CrmPageHeader } from "@/features/crm/components/shell/CrmPageHeader";
import { AssignmentRulesPanel } from "@/features/crm/components/settings/AssignmentRulesPanel";
import { requireCrmAssignmentRuleAccess } from "@/features/crm/server/crm-auth";
import {
  fetchActiveLeadSources,
  fetchCrmAssigneeDirectory,
} from "@/features/crm/server/crm-lead-queries";
import {
  fetchCrmAutoAssignmentSettingForCurrentUser,
  fetchLeadAssignmentRulesForCurrentUser,
} from "@/features/crm/server/crm-assignment-rule-service";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Assignment Rules | ONEDECORE",
  description: "Configure source-based CRM lead assignment and future website auto-assignment.",
};

export default async function CrmAssignmentRulesPage() {
  const context = await requireCrmAssignmentRuleAccess();
  const [rules, sources, assignees, autoAssignment] = await Promise.all([
    fetchLeadAssignmentRulesForCurrentUser(),
    fetchActiveLeadSources(),
    fetchCrmAssigneeDirectory(context),
    fetchCrmAutoAssignmentSettingForCurrentUser(),
  ]);

  return (
    <div className="space-y-6">
      <CrmPageHeader
        title="Assignment rules"
        description="Define who owns incoming leads. More specific rules win; unmatched leads remain unassigned for manual review."
      />
      <AssignmentRulesPanel
        rules={rules}
        sources={sources}
        assignees={assignees}
        autoAssignment={autoAssignment}
      />
    </div>
  );
}
