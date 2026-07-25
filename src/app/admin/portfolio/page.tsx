import Link from "next/link";
import { getClaims } from "@/server/auth/claims";
import { createClient } from "@/lib/supabase/server";
import { PORTFOLIO_SERVICE_LABELS, type PortfolioServiceCode } from "@/features/portfolio/domain/portfolio-service";

export const dynamic = "force-dynamic";

interface SearchParamsProps {
  searchParams: Promise<{ status?: string }>;
}

export default async function AdminPortfolioListPage({ searchParams }: SearchParamsProps) {
  const claims = await getClaims();
  if (!claims || !claims.isActive || !claims.permissions.includes("portfolio.manage")) {
    return (
      <div className="p-8 text-center">
        <h1 className="text-xl font-semibold text-red-600">Access Denied</h1>
        <p className="mt-2 text-sm text-stone-600">You require portfolio.manage permission to view this page.</p>
      </div>
    );
  }

  const { status: statusFilter } = await searchParams;

  const supabase = await createClient();

  let query = supabase
    .from("portfolio_projects")
    .select(`
      id,
      slug,
      title,
      summary,
      location_label,
      status,
      is_featured,
      sort_order,
      published_at,
      updated_at,
      portfolio_project_services(service_code),
      portfolio_media(id, media_role, status)
    `)
    .order("created_at", { ascending: false });

  if (statusFilter && ["draft", "published", "archived"].includes(statusFilter)) {
    query = query.eq("status", statusFilter);
  }

  const { data: projects, error } = await query;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-serif font-bold text-[#1A1A1A]">Portfolio Management</h1>
          <p className="mt-1 text-sm text-[#666059]">
            Create and edit luxury interior design projects, assign services, and publish completed showcases.
          </p>
        </div>
        <Link
          href="/admin/portfolio/new"
          className="rounded-md bg-[#1A1A1A] px-4 py-2 text-sm font-medium text-white transition hover:bg-[#333333]"
        >
          + Create New Project
        </Link>
      </div>

      {/* Filter Tabs */}
      <div className="flex border-b border-[#E5E0DA]">
        <Link
          href="/admin/portfolio"
          className={`px-4 py-2 text-xs font-medium border-b-2 ${
            !statusFilter ? "border-[#1A1A1A] text-[#1A1A1A]" : "border-transparent text-stone-500 hover:text-stone-700"
          }`}
        >
          All Projects
        </Link>
        <Link
          href="/admin/portfolio?status=draft"
          className={`px-4 py-2 text-xs font-medium border-b-2 ${
            statusFilter === "draft" ? "border-[#1A1A1A] text-[#1A1A1A]" : "border-transparent text-stone-500 hover:text-stone-700"
          }`}
        >
          Drafts
        </Link>
        <Link
          href="/admin/portfolio?status=published"
          className={`px-4 py-2 text-xs font-medium border-b-2 ${
            statusFilter === "published" ? "border-[#1A1A1A] text-[#1A1A1A]" : "border-transparent text-stone-500 hover:text-stone-700"
          }`}
        >
          Published
        </Link>
        <Link
          href="/admin/portfolio?status=archived"
          className={`px-4 py-2 text-xs font-medium border-b-2 ${
            statusFilter === "archived" ? "border-[#1A1A1A] text-[#1A1A1A]" : "border-transparent text-stone-500 hover:text-stone-700"
          }`}
        >
          Archived
        </Link>
      </div>

      {error && (
        <div className="rounded-md bg-red-50 p-4 text-xs text-red-700 border border-red-200">
          Failed to load portfolio projects: {error.message}
        </div>
      )}

      {/* Projects List */}
      {!projects || projects.length === 0 ? (
        <div className="rounded-lg border border-[#E5E0DA] bg-white p-12 text-center">
          <p className="text-sm font-medium text-stone-600">No portfolio projects found.</p>
          <p className="mt-1 text-xs text-stone-400">Create a new draft project to start building your portfolio.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4">
          {projects.map((project) => {
            const services = (project.portfolio_project_services || []) as { service_code: string }[];
            const mediaList = (project.portfolio_media || []) as { id: string; media_role: string; status: string }[];

            const hasReadyCover = mediaList.some((m) => m.media_role === "cover" && m.status === "ready");

            return (
              <div
                key={project.id}
                className="flex items-center justify-between rounded-lg border border-[#E5E0DA] bg-white p-5 shadow-xs transition hover:border-[#C4BDB5]"
              >
                <div className="space-y-1 max-w-2xl">
                  <div className="flex items-center gap-3">
                    <h2 className="text-base font-serif font-semibold text-[#1A1A1A]">{project.title}</h2>
                    <span
                      className={`rounded-full px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider ${
                        project.status === "published"
                          ? "bg-emerald-100 text-emerald-800"
                          : project.status === "archived"
                          ? "bg-stone-200 text-stone-700"
                          : "bg-amber-100 text-amber-800"
                      }`}
                    >
                      {project.status}
                    </span>
                    {project.is_featured && (
                      <span className="rounded bg-amber-50 px-2 py-0.5 text-[10px] font-semibold text-amber-800 border border-amber-200">
                        Featured
                      </span>
                    )}
                  </div>

                  <p className="text-xs text-stone-600 line-clamp-1">{project.summary}</p>

                  <div className="flex items-center gap-4 text-[11px] text-stone-400 pt-1">
                    <span>Slug: <code className="text-stone-700">{project.slug}</code></span>
                    {project.location_label && <span>Location: {project.location_label}</span>}
                    <span>Media: {mediaList.length} items ({hasReadyCover ? "Cover Ready" : "No Ready Cover"})</span>
                  </div>

                  <div className="flex flex-wrap gap-1.5 pt-1">
                    {services.map((s) => (
                      <span
                        key={s.service_code}
                        className="rounded bg-[#F9F7F5] border border-[#E5E0DA] px-2 py-0.5 text-[10px] text-stone-700"
                      >
                        {PORTFOLIO_SERVICE_LABELS[s.service_code as PortfolioServiceCode] || s.service_code}
                      </span>
                    ))}
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  <Link
                    href={`/admin/portfolio/${project.id}`}
                    className="rounded border border-[#E5E0DA] bg-white px-3.5 py-1.5 text-xs font-medium text-[#1A1A1A] hover:bg-[#F9F7F5]"
                  >
                    Edit & Manage →
                  </Link>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
