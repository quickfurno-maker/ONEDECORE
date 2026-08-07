"use client";

import type { ProjectStaffingSnapshot } from "../../contracts/assignment.ts";
import type { CrmRoleCode } from "../../../crm/contracts/permissions.ts";

export interface DesignerTeamPanelCallbacks {
  readonly onAssignLead?: (profileId: string) => void;
  readonly onAssignSupporting?: (profileId: string) => void;
  readonly onRemoveLead?: () => void;
  readonly onRemoveSupporting?: (profileId: string) => void;
  readonly onRequestAssignment?: () => void;
}

export interface DesignerTeamPanelProps {
  readonly staffing: ProjectStaffingSnapshot;
  readonly actorRole: CrmRoleCode;
  readonly callbacks?: DesignerTeamPanelCallbacks;
}

export function DesignerTeamPanel({
  staffing,
  actorRole,
  callbacks,
}: DesignerTeamPanelProps) {
  const canAssign =
    actorRole === "sales_manager" || actorRole === "super_admin";
  const canRequest = actorRole === "project_manager";

  return (
    <section
      aria-label="Designer team"
      className="rounded-lg border border-neutral-800 bg-neutral-900/40 p-4"
    >
      <h2 className="text-sm font-semibold text-neutral-100">Designer team</h2>

      <div className="mt-3 space-y-2 text-sm text-neutral-300">
        <p>
          Lead: {staffing.leadDesigner?.displayName ?? "Unassigned"}
        </p>
        <p>
          Supporting:{" "}
          {staffing.supportingDesigners.length > 0
            ? staffing.supportingDesigners.map((d) => d.displayName).join(", ")
            : "None"}
        </p>
      </div>

      <div className="mt-4 flex flex-wrap gap-2">
        {canAssign && callbacks?.onAssignLead ? (
          <button
            type="button"
            className="rounded-md bg-emerald-600 px-3 py-2 text-sm text-white"
            onClick={() => callbacks.onAssignLead?.("ld-candidate")}
          >
            Assign lead designer
          </button>
        ) : null}
        {canAssign && callbacks?.onAssignSupporting ? (
          <button
            type="button"
            className="rounded-md border border-neutral-700 px-3 py-2 text-sm text-neutral-200"
            onClick={() => callbacks.onAssignSupporting?.("sd-candidate")}
          >
            Add supporting designer
          </button>
        ) : null}
        {canRequest && callbacks?.onRequestAssignment ? (
          <button
            type="button"
            className="rounded-md border border-neutral-700 px-3 py-2 text-sm text-neutral-200"
            onClick={() => callbacks.onRequestAssignment?.()}
          >
            Request designer assignment
          </button>
        ) : null}
      </div>
    </section>
  );
}
