import Link from "next/link";
import { redirect } from "next/navigation";
import { getStaffClaims } from "@/server/auth/session";
import { probeLandingLabPermissions } from "@/features/landing-lab/server/landing-permissions";
import { listLandingPages } from "@/features/landing-lab/server/landing-queries";
import { CreateLandingPageForm } from "@/features/landing-lab/components/CreateLandingPageForm";

export const metadata = {
  title: "Landing Pages | OneDecore Admin",
  description: "Phase 9B Landing Page Lab",
};

export default async function AdminLandingPagesPage() {
  const session = await getStaffClaims();
  if (!session) {
    redirect("/auth/login?next=%2Fadmin%2Flanding-pages");
  }
  const permissions = await probeLandingLabPermissions();
  if (!permissions.canRead) {
    redirect("/auth/forbidden");
  }
  const pages = await listLandingPages();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-neutral-100">Landing pages</h1>
        <p className="mt-1 text-xs text-neutral-400">
          Structured Landing Lab — production public serving stays gated off until Phase 10.
        </p>
      </div>
      {permissions.canManage ? <CreateLandingPageForm /> : null}
      <div className="overflow-hidden rounded-xl border border-neutral-800 bg-neutral-900/60">
        <table className="w-full text-left text-xs">
          <thead className="border-b border-neutral-800 bg-neutral-950 text-[10px] uppercase tracking-wider text-neutral-400">
            <tr>
              <th className="p-3">Reference</th>
              <th className="p-3">Title</th>
              <th className="p-3">Slug</th>
              <th className="p-3">Version</th>
              <th className="p-3">Publication</th>
              <th className="p-3">Experiment</th>
              <th className="p-3 text-right">Open</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-neutral-900 text-neutral-200">
            {pages.length === 0 ? (
              <tr>
                <td colSpan={7} className="p-8 text-center text-neutral-500">
                  No landing pages yet.
                </td>
              </tr>
            ) : (
              pages.map((page) => (
                <tr key={page.id}>
                  <td className="p-3 font-medium">{page.pageReference}</td>
                  <td className="p-3">{page.title}</td>
                  <td className="p-3">{page.slug}</td>
                  <td className="p-3">v{page.latestVersionNumber}</td>
                  <td className="p-3">{page.publicationStatus ?? "—"}</td>
                  <td className="p-3">{page.experimentStatus ?? "—"}</td>
                  <td className="p-3 text-right">
                    <Link href={`/admin/landing-pages/${page.id}`} className="text-amber-300 hover:text-amber-200">
                      Open
                    </Link>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
