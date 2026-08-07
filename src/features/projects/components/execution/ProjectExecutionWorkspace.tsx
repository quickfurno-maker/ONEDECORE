"use client";

import type { ReactNode } from "react";
import type { ExecutionState } from "../../execution/contracts/execution-states.ts";
import { getExecutionStateLabel } from "../../execution/contracts/execution-states.ts";
import type { SyntheticExecutionProject } from "../../execution/fixtures/synthetic-execution.ts";
import type { ProjectClientUpdateDraft } from "../../contracts/client-update.ts";
import { ExecutionStageTimeline } from "./ExecutionStageTimeline.tsx";
import { StageTransitionPanel } from "./StageTransitionPanel.tsx";
import { ProjectHoldPanel } from "./ProjectHoldPanel.tsx";
import { SnagList } from "./SnagList.tsx";
import { SnagSummary } from "./SnagSummary.tsx";
import { HandoverChecklist } from "./HandoverChecklist.tsx";
import { CompletionSummary } from "./CompletionSummary.tsx";
import { ProjectClientUpdatePreview } from "./ProjectClientUpdatePreview.tsx";
import { ProjectTeamPanel } from "./ProjectTeamPanel.tsx";

export interface ProjectExecutionWorkspaceProps {
  readonly project: SyntheticExecutionProject;
  readonly readOnly?: boolean;
  readonly clientUpdateDraft?: ProjectClientUpdateDraft | null;
  readonly onStageTransition: (input: {
    toState: ExecutionState;
    reason: string | null;
    evidenceRefs: readonly string[];
  }) => Promise<{ success: boolean; message?: string }>;
  readonly onEnterHold: (input: {
    reasonCode: string;
    humanNote: string;
  }) => Promise<{ success: boolean; message?: string }>;
  readonly onResumeHold: () => Promise<{ success: boolean; message?: string }>;
  readonly onCancelProject: (reason: string) => Promise<{ success: boolean; message?: string }>;
  readonly onResolveSnag: (
    snagRef: string,
    evidenceRefs: readonly string[]
  ) => Promise<{ success: boolean; message?: string }>;
  readonly onCompleteHandover: (
    acknowledgementRef: string
  ) => Promise<{ success: boolean; message?: string }>;
  readonly onCompleteProject: (
    acknowledgementRef: string
  ) => Promise<{ success: boolean; message?: string }>;
  readonly banner?: ReactNode;
}

export function ProjectExecutionWorkspace({
  project,
  readOnly = false,
  clientUpdateDraft = null,
  onStageTransition,
  onEnterHold,
  onResumeHold,
  onCancelProject,
  onResolveSnag,
  onCompleteHandover,
  onCompleteProject,
  banner,
}: ProjectExecutionWorkspaceProps) {
  return (
    <div className="space-y-6" data-testid="project-execution-workspace">
      {banner}
      <header className="rounded-xl border border-neutral-700 bg-neutral-900/50 p-4">
        <p className="text-xs uppercase tracking-wide text-neutral-500">Execution workspace</p>
        <h1 className="mt-1 text-xl font-semibold text-neutral-100">{project.projectLabel}</h1>
        <p className="mt-1 text-sm text-neutral-300">{project.clientDisplayName}</p>
        <p className="mt-2 text-sm text-neutral-400">
          Current stage:{" "}
          <span className="font-medium text-neutral-100">
            {getExecutionStateLabel(project.executionState)}
          </span>
        </p>
        {readOnly ? (
          <p className="mt-2 text-sm text-amber-200" role="status">
            Read-only view — execution updates are not permitted for this actor.
          </p>
        ) : null}
      </header>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
        <div className="space-y-6">
          <ExecutionStageTimeline currentState={project.executionState} />
          <StageTransitionPanel
            currentState={project.executionState}
            readOnly={readOnly}
            onTransition={onStageTransition}
            onCancelProject={onCancelProject}
          />
          <ProjectHoldPanel
            currentState={project.executionState}
            holdRecord={project.holdRecord}
            readOnly={readOnly}
            onEnterHold={onEnterHold}
            onResumeHold={onResumeHold}
          />
          <SnagList
            snags={project.snags}
            readOnly={readOnly}
            onResolveSnag={onResolveSnag}
          />
          <HandoverChecklist
            readOnly={readOnly}
            onCompleteHandover={onCompleteHandover}
          />
          <CompletionSummary
            executionState={project.executionState}
            readOnly={readOnly}
            onCompleteProject={onCompleteProject}
          />
        </div>
        <aside className="space-y-6">
          <ProjectTeamPanel staffing={project.staffing} />
          <SnagSummary snags={project.snags} />
          {clientUpdateDraft ? (
            <ProjectClientUpdatePreview draft={clientUpdateDraft} />
          ) : null}
        </aside>
      </div>
    </div>
  );
}
