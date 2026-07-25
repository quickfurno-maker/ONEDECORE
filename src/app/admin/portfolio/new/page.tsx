import Link from "next/link";
import { getClaims } from "@/server/auth/claims";
import { createProjectAction } from "@/features/portfolio/server/portfolio-cms-actions";
import { PortfolioProjectForm } from "@/features/portfolio/components/PortfolioProjectForm";

export const dynamic = "force-dynamic";

export default async function AdminNewPortfolioProjectPage() {
  const claims = await getClaims();
  if (!claims || !claims.isActive || !claims.permissions.includes("portfolio.manage")) {
    return (
      <div className="p-8 text-center">
        <h1 className="text-xl font-semibold text-red-600">Access Denied</h1>
        <p className="mt-2 text-sm text-stone-600">You require portfolio.manage permission to view this page.</p>
      </div>
    );
  }

  return (
    <div className="max-w-3xl space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-serif font-bold text-[#1A1A1A]">Create Portfolio Project</h1>
          <p className="mt-1 text-sm text-[#666059]">
            New portfolio projects are created as drafts. You can upload media and assign services before publishing.
          </p>
        </div>
        <Link
          href="/admin/portfolio"
          className="text-xs text-stone-500 hover:text-stone-800"
        >
          ← Back to Portfolio List
        </Link>
      </div>

      <PortfolioProjectForm
        action={createProjectAction}
        submitLabel="Create draft project"
      />
    </div>
  );
}
