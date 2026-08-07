"use client";

import type { HandoverDisplayModel } from "../../handover/ui/build-handover-display-model.ts";

interface ProjectHandoverAcceptancePanelProps {
  readonly model: HandoverDisplayModel;
  readonly disabled?: boolean;
  readonly onAcceptHandover: () => void;
  readonly onRequestReassignment: () => void;
}

export function ProjectHandoverAcceptancePanel({
  model,
  disabled = false,
  onAcceptHandover,
  onRequestReassignment,
}: ProjectHandoverAcceptancePanelProps) {
  const showAccept = model.canShowAcceptHandover;
  const showRequest = model.canShowRequestReassignment;

  if (!showAccept && !showRequest) {
    return (
      <section
        aria-label="Project handover acceptance"
        className="rounded-xl border border-neutral-800 bg-neutral-950/40 p-4 text-sm text-neutral-400"
      >
        Handover acceptance actions are not available for your role or current state.
      </section>
    );
  }

  return (
    <section
      aria-label="Project handover acceptance"
      className="rounded-xl border border-neutral-700 bg-neutral-900/50 p-4"
    >
      <h3 className="text-sm font-semibold text-neutral-100">PM handover acceptance</h3>
      <p className="mt-2 text-sm text-neutral-300">
        Review the commercial summary and scope before accepting handover responsibility.
      </p>
      <div className="mt-4 flex flex-wrap gap-3">
        {showAccept ? (
          <button
            type="button"
            disabled={disabled}
            className="rounded-md bg-emerald-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
            onClick={onAcceptHandover}
          >
            Accept handover
          </button>
        ) : null}
        {showRequest ? (
          <button
            type="button"
            disabled={disabled}
            className="rounded-md border border-neutral-600 px-4 py-2 text-sm font-semibold text-neutral-200 disabled:opacity-50"
            onClick={onRequestReassignment}
          >
            Request reassignment
          </button>
        ) : null}
      </div>
    </section>
  );
}
