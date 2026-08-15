"use client";

import { useState, useTransition } from "react";
import { getDesignStateLabel } from "../../contracts/design-states";
import { getPermittedDesignTransitions } from "../../design/domain/design-state-machine";
import { resolveProjectPermissionCapabilities } from "../../contracts/permissions";
import type { CrmRoleCode } from "../../../crm/contracts/permissions";
import { DesignStageTimeline } from "./DesignStageTimeline";
import { DesignHoldBanner } from "./DesignHoldBanner";
import { DesignRevisionPanel } from "./DesignRevisionPanel";
import { ClientApprovalPanel } from "./ClientApprovalPanel";
import { ProductionReadyPanel } from "./ProductionReadyPanel";
import type { ProjectDesignWorkspaceData } from "../../server/project-design-queries";
import {
  addProjectSupportingDesignerAction,
  approveProjectProductionReadyAction,
  completeProjectDesignAction,
  getProjectDesignFileUrlAction,
  holdProjectDesignAction,
  recordProjectClientApprovalAction,
  removeProjectDesignerAssignmentAction,
  resumeProjectDesignAction,
  setProjectLeadDesignerAction,
  transitionProjectDesignAction,
  uploadProjectDesignDeliverableAction,
} from "../../server/project-design-actions";

export interface ProjectDesignWorkspaceProps {
  readonly workspace: ProjectDesignWorkspaceData;
  readonly actorProfileId: string;
  readonly actorRole: CrmRoleCode;
  readonly isAssignedPrimaryPm?: boolean;
  readonly highLevelOnly?: boolean;
}

