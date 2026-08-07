"use client";

import type { ProjectStaffingSnapshot } from "../../contracts/assignment.ts";

interface ProjectTeamPanelProps {
  readonly staffing: ProjectStaffingSnapshot;
}

function roleLabel(role: string): string {
  return role.replaceAll("_", " ");
}

export function ProjectTeamPanel({ staffing }: ProjectTeamPanelProps) {
  return (
    <section
      aria-label="Project team"
      className="rounded-xl border border-neutral-700 bg-neutral-900/50 p-4"
    >
      <h2 className="text-sm font-semibold text-neutral-100">Project team</h2>
      <dl className="mt-3 space-y-3 text-sm">
        <div>
          <dt className="text-neutral-500">Primary project manager</dt>
          <dd className="font-medium text-neutral-100">
            {staffing.primaryProjectManager?.displayName ?? "Unassigned"}
          </dd>
        </div>
        <div>
          <dt className="text-neutral-500">Lead designer</dt>
          <dd className="font-medium text-neutral-100">
            {staffing.leadDesigner?.displayName ?? "Unassigned"}
          </dd>
        </div>
        <div>
          <dt className="text-neutral-500">Supporting designers</dt>
          <dd className="font-medium text-neutral-100">
            {staffing.supportingDesigners.length > 0
              ? staffing.supportingDesigners.map((designer) => designer.displayName).join(", ")
              : "None assigned"}
          </dd>
        </div>
      </dl>
      <ul className="sr-only" role="list">
        {staffing.primaryProjectManager ? (
          <li>
            {staffing.primaryProjectManager.displayName} —{" "}
            {roleLabel(staffing.primaryProjectManager.role)}
          </li>
        ) : null}
        {staffing.leadDesigner ? (
          <li>
            {staffing.leadDesigner.displayName} — {roleLabel(staffing.leadDesigner.role)}
          </li>
        ) : null}
        {staffing.supportingDesigners.map((designer) => (
          <li key={designer.staffProfileId}>
            {designer.displayName} — {roleLabel(designer.role)}
          </li>
        ))}
      </ul>
    </section>
  );
}
