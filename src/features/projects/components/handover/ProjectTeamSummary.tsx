"use client";

import type { HandoverDisplayModel } from "../../handover/ui/build-handover-display-model.ts";

interface ProjectTeamSummaryProps {
  readonly model: HandoverDisplayModel;
}

export function ProjectTeamSummary({ model }: ProjectTeamSummaryProps) {
  const staffing = model.staffing;

  return (
    <section
      aria-label="Project team summary"
      className="rounded-xl border border-neutral-700 bg-neutral-900/60 p-4"
    >
      <h3 className="text-sm font-semibold text-neutral-100">Project team</h3>
      <dl className="mt-3 space-y-3 text-sm">
        <div>
          <dt className="text-neutral-400">Primary project manager</dt>
          <dd className="font-medium text-neutral-100">
            {staffing.primaryProjectManager?.displayName ?? "Not assigned"}
          </dd>
        </div>
        <div>
          <dt className="text-neutral-400">Lead designer</dt>
          <dd className="font-medium text-neutral-100">
            {staffing.leadDesigner?.displayName ?? "Not assigned (Phase 8B)"}
          </dd>
        </div>
        <div>
          <dt className="text-neutral-400">Supporting designers</dt>
          <dd className="font-medium text-neutral-100">
            {staffing.supportingDesigners.length > 0
              ? staffing.supportingDesigners.map((d) => d.displayName).join(", ")
              : "None"}
          </dd>
        </div>
      </dl>
    </section>
  );
}
