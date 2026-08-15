"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { HandoverDisplayModel } from "../../handover/ui/build-handover-display-model.ts";
import {
  acceptProjectHandoverAction,
  assignProjectManagerAction,
  getProjectHandoverPdfUrlAction,
} from "../../server/project-actions.ts";
import { ProjectStatusBanner } from "./ProjectStatusBanner.tsx";
import { ProjectHandoverSummary } from "./ProjectHandoverSummary.tsx";
import { ProjectCommercialSummary } from "./ProjectCommercialSummary.tsx";
import { ProjectPMAssignmentPanel } from "./ProjectPMAssignmentPanel.tsx";
import { ProjectHandoverAcceptancePanel } from "./ProjectHandoverAcceptancePanel.tsx";

interface ProjectHandoverWorkspaceProps {
  readonly projectId: string;
  readonly model: HandoverDisplayModel;
  readonly assignableManagers: readonly { id: string; displayName: string }[];
  readonly canAssignPm: boolean;
  readonly canAcceptHandover: boolean;
  readonly canViewBaseline: boolean;
  readonly highLevelOnly: boolean;
  readonly assignments: readonly {
    id: string;
    projectManagerDisplayName: string | null;
    assignedAt: string;
    endedAt: string | null;
    reason: string | null;
  }[];
  readonly events: readonly {
    id: string;
    eventType: string;
    actorKind: string;
    occurredAt: string;
  }[];
}

export function ProjectHandoverWorkspace({
  projectId,
  model,
  assignableManagers,
  canAssignPm,
  canAcceptHandover,
  canViewBaseline,
  highLevelOnly,
  assignments,
  events,
}: ProjectHandoverWorkspaceProps) {
  const router = useRouter();
  const [message, setMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function assign(targetPmProfileId: string) {
    if (!targetPmProfileId) {
      setMessage("Select a project manager first.");
      return;
    }
    setBusy(true);
    const result = await assignProjectManagerAction({
      projectId,
      projectManagerId: targetPmProfileId,
    });
    setBusy(false);
    setMessage(result.success ? (result.unchanged ? "PM already assigned." : "Project manager updated.") : result.message || "Assignment failed.");
    if (result.success) router.refresh();
  }

  async function accept() {
    setBusy(true);
    const result = await acceptProjectHandoverAction({ projectId });
    setBusy(false);
    setMessage(result.success ? "Handover accepted." : result.message || "Acceptance failed.");
    if (result.success) router.refresh();
  }

  async function openPdf() {
    setBusy(true);
    const result = await getProjectHandoverPdfUrlAction({ projectId });
    setBusy(false);
    if (!result.success || !result.url) {
      setMessage(result.message || "PDF is unavailable.");
      return;
    }
    window.open(result.url, "_blank", "noopener,noreferrer");
  }

  return (
    <div className="space-y-6">
      <ProjectStatusBanner model={model} />
      <ProjectHandoverSummary model={model} />
      {highLevelOnly ? (
        <p className="rounded-lg border border-neutral-800 bg-neutral-950/40 p-4 text-sm text-neutral-400">
          High-level status only. Commercial handover workspace is limited to Super Admin, Sales Manager, and the current project manager.
        </p>
      ) : (
        <>
          {model.commercial ? <ProjectCommercialSummary model={model} /> : null}
          {canViewBaseline ? (
            <button
              type="button"
              disabled={busy}
              onClick={() => void openPdf()}
              className="rounded-md border border-amber-600 px-4 py-2 text-sm font-semibold text-amber-100 disabled:opacity-50"
            >
              Open accepted quotation PDF
            </button>
          ) : null}
          {canAssignPm ? (
            <div className="space-y-3">
              {assignableManagers.length > 0 ? (
                <label className="block text-sm text-neutral-200">
                  Assignable project managers
                  <select
                    className="mt-1 block w-full rounded-md border border-neutral-700 bg-neutral-950 px-3 py-2 text-sm"
                    defaultValue=""
                    onChange={(event) => {
                      const input = document.querySelector<HTMLInputElement>(
                        '[aria-label="Target PM profile ID"]'
                      );
                      if (input) input.value = event.target.value;
                    }}
                    aria-label="Assignable project managers"
                  >
                    <option value="">Select a project manager</option>
                    {assignableManagers.map((pm) => (
                      <option key={pm.id} value={pm.id}>
                        {pm.displayName}
                      </option>
                    ))}
                  </select>
                </label>
              ) : null}
              <ProjectPMAssignmentPanel
                model={model}
                disabled={busy}
                onAssignPmRequest={(id) => void assign(id)}
                onReassignPmRequest={(id) => void assign(id)}
              />
            </div>
          ) : null}
          {canAcceptHandover ? (
            <ProjectHandoverAcceptancePanel
              model={model}
              disabled={busy}
              onAcceptHandover={() => void accept()}
              onRequestReassignment={() =>
                setMessage("PM reassignment requests are deferred in Phase 8A.")
              }
            />
          ) : null}
          <section className="rounded-xl border border-neutral-800 bg-neutral-950/40 p-4">
            <h3 className="text-sm font-semibold text-neutral-100">Assignment history</h3>
            <ul className="mt-3 space-y-2 text-sm text-neutral-300">
              {assignments.length === 0 ? (
                <li>No assignment history yet.</li>
              ) : (
                assignments.map((row) => (
                  <li key={row.id}>
                    {row.projectManagerDisplayName || row.id} · {new Date(row.assignedAt).toLocaleString()}
                    {row.endedAt ? ` · ended ${new Date(row.endedAt).toLocaleString()}` : " · current"}
                    {row.reason ? ` · ${row.reason}` : ""}
                  </li>
                ))
              )}
            </ul>
          </section>
          <section className="rounded-xl border border-neutral-800 bg-neutral-950/40 p-4">
            <h3 className="text-sm font-semibold text-neutral-100">Project events</h3>
            <ul className="mt-3 space-y-2 text-sm text-neutral-300">
              {events.length === 0 ? (
                <li>No events yet.</li>
              ) : (
                events.map((row) => (
                  <li key={row.id}>
                    {row.eventType} · {row.actorKind} · {new Date(row.occurredAt).toLocaleString()}
                  </li>
                ))
              )}
            </ul>
          </section>
        </>
      )}
      {message ? (
        <p className="text-sm text-amber-200" role="status">
          {message}
        </p>
      ) : null}
    </div>
  );
}
