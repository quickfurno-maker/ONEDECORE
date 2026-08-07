"use client";

import type { ReactNode } from "react";

export interface ProjectDeliveryWorkspaceShellProps {
  readonly projectReference: string;
  readonly enabled?: boolean;
  readonly handoverSection?: ReactNode;
  readonly designSection?: ReactNode;
  readonly executionSection?: ReactNode;
}

export function ProjectDeliveryWorkspaceShell({
  projectReference,
  enabled = false,
  handoverSection,
  designSection,
  executionSection,
}: ProjectDeliveryWorkspaceShellProps) {
  return (
    <div className="space-y-8" aria-label="Project delivery workspace">
      <header className="space-y-2 rounded-lg border border-neutral-800 bg-neutral-900/40 p-4">
        <p className="text-xs uppercase tracking-wide text-neutral-500">
          Phase 8 migration-independent prebuild
        </p>
        <h1 className="text-xl font-semibold text-neutral-100">{projectReference}</h1>
        <p role="status" aria-live="polite" className="text-sm text-neutral-400">
          {enabled
            ? "Staff-triggered project delivery workspace (callbacks only; no live mutations)."
            : "Project delivery workspace is disabled until formal Phase 8 runtime is activated."}
        </p>
      </header>

      {!enabled ? (
        <p className="rounded-md border border-neutral-700 px-4 py-3 text-sm text-neutral-300">
          Handover, design, and execution panels are available as reusable components only.
          No admin route is activated in this prebuild.
        </p>
      ) : null}

      <div className="grid gap-8 xl:grid-cols-1">
        {handoverSection ? (
          <section aria-label="Handover">{handoverSection}</section>
        ) : null}
        {designSection ? (
          <section aria-label="Design collaboration">{designSection}</section>
        ) : null}
        {executionSection ? (
          <section aria-label="Project execution">{executionSection}</section>
        ) : null}
      </div>
    </div>
  );
}
