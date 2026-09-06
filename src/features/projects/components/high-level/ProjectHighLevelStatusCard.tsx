import type { ProjectHighLevelStatus } from "../../server/project-high-level-queries";

/**
 * The Sales Manager's project view. Read-only by construction.
 *
 * There is no `canX` prop and no action handler anywhere in this file. The
 * manager's boundary is enforced in the database and in the page branch, and
 * this component is built so that adding a control here would be an obvious
 * change rather than a one-line prop.
 */

const label = (value: string | null): string =>
  value ? value.replaceAll("_", " ") : "—";

function money(paise: number | null, currency: string | null): string {
  if (paise === null) {
    return "—";
  }
  const amount = (paise / 100).toLocaleString("en-IN", {
    maximumFractionDigits: 0,
  });
  return `${currency ?? "INR"} ${amount}`;
}

function date(value: string | null): string {
  return value ? new Date(value).toLocaleDateString() : "—";
}

function Field({ name, value }: { name: string; value: string }) {
  return (
    <div>
      <dt className="text-[10px] uppercase tracking-wider text-neutral-500">{name}</dt>
      <dd className="mt-1 text-sm text-neutral-100">{value}</dd>
    </div>
  );
}

export function ProjectHighLevelStatusCard({
  project,
}: {
  project: ProjectHighLevelStatus;
}) {
  return (
    <section className="space-y-6 rounded-xl border border-neutral-800 bg-neutral-900/60 p-5">
      <header>
        <h2 className="text-sm font-semibold text-neutral-100">Project status</h2>
        <p className="mt-1 text-[11px] text-neutral-400">
          Sales visibility. Project execution is managed by the assigned Project
          Manager.
        </p>
      </header>

      <dl className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
        <Field name="Project" value={project.projectNumber} />
        <Field name="Client" value={project.clientDisplayName ?? "—"} />
        <Field name="Stage" value={label(project.status)} />
        <Field name="Quotation" value={project.quotationNumber ?? "—"} />
        <Field
          name="Commercial value"
          value={money(project.commercialGrandTotalPaise, project.commercialCurrency)}
        />
        <Field
          name="Project Manager"
          value={project.currentProjectManager ?? "Unassigned"}
        />
        <Field
          name="Lead Designer"
          value={project.currentLeadDesigner ?? "Unassigned"}
        />
        <Field name="Created" value={date(project.createdAt)} />
        <Field name="Handover accepted" value={date(project.handoverAcceptedAt)} />
      </dl>

      <div className="grid gap-5 border-t border-neutral-800 pt-5 sm:grid-cols-2">
        <dl className="space-y-4">
          <Field name="Design" value={label(project.designState)} />
          <Field name="Design started" value={date(project.designStartedAt)} />
          <Field name="Design completed" value={date(project.designCompletedAt)} />
        </dl>
        <dl className="space-y-4">
          <Field
            name="Execution"
            value={label(project.executionInitializationStatus)}
          />
          <Field name="Execution state" value={label(project.executionState)} />
          <Field name="Execution updated" value={date(project.executionUpdatedAt)} />
        </dl>
      </div>
    </section>
  );
}
