import { notFound, redirect } from "next/navigation";
import { getStaffClaims } from "@/server/auth/session";
import { probeLandingLabPermissions } from "@/features/landing-lab/server/landing-permissions";
import { getLandingPageWorkspace } from "@/features/landing-lab/server/landing-queries";
import { LandingPageWorkspaceClient } from "@/features/landing-lab/components/LandingPageWorkspaceClient";

interface AdminLandingPageDetailProps {
  readonly params: Promise<{ pageId: string }>;
}

export default async function AdminLandingPageDetailPage({ params }: AdminLandingPageDetailProps) {
  const { pageId } = await params;
  const session = await getStaffClaims();
  if (!session) {
    redirect("/auth/login?next=%2Fadmin%2Flanding-pages");
  }
  const permissions = await probeLandingLabPermissions();
  if (!permissions.canRead) notFound();
  const workspace = await getLandingPageWorkspace(pageId);
  if (!workspace) notFound();

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold text-neutral-100">{workspace.pageReference}</h1>
        <p className="text-sm text-neutral-300">{workspace.title}</p>
      </div>
      <LandingPageWorkspaceClient
        workspace={workspace}
        canManage={permissions.canManage}
        canPublish={permissions.canPublish}
        canExperiments={permissions.canManageExperiments}
        canAnalytics={permissions.canReadAnalytics}
      />
    </div>
  );
}
