import Link from "next/link";
import { notFound } from "next/navigation";
import { getClaims } from "@/server/auth/claims";
import { createClient } from "@/lib/supabase/server";
import { type PortfolioServiceCode } from "@/features/portfolio/domain/portfolio-service";
import { updateProjectAction } from "@/features/portfolio/server/portfolio-cms-actions";
import { PortfolioProjectForm } from "@/features/portfolio/components/PortfolioProjectForm";
import { PortfolioStatusControls } from "@/features/portfolio/components/PortfolioStatusControls";
import { PortfolioMediaManager, type PortfolioMediaItem } from "@/features/portfolio/components/PortfolioMediaManager";
import { PortfolioDeleteProjectButton } from "@/features/portfolio/components/PortfolioDeleteProjectButton";

export const dynamic = "force-dynamic";

interface ProjectEditorPageProps {
  params: Promise<{ projectId: string }>;
}

export default async function AdminPortfolioProjectEditorPage({ params }: ProjectEditorPageProps) {
  const claims = await getClaims();
  if (!claims || !claims.isActive || !claims.permissions.includes("portfolio.manage")) {
    return (
      <div className="p-8 text-center">
        <h1 className="text-xl font-semibold text-red-600">Access Denied</h1>
        <p className="mt-2 text-sm text-stone-600">You require portfolio.manage permission to view this page.</p>
      </div>
    );
  }

  const { projectId } = await params;
  const supabase = await createClient();

  const { data: project } = await supabase
    .from("portfolio_projects")
    .select(`
      *,
      portfolio_project_services(service_code),
      portfolio_media(*)
    `)
    .eq("id", projectId)
    .maybeSingle();

  if (!project) {
    notFound();
  }

  const assignedServices = (project.portfolio_project_services || []).map(
    (s: { service_code: string }) => s.service_code as PortfolioServiceCode
  );

  const mediaItems = ((project.portfolio_media || []) as PortfolioMediaItem[]).sort(
    (a, b) => a.sort_order - b.sort_order
  );

  const hasService = assignedServices.length > 0;
  const hasReadyCover = mediaItems.some((m) => m.media_role === "cover" && m.status === "ready");

  const updateAction = updateProjectAction.bind(null, project.id);

  return (
    <div className="max-w-4xl space-y-8 pb-12">
      <div className="flex items-center justify-between">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-serif font-bold text-[#1A1A1A]">{project.title}</h1>
            <span
              className={`rounded-full px-2.5 py-0.5 text-xs font-semibold uppercase tracking-wider ${
                project.status === "published"
                  ? "bg-emerald-100 text-emerald-800"
                  : project.status === "archived"
                  ? "bg-stone-200 text-stone-700"
                  : "bg-amber-100 text-amber-800"
              }`}
            >
              {project.status}
            </span>
          </div>
          <p className="mt-1 text-xs text-stone-500">
            Project ID: <code className="text-stone-700">{project.id}</code> | Created: {new Date(project.created_at).toLocaleDateString()}
          </p>
        </div>
        <Link href="/admin/portfolio" className="text-xs text-stone-500 hover:text-stone-800">
          ← Back to Portfolio List
        </Link>
      </div>

      {/* Publication Controls Component */}
      <PortfolioStatusControls
        projectId={project.id}
        currentStatus={project.status as "draft" | "published" | "archived"}
        hasService={hasService}
        hasReadyCover={hasReadyCover}
      />

      {/* Metadata Form Component */}
      <PortfolioProjectForm
        action={updateAction}
        submitLabel="Save Metadata Changes"
        initialValues={{
          title: project.title,
          slug: project.slug,
          summary: project.summary,
          description: project.description,
          locationLabel: project.location_label,
          propertyType: project.property_type,
          completionYear: project.completion_year,
          services: assignedServices,
          isFeatured: project.is_featured,
        }}
      />

      {/* Media Gallery Manager Component */}
      <PortfolioMediaManager
        projectId={project.id}
        isPublished={project.status === "published"}
        mediaItems={mediaItems}
      />

      {/* Project Deletion Button Component */}
      <PortfolioDeleteProjectButton
        projectId={project.id}
        projectTitle={project.title}
        isPublished={project.status === "published"}
      />
    </div>
  );
}
