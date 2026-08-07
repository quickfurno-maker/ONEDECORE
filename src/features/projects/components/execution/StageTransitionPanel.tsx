"use client";

import { useState } from "react";
import {
  getNextMainPathState,
  type ExecutionState,
  isExecutionMainPathState,
} from "../../execution/contracts/execution-states.ts";
import { getAllowedExecutionTransitions } from "../../execution/domain/execution-state-machine.ts";

interface StageTransitionPanelProps {
  readonly currentState: ExecutionState;
  readonly readOnly?: boolean;
  readonly onTransition: (input: {
    toState: ExecutionState;
    reason: string | null;
    evidenceRefs: readonly string[];
  }) => Promise<{ success: boolean; message?: string }>;
  readonly onCancelProject: (reason: string) => Promise<{ success: boolean; message?: string }>;
}

export function StageTransitionPanel({
  currentState,
  readOnly = false,
  onTransition,
  onCancelProject,
}: StageTransitionPanelProps) {
  const [pending, setPending] = useState(false);
  const [evidenceRef, setEvidenceRef] = useState("");
  const [cancelReason, setCancelReason] = useState("");
  const [message, setMessage] = useState<string | null>(null);

  const allowed = getAllowedExecutionTransitions(currentState);
  const nextMain =
    isExecutionMainPathState(currentState) && currentState !== "completed"
      ? getNextMainPathState(currentState)
      : null;

  async function advance() {
    if (pending || readOnly || !nextMain) return;
    setPending(true);
    setMessage(null);
    try {
      const refs = evidenceRef.trim() ? [evidenceRef.trim()] : [];
      const result = await onTransition({
        toState: nextMain,
        reason: null,
        evidenceRefs: refs,
      });
      setMessage(result.success ? "Stage transition recorded in prebuild adapter." : result.message ?? "Transition failed.");
    } finally {
      setPending(false);
    }
  }

  async function cancel() {
    if (pending || readOnly) return;
    const trimmed = cancelReason.trim();
    if (trimmed.length < 10) {
      setMessage("Cancellation reason must be at least 10 characters.");
      return;
    }
    setPending(true);
    setMessage(null);
    try {
      const result = await onCancelProject(trimmed);
      setMessage(result.success ? "Cancellation recorded in prebuild adapter." : result.message ?? "Cancellation failed.");
    } finally {
      setPending(false);
    }
  }

  if (currentState === "completed" || currentState === "cancelled") {
    return (
      <section
        aria-label="Stage transitions"
        className="rounded-xl border border-neutral-700 bg-neutral-900/50 p-4"
      >
        <h2 className="text-sm font-semibold text-neutral-100">Stage transitions</h2>
        <p className="mt-2 text-sm text-neutral-400">No further transitions are available.</p>
      </section>
    );
  }

  return (
    <section
      aria-label="Stage transitions"
      className="rounded-xl border border-neutral-700 bg-neutral-900/50 p-4"
    >
      <h2 className="text-sm font-semibold text-neutral-100">Stage transitions</h2>
      <p className="mt-2 text-sm text-neutral-400">
        Advance one stage at a time. Evidence may be required for gated transitions.
      </p>

      {nextMain && allowed.includes(nextMain) ? (
        <div className="mt-4 space-y-3">
          <label className="block text-sm text-neutral-200">
            Evidence reference (when required)
            <input
              type="text"
              className="mt-1 block w-full rounded-md border border-neutral-700 bg-neutral-950 px-3 py-2 text-sm"
              value={evidenceRef}
              onChange={(event) => setEvidenceRef(event.target.value)}
              aria-label="Stage transition evidence reference"
              disabled={readOnly || pending}
            />
          </label>
          <button
            type="button"
            disabled={readOnly || pending}
            className="rounded-md bg-sky-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
            onClick={advance}
          >
            Advance to next stage
          </button>
        </div>
      ) : null}

      {allowed.includes("cancelled") ? (
        <div className="mt-6 space-y-3 border-t border-neutral-800 pt-4">
          <label className="block text-sm text-neutral-200">
            Cancellation reason
            <textarea
              className="mt-1 block min-h-20 w-full rounded-md border border-neutral-700 bg-neutral-950 px-3 py-2 text-sm"
              value={cancelReason}
              onChange={(event) => setCancelReason(event.target.value)}
              aria-label="Project cancellation reason"
              disabled={readOnly || pending}
            />
          </label>
          <button
            type="button"
            disabled={readOnly || pending}
            className="rounded-md border border-red-700 px-4 py-2 text-sm font-semibold text-red-200 disabled:opacity-50"
            onClick={cancel}
          >
            Cancel project
          </button>
        </div>
      ) : null}

      {message ? (
        <p className="mt-4 text-sm text-neutral-300" aria-live="polite">
          {message}
        </p>
      ) : null}
    </section>
  );
}
