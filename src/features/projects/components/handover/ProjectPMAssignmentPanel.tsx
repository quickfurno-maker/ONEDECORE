"use client";

import { useState } from "react";
import type { HandoverDisplayModel } from "../../handover/ui/build-handover-display-model.ts";

interface ProjectPMAssignmentPanelProps {
  readonly model: HandoverDisplayModel;
  readonly disabled?: boolean;
  readonly onAssignPmRequest: (targetPmProfileId: string) => void;
  readonly onReassignPmRequest: (targetPmProfileId: string) => void;
}

export function ProjectPMAssignmentPanel({
  model,
  disabled = false,
  onAssignPmRequest,
  onReassignPmRequest,
}: ProjectPMAssignmentPanelProps) {
  const [targetPmProfileId, setTargetPmProfileId] = useState("");
  const showAssign = model.canShowAssignPm;
  const showReassign = model.canShowReassignPm;

  if (!showAssign && !showReassign) {
    return (
      <section
        aria-label="Project manager assignment"
        className="rounded-xl border border-neutral-800 bg-neutral-950/40 p-4 text-sm text-neutral-400"
      >
        PM assignment is not available for your role or current handover state.
      </section>
    );
  }

  return (
    <section
      aria-label="Project manager assignment"
      className="rounded-xl border border-neutral-700 bg-neutral-900/50 p-4"
    >
      <h3 className="text-sm font-semibold text-neutral-100">Primary project manager</h3>
      {model.primaryPmDisplayName ? (
        <p className="mt-2 text-sm text-neutral-200">
          Currently assigned: <span className="font-medium">{model.primaryPmDisplayName}</span>
        </p>
      ) : (
        <p className="mt-2 text-sm text-neutral-400">No primary PM assigned yet.</p>
      )}
      <label className="mt-4 block text-sm text-neutral-200">
        Target PM profile ID
        <input
          type="text"
          className="mt-1 block w-full rounded-md border border-neutral-700 bg-neutral-950 px-3 py-2 text-sm"
          placeholder="pm-profile-id"
          aria-label="Target PM profile ID"
          value={targetPmProfileId}
          onChange={(event) => setTargetPmProfileId(event.target.value)}
        />
      </label>
      <div className="mt-4 flex flex-wrap gap-3">
        {showAssign ? (
          <button
            type="button"
            disabled={disabled}
            className="rounded-md bg-amber-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
            onClick={() => onAssignPmRequest(targetPmProfileId.trim())}
          >
            Assign PM
          </button>
        ) : null}
        {showReassign ? (
          <button
            type="button"
            disabled={disabled}
            className="rounded-md border border-amber-600 px-4 py-2 text-sm font-semibold text-amber-100 disabled:opacity-50"
            onClick={() => onReassignPmRequest(targetPmProfileId.trim())}
          >
            Reassign PM
          </button>
        ) : null}
      </div>
    </section>
  );
}
