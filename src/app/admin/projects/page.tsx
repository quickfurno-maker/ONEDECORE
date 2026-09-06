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
import { listProjectHighLevelStatus } from "@/features/projects/server/project-high-level-queries";
import { ProjectMaterializationRepairQueue } from "@/features/projects/components/handover/ProjectMaterializationRepairQueue";

export const metadata = {
  title: "Projects | OneDecore Admin",
  description: "Phase 8A Closed-Won project conversion and PM handover",
};

export default async function AdminProjectsPage() {
  const session = await getStaffClaims();
  if (!session) {
    redirect("/auth/login?portal=admin&next=%2Fadmin%2Fprojects");
  }
  const permissions = await probeProjectPermissions();

  /*
   * THE SALES MANAGER BRANCH, TAKEN BEFORE ANY OPERATIONAL QUERY RUNS.
   *
   * A manager holds `projects.read_high_level` and neither `projects.read` nor
   * `project_design.read`, so every query below this branch would return an
   * empty list for them — RLS on `projects` is keyed on the permission they no
   * longer have. Falling through would show them an empty operational page and
   * a repair queue they have no business operating.
   *
   * So the branch returns early with its own narrow read model. It is the whole
   * page for this role: no repair queue, no pending materialisations, no
   * controls.
   */
  const highLevelOnly =
    !permissions.canReadProjects &&
    !permissions.canReadDesign &&
    permissions.canReadProjectsHighLevel;

  if (highLevelOnly) {
    const statuses = await listProjectHighLevelStatus();

    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-neutral-100">Project Status</h1>
          <p className="mt-1 text-xs text-neutral-400">
            Sales visibility of live projects. Execution is managed by the assigned
            Project Manager.
          </p>
        </div>

        <div className="overflow-hidden rounded-xl border border-neutral-800 bg-neutral-900/60">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="border-b border-neutral-800 bg-neutral-950 text-[10px] uppercase tracking-wider text-neutral-400">
                <tr>
                  <th className="p-3">Project</th>
                  <th className="p-3">Stage</th>
                  <th className="p-3">Quotation</th>
                  <th className="p-3">Client</th>
                  <th className="p-3">Project Manager</th>
                  <th className="p-3">Created</th>
                  <th className="p-3 text-right">Open</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-900 text-neutral-200">
                {statuses.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="p-8 text-center text-neutral-500">
                      No projects yet.
                    </td>
                  </tr>
                ) : (
                  statuses.map((project) => (
                    <tr key={project.projectId}>
                      <td className="p-3 font-medium">{project.projectNumber}</td>
                      <td className="p-3">{project.status.replaceAll("_", " ")}</td>
                      <td className="p-3">{project.quotationNumber ?? "—"}</td>
                      <td className="p-3">{project.clientDisplayName ?? "—"}</td>
                      <td className="p-3">
                        {project.currentProjectManager ?? "Unassigned"}
                      </td>
                      <td className="p-3">
                        {new Date(project.createdAt).toLocaleDateString()}
                      </td>
                      <td className="p-3 text-right">
                        <Link
                          href={`/admin/projects/${project.projectId}`}
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
      </div>
    );
  }

  if (!permissions.canReadProjects && !permissions.canReadDesign) {
    redirect("/auth/forbidden");
  }

  const projects = await listProjects();
  /*
   * Repairing a stuck Closed-Won materialisation is an owner operation. The
   * Sales Manager was included here, which made them a project repair operator
   * — a role they never had.
   */
  const pending = permissions.isSuperAdmin
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

      {permissions.isSuperAdmin ? (
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
