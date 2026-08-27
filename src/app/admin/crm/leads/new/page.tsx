import type { Metadata } from "next";
import Link from "next/link";
import { CrmPageHeader } from "@/features/crm/components/shell/CrmPageHeader";
import { ManualLeadForm } from "@/features/crm/components/leads/ManualLeadForm";
import { requireCrmCreateAccess } from "@/features/crm/server/crm-auth";
import { fetchActiveLeadSources } from "@/features/crm/server/crm-lead-queries";
import {
  fetchManualCreateAssigneeDirectory,
  resolveManualCreateAssigneePolicy,
} from "@/features/crm/server/crm-manual-lead-service";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "New Lead | ONEDECORE CRM",
  description: "Create a single manual CRM lead with duplicate-safe checks.",
};

export default async function CrmNewLeadPage() {
  const context = await requireCrmCreateAccess("/admin/crm/leads/new");
  const [sources, assigneeDirectory] = await Promise.all([
    fetchActiveLeadSources(),
    fetchManualCreateAssigneeDirectory(context),
  ]);

  const assigneePolicy = resolveManualCreateAssigneePolicy(context);

  return (
    <div className="space-y-6">
      <CrmPageHeader
        title="New lead"
        description="Create one manual CRM lead. Duplicate checks run server-side before creation. This does not record marketing or WhatsApp consent."
        actions={
          <Link
            href="/admin/crm/leads"
            className="crm-btn crm-btn-secondary min-h-11"
          >
            Back to leads
          </Link>
        }
      />

      <ManualLeadForm
        sources={sources}
        assigneeDirectory={assigneeDirectory}
        assigneePolicy={assigneePolicy}
        canOverrideDuplicate={context.canOverrideLeadDuplicate}
      />
    </div>
  );
}
