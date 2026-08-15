import { notFound } from "next/navigation";
import { requireStaffPermission } from "@/server/auth";
import { getStaffClaims } from "@/server/auth/session";
import {
  probeProjectPermissions,
  resolveCrmRoleFromProjectProbe,
} from "@/features/projects/server/project-permissions";
import {
  getProjectHandoverDetail,
  listAssignableProjectManagers,
} from "@/features/projects/server/project-queries";
import { buildHandoverDisplayModel } from "@/features/projects/handover/ui/build-handover-display-model";
import { ProjectHandoverWorkspace } from "@/features/projects/components/handover/ProjectHandoverWorkspace";

interface AdminProjectDetailPageProps {
  params: Promise<{ projectId: string }>;
}

export default async function AdminProjectDetailPage({
  params,
}: AdminProjectDetailPageProps) {
  const { projectId } = await params;
  await requireStaffPermission("projects.read", `/admin/projects/${projectId}`);
  const [permissions, session, detail] = await Promise.all([
    probeProjectPermissions(),
    getStaffClaims(),
    getProjectHandoverDetail(projectId),
  ]);

  if (!detail || !session) {
    notFound();
  }

  const role = resolveCrmRoleFromProjectProbe(permissions);
  if (!role || role === "designer") {
    notFound();
  }

  const highLevelOnly = role === "sales_executive";
  const assignableManagers =
    permissions.canAssignPm && !highLevelOnly ? await listAssignableProjectManagers() : [];

  const model = buildHandoverDisplayModel({
    summary: detail.summary,
    handoverState: detail.status,
    commercial: detail.commercial ?? {
      quotationReference: detail.quotationNumber ?? "OD-Q-UNKNOWN",
      revisionNumber: 1,
      acceptedAt: detail.acceptedAt ?? detail.createdAt,
      currency: "INR",
      taxableBasePaise: 0,
      grandTotalPaise: 0,
      grandTotalLabel: "—",
      scopeSummary: null,
      contentHash: detail.acceptedQuotationVersionId,
    },
    staffing: detail.staffing,
    actor: {
      profileId: session.userId,
      role,
      isOwningSalesExecutive: detail.creditedSalesExecutiveId === session.userId,
    },
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-neutral-100">{detail.projectNumber}</h1>
        <p className="mt-1 text-xs text-neutral-400">
          Phase 8A handover workspace. Designer and execution controls are not mounted.
        </p>
      </div>
      <ProjectHandoverWorkspace
        projectId={detail.id}
        model={model}
        assignableManagers={assignableManagers}
        canAssignPm={permissions.canAssignPm && !highLevelOnly}
        canAcceptHandover={permissions.canAcceptHandover && !highLevelOnly}
        canViewBaseline={!highLevelOnly}
        highLevelOnly={highLevelOnly}
        assignments={highLevelOnly ? [] : detail.assignments}
        events={highLevelOnly ? [] : detail.events}
      />
    </div>
  );
}