export function ProjectDesignWorkspace({
  workspace,
  actorProfileId,
  actorRole,
  isAssignedPrimaryPm = false,
  highLevelOnly = false,
}: ProjectDesignWorkspaceProps) {
  const [message, setMessage] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const caps = resolveProjectPermissionCapabilities({
    profileId: actorProfileId,
    role: actorRole,
    isAssignedPrimaryPm,
    isAssignedLeadDesigner:
      actorRole === "designer" &&
      workspace.staffing.leadDesigner?.staffProfileId === actorProfileId,
    isAssignedSupportingDesigner:
      actorRole === "designer" &&
      workspace.staffing.supportingDesigners.some((d) => d.staffProfileId === actorProfileId),
    isOwningSalesExecutive: actorRole === "sales_executive",
  });

  if (highLevelOnly) {
    return (
      <section className="rounded-xl border border-neutral-800 bg-neutral-950/60 p-6">
        <h2 className="text-sm font-semibold text-neutral-100">Design status</h2>
        <p className="mt-2 text-sm text-neutral-300">
          {workspace.workflowState
            ? getDesignStateLabel(workspace.workflowState)
            : "Design has not started."}
        </p>
      </section>
    );
  }

  const permitted = workspace.workflowState
    ? getPermittedDesignTransitions(workspace.workflowState, {
        heldFromState: workspace.heldFromState ?? undefined,
        revisionReturnState: workspace.revisionReturnState ?? undefined,
      }).filter(
        (state) =>
          state !== "client_approved" &&
          state !== "design_on_hold" &&
          state !== "production_ready" &&
          state !== "design_completed"
      )
    : [];

  function run(label: string, action: () => Promise<{ success: boolean; message?: string }>) {
    startTransition(async () => {
      const result = await action();
      setMessage(result.success ? `${label} saved.` : result.message ?? `${label} failed.`);
    });
  }

  return (
    <section aria-label="Design workspace" className="space-y-6 rounded-xl border border-neutral-800 bg-neutral-950/60 p-6">
      <header>
        <h2 className="text-lg font-semibold text-neutral-100">Design collaboration</h2>
        <p className="mt-1 text-sm text-neutral-300">
          {workspace.workflowState
            ? `Current stage: ${getDesignStateLabel(workspace.workflowState)}`
            : "No design workflow until a Lead Designer is assigned."}
        </p>
      </header>

      {workspace.workflowState === "design_on_hold" && workspace.heldFromState ? (
        <DesignHoldBanner
          heldFromLabel={getDesignStateLabel(workspace.heldFromState)}
          reason={null}
          callbacks={
            caps.canHoldOrResumeDesign
              ? {
                  onResume: () =>
                    run("Resume", () =>
                      resumeProjectDesignAction({
                        projectId: workspace.projectId,
                        reason: "Resume from hold after review",
                      })
                    ),
                }
              : undefined
          }
        />
      ) : null}

      <div className="rounded-lg border border-neutral-800 bg-neutral-900/40 p-4">
        <h3 className="text-sm font-semibold text-neutral-100">Designer team</h3>
        <p className="mt-2 text-sm text-neutral-300">
          Lead: {workspace.staffing.leadDesigner?.displayName ?? "Unassigned"}
        </p>
        <p className="text-sm text-neutral-300">
          Supporting:{" "}
          {workspace.staffing.supportingDesigners.length
            ? workspace.staffing.supportingDesigners.map((d) => d.displayName).join(", ")
            : "None"}
        </p>
        {caps.canAssignDesigners ? (
          <StaffingControls workspace={workspace} onMessage={setMessage} pending={pending} />
        ) : null}
      </div>

      {workspace.workflowState ? (
        <DesignStageTimeline
          currentState={workspace.workflowState}
          permittedTransitions={caps.canUpdateDesignWorkflow ? permitted : []}
          callbacks={
            caps.canUpdateDesignWorkflow
              ? {
                  onSelectStage: (state) =>
                    run("Transition", () =>
                      transitionProjectDesignAction({
                        projectId: workspace.projectId,
                        targetState: state,
                      })
                    ),
                }
              : undefined
          }
        />
      ) : null}

      {caps.canUpdateDesignWorkflow &&
      workspace.workflowState &&
      ["internal_review", "client_review"].includes(workspace.workflowState) ? (
        <DesignRevisionPanel
          callbacks={{
            onSubmitRevision: (returnState, note) =>
              transitionProjectDesignAction({
                projectId: workspace.projectId,
                targetState: "revision_required",
                revisionReturnState: returnState,
                reason: note,
              }),
          }}
        />
      ) : null}

      {caps.canRecordClientApproval && workspace.workflowState === "client_review" ? (
        <ClientApprovalPanel
          projectReference={workspace.projectId}
          callbacks={{
            onApprove: (note) =>
              recordProjectClientApprovalAction({
                projectId: workspace.projectId,
                sourceType: "offline_note",
                note: note ?? "Client approved design package offline.",
              }),
          }}
        />
      ) : null}

      {caps.canHoldOrResumeDesign && workspace.workflowState && workspace.workflowState !== "design_completed" ? (
        <HoldForm
          onHold={(reason) =>
            run("Hold", () => holdProjectDesignAction({ projectId: workspace.projectId, reason }))
          }
        />
      ) : null}

      {(caps.canUpdateDesignWorkflow || caps.canReadFullProjectWorkspace) && actorRole === "designer" ? (
        <DeliverableUpload
          projectId={workspace.projectId}
          onUploaded={setMessage}
        />
      ) : null}

      <DeliverableList
        rows={workspace.deliverables}
        onOpen={async (versionId) => {
          const signed = await getProjectDesignFileUrlAction({
            projectId: workspace.projectId,
            versionId,
          });
          if (signed.url) window.open(signed.url, "_blank", "noopener,noreferrer");
          else setMessage(signed.message ?? "File could not be opened.");
        }}
      />

      <ul className="space-y-1 text-sm text-neutral-400">
        {workspace.evidence.map((item) => (
          <li key={item.id}>
            {item.evidenceType} via {item.sourceType}
          </li>
        ))}
      </ul>

      {caps.canApproveProductionReady && workspace.workflowState === "production_drawings" ? (
        <ProductionReadyPanel
          leadDesignerName={workspace.staffing.leadDesigner?.displayName ?? null}
          callbacks={{
            onApproveProductionReady: (note) =>
              approveProjectProductionReadyAction({
                projectId: workspace.projectId,
                note,
              }),
          }}
        />
      ) : null}

      {caps.canCompleteDesign && workspace.workflowState === "production_ready" ? (
        <button
          type="button"
          disabled={pending}
          className="rounded-md bg-emerald-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
          onClick={() =>
            run("Design completed", () =>
              completeProjectDesignAction({ projectId: workspace.projectId })
            )
          }
        >
          Mark design completed
        </button>
      ) : null}

      {message ? (
        <p role="status" aria-live="polite" className="text-sm text-neutral-400">
          {message}
        </p>
      ) : null}
    </section>
  );
}

function StaffingControls({
  workspace,
  onMessage,
  pending,
}: {
  workspace: ProjectDesignWorkspaceData;
  onMessage: (value: string) => void;
  pending: boolean;
}) {
  const [designerId, setDesignerId] = useState(workspace.assignableDesigners[0]?.id ?? "");
  return (
    <div className="mt-3 flex flex-wrap gap-2">
      <select
        className="rounded-md border border-neutral-700 bg-neutral-950 px-2 py-1 text-sm"
        value={designerId}
        onChange={(event) => setDesignerId(event.target.value)}
        aria-label="Assignable designer"
      >
        {workspace.assignableDesigners.map((designer) => (
          <option key={designer.id} value={designer.id}>
            {designer.displayName}
          </option>
        ))}
      </select>
      <button
        type="button"
        disabled={pending || !designerId}
        className="rounded-md bg-emerald-600 px-3 py-2 text-sm text-white disabled:opacity-50"
        onClick={async () => {
          const result = await setProjectLeadDesignerAction({
            projectId: workspace.projectId,
            designerId,
          });
          onMessage(result.success ? "Lead designer updated." : result.message ?? "Failed.");
        }}
      >
        Set lead
      </button>
      <button
        type="button"
        disabled={pending || !designerId}
        className="rounded-md border border-neutral-700 px-3 py-2 text-sm text-neutral-200 disabled:opacity-50"
        onClick={async () => {
          const result = await addProjectSupportingDesignerAction({
            projectId: workspace.projectId,
            designerId,
          });
          onMessage(result.success ? "Supporting designer added." : result.message ?? "Failed.");
        }}
      >
        Add supporting
      </button>
      {workspace.staffing.leadDesigner ? (
        <button
          type="button"
          className="rounded-md border border-neutral-700 px-3 py-2 text-sm text-neutral-200"
          onClick={async () => {
            const result = await removeProjectDesignerAssignmentAction({
              projectId: workspace.projectId,
              designerId: workspace.staffing.leadDesigner!.staffProfileId,
              reason: "Lead designer removed by staffing authority",
            });
            onMessage(result.success ? "Lead removed." : result.message ?? "Failed.");
          }}
        >
          Remove lead
        </button>
      ) : null}
    </div>
  );
}

