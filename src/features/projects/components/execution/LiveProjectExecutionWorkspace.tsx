"use client";

import { useState, useTransition } from "react";
import { getExecutionStateLabel, getNextMainPathState, isExecutionMainPathState } from "../../execution/contracts/execution-states";
import { EXECUTION_HOLD_REASON_CODES } from "../../execution/domain/hold-delay-contract";
import type { ProjectExecutionWorkspaceData } from "../../server/project-execution-queries";
import {
  cancelProjectExecutionAction,
  completeProjectExecutionAction,
  createProjectExecutionSnagAction,
  getProjectExecutionEvidenceFileUrlAction,
  holdProjectExecutionAction,
  recordProjectExecutionHandoverAction,
  repairProjectExecutionAction,
  resolveProjectExecutionSnagAction,
  resumeProjectExecutionAction,
  startProjectExecutionSnagAction,
  transitionProjectExecutionAction,
} from "../../server/project-execution-actions";
import { ExecutionStageTimeline } from "./ExecutionStageTimeline";

interface LiveProjectExecutionWorkspaceProps {
  readonly workspace: ProjectExecutionWorkspaceData;
  readonly mode: "pm" | "manager";
}

export function LiveProjectExecutionWorkspace({ workspace, mode }: LiveProjectExecutionWorkspaceProps) {
  const [message, setMessage] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const readOnlyTerminal = workspace.state === "completed" || workspace.state === "cancelled";
  const pm = mode === "pm" && !readOnlyTerminal;
  const next =
    workspace.state && isExecutionMainPathState(workspace.state) && workspace.state !== "completed"
      ? getNextMainPathState(workspace.state)
      : null;

  function run(action: () => Promise<{ success: boolean; message?: string }>) {
    startTransition(async () => {
      const result = await action();
      setMessage(result.message ?? (result.success ? "Saved." : "Action failed."));
    });
  }

  return (
    <section className="space-y-4 rounded-xl border border-neutral-700 bg-neutral-900/40 p-4" data-testid="live-project-execution-workspace">
      <header>
        <p className="text-xs uppercase tracking-wide text-neutral-500">Project execution</p>
        <h2 className="mt-1 text-lg font-semibold text-neutral-100">
          {workspace.state ? getExecutionStateLabel(workspace.state) : workspace.initializationStatus.replaceAll("_", " ")}
        </h2>
        {message ? <p className="mt-2 text-sm text-sky-300" role="status">{message}</p> : null}
        {workspace.state === "cancelled" ? (
          <p className="mt-2 text-sm text-red-200">Cancelled — read-only. This does not undo quotation acceptance or commercial history.</p>
        ) : null}
      </header>

      {workspace.initializationStatus === "pending_initialization" && mode === "manager" ? (
        <button
          type="button"
          disabled={pending}
          className="rounded-md bg-sky-700 px-3 py-2 text-sm text-white"
          onClick={() => run(() => repairProjectExecutionAction(workspace.projectId))}
        >
          Repair execution initialization
        </button>
      ) : null}

      {workspace.state ? <ExecutionStageTimeline currentState={workspace.state} /> : null}

      {pm && next && next !== "handover" && next !== "completed" ? (
        <form
          className="space-y-2 rounded-lg border border-neutral-800 p-3"
          action={(formData) => {
            formData.set("projectId", workspace.projectId);
            formData.set("targetState", next);
            run(() => transitionProjectExecutionAction(formData));
          }}
        >
          <p className="text-sm text-neutral-200">Advance to {getExecutionStateLabel(next)}</p>
          {next !== "snag_resolution" ? (
            <>
              <input type="file" name="file" className="block text-sm text-neutral-300" />
              <textarea name="note" minLength={8} placeholder="Offline note (min 8 chars) if no file" className="w-full rounded bg-neutral-950 p-2 text-sm" />
            </>
          ) : null}
          <button type="submit" disabled={pending} className="rounded-md bg-emerald-700 px-3 py-2 text-sm text-white">
            Record transition
          </button>
        </form>
      ) : null}

      {pm && workspace.state !== "on_hold" ? (
        <form
          className="space-y-2 rounded-lg border border-neutral-800 p-3"
          action={(formData) => {
            formData.set("projectId", workspace.projectId);
            run(() => holdProjectExecutionAction(formData));
          }}
        >
          <label className="text-sm text-neutral-200">Hold execution</label>
          <select name="reasonCode" aria-label="Hold reason code" className="w-full rounded bg-neutral-950 p-2 text-sm">
            {EXECUTION_HOLD_REASON_CODES.map((code) => (
              <option key={code} value={code}>{code}</option>
            ))}
          </select>
          <textarea name="reason" minLength={10} maxLength={1000} required placeholder="Hold reason (10-1000 characters)" className="w-full rounded bg-neutral-950 p-2 text-sm" />
          <button type="submit" disabled={pending} className="rounded-md bg-amber-700 px-3 py-2 text-sm text-white">Place on hold</button>
        </form>
      ) : null}

      {pm && workspace.state === "on_hold" ? (
        <button type="button" disabled={pending} className="rounded-md bg-sky-700 px-3 py-2 text-sm text-white" onClick={() => run(() => resumeProjectExecutionAction(workspace.projectId))}>
          Resume execution
        </button>
      ) : null}

      {pm ? (
        <form
          className="space-y-2 rounded-lg border border-neutral-800 p-3"
          action={(formData) => {
            formData.set("projectId", workspace.projectId);
            run(() => createProjectExecutionSnagAction(formData));
          }}
        >
          <p className="text-sm font-medium text-neutral-100">Create snag</p>
          <input name="title" required maxLength={160} placeholder="Title" className="w-full rounded bg-neutral-950 p-2 text-sm" />
          <textarea name="description" required minLength={8} maxLength={2000} placeholder="Description" className="w-full rounded bg-neutral-950 p-2 text-sm" />
          <button type="submit" disabled={pending} className="rounded-md bg-neutral-700 px-3 py-2 text-sm text-white">Create snag</button>
        </form>
      ) : null}

      <ul className="space-y-2">
        {workspace.snags.map((snag) => (
          <li key={snag.id} className="rounded border border-neutral-800 p-3 text-sm text-neutral-200">
            <p className="font-medium">{snag.title} — {snag.status}</p>
            <p className="text-neutral-400">{snag.description}</p>
            {pm && snag.status === "open" ? (
              <button type="button" className="mt-2 text-sky-300" onClick={() => run(() => startProjectExecutionSnagAction(snag.id))}>Start</button>
            ) : null}
            {pm && snag.status !== "resolved" ? (
              <form
                className="mt-2 space-y-2"
                action={(formData) => {
                  formData.set("projectId", workspace.projectId);
                  formData.set("snagId", snag.id);
                  run(() => resolveProjectExecutionSnagAction(formData));
                }}
              >
                <input type="file" name="file" />
                <textarea name="note" placeholder="Resolution note" className="w-full rounded bg-neutral-950 p-2 text-sm" />
                <button type="submit" disabled={pending} className="text-emerald-300">Resolve with evidence</button>
              </form>
            ) : null}
          </li>
        ))}
      </ul>

      {pm && workspace.state === "snag_resolution" ? (
        <form
          className="space-y-2 rounded-lg border border-neutral-800 p-3"
          action={(formData) => {
            formData.set("projectId", workspace.projectId);
            run(() => recordProjectExecutionHandoverAction(formData));
          }}
        >
          <p className="text-sm text-neutral-100">Client handover acknowledgement</p>
          <input type="file" name="file" />
          <textarea name="note" placeholder="Staff-captured acknowledgement note" className="w-full rounded bg-neutral-950 p-2 text-sm" />
          <button type="submit" disabled={pending} className="rounded-md bg-emerald-700 px-3 py-2 text-sm text-white">Enter handover</button>
        </form>
      ) : null}

      {pm && workspace.state === "handover" ? (
        <form
          className="space-y-2 rounded-lg border border-neutral-800 p-3"
          action={(formData) => {
            formData.set("projectId", workspace.projectId);
            run(() => completeProjectExecutionAction(formData));
          }}
        >
          <p className="text-sm text-neutral-100">Separate completion acknowledgement</p>
          <input type="file" name="file" />
          <textarea name="note" placeholder="Completion acknowledgement note" className="w-full rounded bg-neutral-950 p-2 text-sm" />
          <button type="submit" disabled={pending} className="rounded-md bg-emerald-700 px-3 py-2 text-sm text-white">Complete project</button>
        </form>
      ) : null}

      {(mode === "manager" || pm) && !readOnlyTerminal ? (
        <form
          className="space-y-2 rounded-lg border border-red-900/60 p-3"
          action={(formData) => {
            formData.set("projectId", workspace.projectId);
            run(() => cancelProjectExecutionAction(formData));
          }}
        >
          <p className="text-sm text-red-200">Cancel execution — does not undo quotation acceptance or commercial history.</p>
          <textarea name="reason" required minLength={10} placeholder="Cancellation reason (min 10 characters)" className="w-full rounded bg-neutral-950 p-2 text-sm" />
          <button type="submit" disabled={pending} className="rounded-md bg-red-800 px-3 py-2 text-sm text-white">Confirm cancellation</button>
        </form>
      ) : null}

      <div className="space-y-2">
        <h3 className="text-sm font-medium text-neutral-100">Evidence</h3>
        {workspace.evidence.map((item) => (
          <p key={item.id} className="text-xs text-neutral-400">
            {item.evidenceType} / {item.sourceType} / {item.capturedAt}
            {item.note ? ` — ${item.note}` : ""}
            {item.sourceType === "uploaded_artifact" ? (
              <button
                type="button"
                className="ml-2 text-sky-300"
                onClick={() => {
                  startTransition(async () => {
                    const result = await getProjectExecutionEvidenceFileUrlAction(workspace.projectId, item.id);
                    if (result.url) window.open(result.url, "_blank", "noopener,noreferrer");
                    else setMessage(result.message ?? "Could not open evidence.");
                  });
                }}
              >
                Open evidence
              </button>
            ) : null}
          </p>
        ))}
      </div>
    </section>
  );
}

export function ProjectExecutionHighLevelCard(props: {
  readonly projectNumber: string;
  readonly initializationStatus: string;
  readonly executionState: string | null;
  readonly updatedAt: string | null;
}) {
  return (
    <section className="rounded-xl border border-neutral-700 bg-neutral-900/40 p-4" data-testid="execution-high-level-card">
      <p className="text-xs uppercase tracking-wide text-neutral-500">Execution status</p>
      <p className="mt-1 text-sm text-neutral-200">{props.projectNumber}</p>
      <p className="mt-1 text-sm text-neutral-100">{props.executionState ?? props.initializationStatus.replaceAll("_", " ")}</p>
      {props.updatedAt ? <p className="mt-1 text-xs text-neutral-500">Updated {props.updatedAt}</p> : null}
    </section>
  );
}
