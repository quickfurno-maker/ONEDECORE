import { notFound, redirect } from "next/navigation";
import { getStaffClaims } from "@/server/auth/session";
import {
  probeProjectPermissions,
  resolveCrmRoleFromProjectProbe,
} from "@/features/projects/server/project-permissions";
import {
  getProjectHandoverDetail,
  listAssignableProjectManagers,
} from "@/features/projects/server/project-queries";
import {
  getProjectDesignHighLevelStatus,
  getProjectDesignWorkspace,
} from "@/features/projects/server/project-design-queries";
import { buildHandoverDisplayModel } from "@/features/projects/handover/ui/build-handover-display-model";
import { ProjectHandoverWorkspace } from "@/features/projects/components/handover/ProjectHandoverWorkspace";
import { ProjectDesignWorkspace } from "@/features/projects/components/design/ProjectDesignWorkspace";

interface AdminProjectDetailPageProps {
  params: Promise<{ projectId: string }>;
}

export default async function AdminProjectDetailPage({
  params,
}: AdminProjectDetailPageProps) {
  const { projectId } = await params;
  const session = await getStaffClaims();
  if (!session) {
    redirect(`/auth/login?next=${encodeURIComponent(`/admin/projects/${projectId}`)}`);
  }
  const [permissions, detail] = await Promise.all([
    probeProjectPermissions(),
    getProjectHandoverDetail(projectId),
  ]);

  if (!permissions.canReadProjects && !permissions.canReadDesign) {
    redirect("/auth/forbidden");
  }

  if (!detail) {
    notFound();
  }

  const role = resolveCrmRoleFromProjectProbe(permissions);
  if (!role) {
    notFound();
  }

  const highLevelOnly = role === "sales_executive";
  const designWorkspace =
    !highLevelOnly && detail.status === "handover_accepted"
      ? await getProjectDesignWorkspace(projectId, permissions.canStaffDesigners)
      : null;
  const highLevelDesign =
    highLevelOnly ? await getProjectDesignHighLevelStatus(projectId) : null;

  if (role === "designer" && !designWorkspace) {
    notFound();
  }
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
          Phase 8A handover plus Phase 8B design collaboration. Execution controls are not mounted.
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
      {highLevelOnly && highLevelDesign ? (
        <ProjectDesignWorkspace
          workspace={{
            projectId,
            workflowState: highLevelDesign.state,
            heldFromState: null,
            revisionReturnState: null,
            startedAt: highLevelDesign.startedAt,
            completedAt: highLevelDesign.completedAt,
            staffing: { leadDesigner: null, supportingDesigners: [] },
            deliverables: [],
            evidence: [],
            assignableDesigners: [],
          }}
          actorProfileId={session.userId}
          actorRole={role}
          isAssignedPrimaryPm={detail.primaryPmId === session.userId}
          highLevelOnly
        />
      ) : null}
      {designWorkspace ? (
        <ProjectDesignWorkspace
          workspace={designWorkspace}
          actorProfileId={session.userId}
          actorRole={role}
          isAssignedPrimaryPm={detail.primaryPmId === session.userId}
        />
      ) : null}
    </div>
  );
}
