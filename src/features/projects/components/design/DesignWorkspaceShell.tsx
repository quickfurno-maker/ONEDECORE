"use client";

import type { ReactNode } from "react";
import type { DesignState } from "../../contracts/design-states.ts";
import { getDesignStateLabel } from "../../contracts/design-states.ts";
import type { SyntheticDesignWorkspace } from "../../design/fixtures/synthetic-design.ts";

export interface DesignWorkspaceCallbacks {
  readonly onAdvanceStage?: (targetState: DesignState) => void;
  readonly onPlaceOnHold?: (reason: string) => void;
  readonly onResumeFromHold?: () => void;
  readonly onRequestRevision?: (returnState: DesignState, note: string) => void;
}

export interface DesignWorkspaceShellProps {
  readonly workspace: SyntheticDesignWorkspace;
  readonly callbacks?: DesignWorkspaceCallbacks;
  readonly children?: ReactNode;
}

export function DesignWorkspaceShell({
  workspace,
  callbacks,
  children,
}: DesignWorkspaceShellProps) {
  return (
    <section
      aria-label="Design workspace"
      className="space-y-6 rounded-xl border border-neutral-800 bg-neutral-950/60 p-6"
    >
      <header className="space-y-1">
        <p className="text-xs uppercase tracking-wide text-neutral-500">Project</p>
        <h1 className="text-lg font-semibold text-neutral-100">
          {workspace.projectReference}
        </h1>
        <p className="text-sm text-neutral-300">
          Current stage: {getDesignStateLabel(workspace.designState)}
        </p>
      </header>

      {workspace.designState === "design_on_hold" && workspace.heldFromState ? (
        <p role="status" className="text-sm text-amber-200">
          Design paused. Resume to {getDesignStateLabel(workspace.heldFromState)}.
        </p>
      ) : null}

      <div className="space-y-4">{children}</div>

      {callbacks?.onAdvanceStage ? (
        <button
          type="button"
          className="rounded-md border border-neutral-700 px-3 py-2 text-sm text-neutral-200"
          onClick={() => callbacks.onAdvanceStage?.("internal_review")}
        >
          Advance stage (callback)
        </button>
      ) : null}
    </section>
  );
}