function HoldForm({ onHold }: { onHold: (reason: string) => void }) {
  const [reason, setReason] = useState("");
  return (
    <div className="rounded-lg border border-neutral-800 p-4">
      <label className="block text-sm text-neutral-300">
        Hold reason
        <input
          className="mt-1 w-full rounded-md border border-neutral-700 bg-neutral-950 px-3 py-2 text-sm"
          value={reason}
          onChange={(event) => setReason(event.target.value)}
        />
      </label>
      <button
        type="button"
        className="mt-2 rounded-md border border-amber-700 px-3 py-2 text-sm text-amber-100"
        onClick={() => onHold(reason)}
      >
        Place design on hold
      </button>
    </div>
  );
}

function DeliverableUpload({
  projectId,
  onUploaded,
}: {
  projectId: string;
  onUploaded: (message: string) => void;
}) {
  const [key, setKey] = useState("measurement-sheet");
  const [kind, setKind] = useState("measurement_sheet");
  const [label, setLabel] = useState("Measurement sheet");
  return (
    <form
      className="rounded-lg border border-neutral-800 p-4 space-y-2"
      onSubmit={async (event) => {
        event.preventDefault();
        const form = event.currentTarget;
        const fileInput = form.elements.namedItem("design-file") as HTMLInputElement;
        const file = fileInput.files?.[0];
        if (!file) {
          onUploaded("Choose a file first.");
          return;
        }
        const result = await uploadProjectDesignDeliverableAction({
          projectId,
          deliverableKey: key,
          kind,
          label,
          file,
        });
        onUploaded(result.success ? "Deliverable uploaded." : result.message ?? "Upload failed.");
      }}
    >
      <h3 className="text-sm font-semibold text-neutral-100">Upload design deliverable</h3>
      <input
        className="w-full rounded-md border border-neutral-700 bg-neutral-950 px-3 py-2 text-sm"
        value={key}
        onChange={(event) => setKey(event.target.value)}
        aria-label="Deliverable key"
      />
      <select
        className="w-full rounded-md border border-neutral-700 bg-neutral-950 px-3 py-2 text-sm"
        value={kind}
        onChange={(event) => setKind(event.target.value)}
        aria-label="Deliverable kind"
      >
        <option value="measurement_sheet">Measurement sheet</option>
        <option value="concept_board">Concept board</option>
        <option value="client_presentation">Client presentation</option>
        <option value="production_drawing">Production drawing</option>
        <option value="approval_pack">Approval pack</option>
      </select>
      <input
        className="w-full rounded-md border border-neutral-700 bg-neutral-950 px-3 py-2 text-sm"
        value={label}
        onChange={(event) => setLabel(event.target.value)}
        aria-label="Deliverable label"
      />
      <input type="file" name="design-file" accept="application/pdf,image/jpeg,image/png,image/webp" />
      <button type="submit" className="rounded-md bg-neutral-100 px-3 py-2 text-sm text-neutral-950">
        Upload version
      </button>
    </form>
  );
}

function DeliverableList({
  rows,
  onOpen,
}: {
  rows: ProjectDesignWorkspaceData["deliverables"];
  onOpen: (versionId: string) => void;
}) {
  if (rows.length === 0) {
    return <p className="text-sm text-neutral-500">No design deliverables yet.</p>;
  }
  return (
    <ul className="space-y-2 text-sm text-neutral-300">
      {rows.map((row) => (
        <li key={row.id} className="flex items-center justify-between rounded-md border border-neutral-800 px-3 py-2">
          <span>
            {row.label} v{row.versionNumber} ({row.uploadStatus}
            {row.isCurrent ? ", current" : ""})
          </span>
          {row.uploadStatus === "ready" ? (
            <button type="button" className="text-emerald-300 underline" onClick={() => onOpen(row.id)}>
              Open
            </button>
          ) : null}
        </li>
      ))}
    </ul>
  );
}
