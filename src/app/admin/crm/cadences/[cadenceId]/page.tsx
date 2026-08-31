import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { CadenceDraftEditor } from "@/features/crm/components/cadences/CadenceDraftEditor";
import { CadenceLifecycleActions } from "@/features/crm/components/cadences/CadenceLifecycleActions";
import { CadenceStatusBadge } from "@/features/crm/components/cadences/CadenceStatusBadge";
import { CadenceStepList } from "@/features/crm/components/cadences/CadenceStepList";
import { CrmPageHeader } from "@/features/crm/components/shell/CrmPageHeader";
import { requireCrmCadenceAccess } from "@/features/crm/server/crm-auth";
import { fetchCadenceTemplateDetail } from "@/features/crm/server/crm-cadence-queries";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Cadence | ONEDECORE CRM",
  description: "Edit, publish or archive a CRM sales cadence.",
};

interface CrmCadenceDetailPageProps {
  readonly params: Promise<{ cadenceId: string }>;
}

export default async function CrmCadenceDetailPage({
  params,
}: CrmCadenceDetailPageProps) {
  const { cadenceId } = await params;
  await requireCrmCadenceAccess(`/admin/crm/cadences/${cadenceId}`);

  const template = await fetchCadenceTemplateDetail(cadenceId);
  if (!template) {
    notFound();
  }

  const isDraft = template.status === "draft";

  return (
    <div className="space-y-5">
      <Link
        href="/admin/crm/cadences"
        className="crm-btn crm-btn-ghost min-h-10 px-2 text-[13px]"
      >
        ← Back to cadences
      </Link>
      <CrmPageHeader
        title={template.name}
        description={
          template.description ??
          "Ordered follow-up steps that become canonical CRM activities, one at a time."
        }
        actions={<CadenceStatusBadge status={template.status} />}
      />

      <p className="text-xs text-[var(--crm-muted)]">
        {template.stepCount} step{template.stepCount === 1 ? "" : "s"} ·{" "}
        {template.activeEnrollmentCount} live enrollment
        {template.activeEnrollmentCount === 1 ? "" : "s"}
      </p>

      {isDraft ? (
        <CadenceDraftEditor
          templateId={template.id}
          initialName={template.name}
          initialDescription={template.description}
          initialSteps={template.steps}
        />
      ) : (
        <section className="crm-surface p-5">
          <h2 className="text-sm font-semibold text-[var(--crm-text)]">Steps</h2>
          <p className="mt-1 text-xs text-[var(--crm-muted)]">
            Published steps are frozen so live enrollments cannot change under a
            rep. Duplicate this cadence to revise it.
          </p>
          <div className="mt-4">
            <CadenceStepList steps={template.steps} />
          </div>
        </section>
      )}

      <CadenceLifecycleActions template={template} />
    </div>
  );
}
