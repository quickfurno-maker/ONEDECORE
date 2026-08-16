import Link from "next/link";
import { redirect } from "next/navigation";
import { getStaffClaims } from "@/server/auth/session";
import {
  probeProjectPermissions,
} from "@/features/projects/server/project-permissions";
import {
  listPendingProjectMaterializations,
  listProjects,
} from "@/features/projects/server/project-queries";
import { ProjectMaterializationRepairQueue } from "@/features/projects/components/handover/ProjectMaterializationRepairQueue";

export const metadata = {
  title: "Projects | OneDecore Admin",
  description: "Phase 8A Closed-Won project conversion and PM handover",
};

export default async function AdminProjectsPage() {
  const session = await getStaffClaims();
  if (!session) {
    redirect("/auth/login?next=%2Fadmin%2Fprojects");
  }
  const permissions = await probeProjectPermissions();
  if (!permissions.canReadProjects && !permissions.canReadDesign) {
    redirect("/auth/forbidden");
  }

  const projects = await listProjects();
  const pending =
    permissions.isSuperAdmin || permissions.isSalesManager
      ? await listPendingProjectMaterializations()
      : [];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-neutral-100">Projects</h1>
        <p className="mt-1 text-xs text-neutral-400">
          Closed-Won conversion, PM handover, and assigned-project design collaboration.
        </p>
      </div>

      {permissions.isSuperAdmin || permissions.isSalesManager ? (
        <ProjectMaterializationRepairQueue rows={pending} />
      ) : null}

      <div className="overflow-hidden rounded-xl border border-neutral-800 bg-neutral-900/60">
        <table className="w-full text-left text-xs">
          <thead className="border-b border-neutral-800 bg-neutral-950 text-[10px] uppercase tracking-wider text-neutral-400">
            <tr>
              <th className="p-3">Project</th>
              <th className="p-3">Status</th>
              <th className="p-3">Quotation</th>
              <th className="p-3">Client</th>
              <th className="p-3">Primary PM</th>
              <th className="p-3">Created</th>
              <th className="p-3 text-right">Open</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-neutral-900 text-neutral-200">
            {projects.length === 0 ? (
              <tr>
                <td colSpan={7} className="p-8 text-center text-neutral-500">
                  No handover projects are visible for your role.
                </td>
              </tr>
            ) : (
              projects.map((project) => (
                <tr key={project.id}>
                  <td className="p-3 font-medium">{project.projectNumber}</td>
                  <td className="p-3">{project.status.replaceAll("_", " ")}</td>
                  <td className="p-3">{project.quotationNumber ?? "—"}</td>
                  <td className="p-3">{project.clientDisplayName ?? "—"}</td>
                  <td className="p-3">{project.primaryPmDisplayName ?? "Unassigned"}</td>
                  <td className="p-3">{new Date(project.createdAt).toLocaleDateString()}</td>
                  <td className="p-3 text-right">
                    <Link
                      href={`/admin/projects/${project.id}`}
                      className="text-amber-300 hover:text-amber-200"
                    >
                      View
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
